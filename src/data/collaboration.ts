import { type Cue, parseCueBrightness, parseCueFixtures } from "./cues";
import { type LightFixture } from "./fixtures";
import { type VersionNote } from "./versionNotes";
import { computeHash } from "../utils/draft";

export type EditorRole = "left" | "right";

export type ConflictType =
  | "fixtureBrightness"
  | "cueField"
  | "cueOrder"
  | "versionNote"
  | "newCue"
  | "removedCue";

export type ResolutionChoice = "keepLeft" | "keepRight" | "manual";

export interface EditorState {
  fixtures: LightFixture[];
  cues: Cue[];
  versionNotes: VersionNote[];
  editorName: string;
  editorColor: string;
}

export interface ConflictField {
  field: string;
  leftValue: string | number | null;
  rightValue: string | number | null;
  leftDisplay: string;
  rightDisplay: string;
}

export interface FixtureConflict {
  type: "fixtureBrightness";
  fixtureId: string;
  fixtureNumber: string;
  fixtureType: string;
  leftBrightness: number;
  rightBrightness: number;
  baseBrightness: number;
}

export interface CueFieldConflict {
  type: "cueField";
  cueId: string;
  cueNumber: string;
  field: string;
  fieldLabel: string;
  leftValue: string;
  rightValue: string;
  baseValue: string;
}

export interface CueOrderConflict {
  type: "cueOrder";
  cueId: string;
  cueNumber: string;
  leftIndex: number;
  rightIndex: number;
  baseIndex: number;
}

export interface NewCueConflict {
  type: "newCue";
  side: EditorRole;
  cue: Cue;
}

export interface RemovedCueConflict {
  type: "removedCue";
  side: EditorRole;
  cueId: string;
  baseCue: Cue;
}

export interface VersionNoteConflict {
  type: "versionNote";
  noteId: string;
  field: string;
  leftValue: string | boolean;
  rightValue: string | boolean;
  baseValue: string | boolean;
}

export type Conflict =
  | FixtureConflict
  | CueFieldConflict
  | CueOrderConflict
  | NewCueConflict
  | RemovedCueConflict
  | VersionNoteConflict;

export interface ResolvedConflict {
  conflict: Conflict;
  choice: ResolutionChoice;
  manualValue?: any;
}

export interface ConflictDetectionResult {
  conflicts: Conflict[];
  summary: {
    totalConflicts: number;
    fixtureConflicts: number;
    cueFieldConflicts: number;
    cueOrderConflicts: number;
    newCueConflicts: number;
    removedCueConflicts: number;
    versionNoteConflicts: number;
  };
}

export interface MergeResult {
  fixtures: LightFixture[];
  cues: Cue[];
  versionNotes: VersionNote[];
  resolvedCount: number;
  unresolvedCount: number;
}

export interface CollaborationSession {
  id: string;
  baseState: {
    fixtures: LightFixture[];
    cues: Cue[];
    versionNotes: VersionNote[];
  };
  leftEditor: EditorState;
  rightEditor: EditorState;
  conflicts: Conflict[];
  resolutions: Map<string, ResolvedConflict>;
  status: "editing" | "detecting" | "resolving" | "merged";
  mergedState?: {
    fixtures: LightFixture[];
    cues: Cue[];
    versionNotes: VersionNote[];
  };
}

const CONFLICT_FIELD_LABELS: Record<string, string> = {
  number: "Cue编号",
  sceneName: "场景名称",
  fixtures: "关联灯具",
  brightnessChange: "亮度变化",
  triggerNote: "触发说明",
  versionNote: "版本备注",
};

const CUE_MERGE_FIELDS = Object.keys(CONFLICT_FIELD_LABELS) as (keyof Cue)[];
const VERSION_NOTE_MERGE_FIELDS = [
  "versionName",
  "relatedCues",
  "adjustmentReason",
  "pendingItems",
  "confirmed",
] as const;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeValue<T>(baseValue: T, leftValue: T, rightValue: T): T {
  const leftChanged = !valuesEqual(leftValue, baseValue);
  const rightChanged = !valuesEqual(rightValue, baseValue);

  if (leftChanged && !rightChanged) return clone(leftValue);
  if (!leftChanged && rightChanged) return clone(rightValue);
  if (leftChanged && rightChanged && valuesEqual(leftValue, rightValue)) {
    return clone(leftValue);
  }

  return clone(baseValue);
}

function getOrderSignature(cues: Cue[]): string {
  return cues.map((cue) => cue.id).join("|");
}

function applyCueOrder(target: Cue[], orderedSource: Cue[]): Cue[] {
  const targetMap = new Map(target.map((cue) => [cue.id, cue]));
  const ordered = orderedSource
    .map((cue) => targetMap.get(cue.id))
    .filter((cue): cue is Cue => Boolean(cue));
  const orderedIds = new Set(ordered.map((cue) => cue.id));
  const remaining = target.filter((cue) => !orderedIds.has(cue.id));
  return [...ordered, ...remaining];
}

export function createEditorState(
  baseFixtures: LightFixture[],
  baseCues: Cue[],
  baseVersionNotes: VersionNote[],
  editorName: string,
  editorColor: string
): EditorState {
  return {
    fixtures: JSON.parse(JSON.stringify(baseFixtures)),
    cues: JSON.parse(JSON.stringify(baseCues)),
    versionNotes: JSON.parse(JSON.stringify(baseVersionNotes)),
    editorName,
    editorColor,
  };
}

export function createCollaborationSession(
  baseFixtures: LightFixture[],
  baseCues: Cue[],
  baseVersionNotes: VersionNote[]
): CollaborationSession {
  return {
    id: `collab-${Date.now()}`,
    baseState: {
      fixtures: JSON.parse(JSON.stringify(baseFixtures)),
      cues: JSON.parse(JSON.stringify(baseCues)),
      versionNotes: JSON.parse(JSON.stringify(baseVersionNotes)),
    },
    leftEditor: createEditorState(
      baseFixtures,
      baseCues,
      baseVersionNotes,
      "灯光师 A",
      "#7c3aed"
    ),
    rightEditor: createEditorState(
      baseFixtures,
      baseCues,
      baseVersionNotes,
      "灯光师 B",
      "#f59e0b"
    ),
    conflicts: [],
    resolutions: new Map(),
    status: "editing",
  };
}

export function detectConflicts(
  baseState: {
    fixtures: LightFixture[];
    cues: Cue[];
    versionNotes: VersionNote[];
  },
  leftState: EditorState,
  rightState: EditorState
): ConflictDetectionResult {
  const conflicts: Conflict[] = [];

  const baseFixtureMap = new Map(baseState.fixtures.map((f) => [f.id, f]));
  const leftFixtureMap = new Map(leftState.fixtures.map((f) => [f.id, f]));
  const rightFixtureMap = new Map(rightState.fixtures.map((f) => [f.id, f]));

  for (const fixture of baseState.fixtures) {
    const leftF = leftFixtureMap.get(fixture.id);
    const rightF = rightFixtureMap.get(fixture.id);
    if (leftF && rightF) {
      const leftChanged = leftF.brightness !== fixture.brightness;
      const rightChanged = rightF.brightness !== fixture.brightness;
      if (leftChanged && rightChanged && leftF.brightness !== rightF.brightness) {
        conflicts.push({
          type: "fixtureBrightness",
          fixtureId: fixture.id,
          fixtureNumber: fixture.number,
          fixtureType: fixture.type,
          leftBrightness: leftF.brightness,
          rightBrightness: rightF.brightness,
          baseBrightness: fixture.brightness,
        });
      }
    }
  }

  const baseCueMap = new Map(baseState.cues.map((c) => [c.id, c]));
  const leftCueMap = new Map(leftState.cues.map((c) => [c.id, c]));
  const rightCueMap = new Map(rightState.cues.map((c) => [c.id, c]));

  for (const cue of baseState.cues) {
    const leftCue = leftCueMap.get(cue.id);
    const rightCue = rightCueMap.get(cue.id);

    if (leftCue && rightCue) {
      for (const field of Object.keys(CONFLICT_FIELD_LABELS)) {
      const key = field as keyof Cue;
      const leftVal = String(leftCue[key] ?? "");
      const rightVal = String(rightCue[key] ?? "");
      const baseVal = String(cue[key] ?? "");
      const leftChanged = leftVal !== baseVal;
      const rightChanged = rightVal !== baseVal;
      if (leftChanged && rightChanged && leftVal !== rightVal) {
        conflicts.push({
          type: "cueField",
          cueId: cue.id,
          cueNumber: cue.number,
          field,
          fieldLabel: CONFLICT_FIELD_LABELS[field] || field,
          leftValue: leftVal,
          rightValue: rightVal,
          baseValue: baseVal,
        });
      }
    }

      const leftIndex = leftState.cues.findIndex((c) => c.id === cue.id);
      const rightIndex = rightState.cues.findIndex((c) => c.id === cue.id);
      const baseIndex = baseState.cues.findIndex((c) => c.id === cue.id);
      const leftOrderChanged = leftIndex !== baseIndex;
      const rightOrderChanged = rightIndex !== baseIndex;
      if (leftOrderChanged && rightOrderChanged && leftIndex !== rightIndex) {
        const hasFieldConflict = conflicts.some(
          (c) => c.type === "cueField" && c.cueId === cue.id
        );
        if (!hasFieldConflict) {
          conflicts.push({
            type: "cueOrder",
            cueId: cue.id,
            cueNumber: cue.number,
            leftIndex,
            rightIndex,
            baseIndex,
          });
        }
      }
    }
  }

  for (const leftCue of leftState.cues) {
    if (!baseCueMap.has(leftCue.id) && !rightCueMap.has(leftCue.id)) {
      conflicts.push({
        type: "newCue",
        side: "left",
        cue: leftCue,
      });
    }
  }

  for (const rightCue of rightState.cues) {
    if (!baseCueMap.has(rightCue.id) && !leftCueMap.has(rightCue.id)) {
      conflicts.push({
        type: "newCue",
        side: "right",
        cue: rightCue,
      });
    }
  }

  for (const baseCue of baseState.cues) {
    const inLeft = leftCueMap.has(baseCue.id);
    const inRight = rightCueMap.has(baseCue.id);
    if (!inLeft && inRight) {
      conflicts.push({
        type: "removedCue",
        side: "left",
        cueId: baseCue.id,
        baseCue,
      });
    }
    if (inLeft && !inRight) {
      conflicts.push({
        type: "removedCue",
        side: "right",
        cueId: baseCue.id,
        baseCue,
      });
    }
  }

  const baseNoteMap = new Map(baseState.versionNotes.map((n) => [n.id, n]));
  const leftNoteMap = new Map(leftState.versionNotes.map((n) => [n.id, n]));
  const rightNoteMap = new Map(rightState.versionNotes.map((n) => [n.id, n]));

  for (const note of baseState.versionNotes) {
    const leftNote = leftNoteMap.get(note.id);
    const rightNote = rightNoteMap.get(note.id);
    if (leftNote && rightNote) {
      const noteFields = ["versionName", "relatedCues", "adjustmentReason", "pendingItems", "confirmed"] as const;
      for (const field of noteFields) {
        const leftVal = leftNote[field];
        const rightVal = rightNote[field];
        const baseVal = note[field];
        const leftChanged = leftVal !== baseVal;
        const rightChanged = rightVal !== baseVal;
        if (leftChanged && rightChanged && leftVal !== rightVal) {
          conflicts.push({
            type: "versionNote",
            noteId: note.id,
            field,
            leftValue: leftVal,
            rightValue: rightVal,
            baseValue: baseVal,
          });
        }
      }
    }
  }

  return {
    conflicts,
    summary: {
      totalConflicts: conflicts.length,
      fixtureConflicts: conflicts.filter((c) => c.type === "fixtureBrightness").length,
      cueFieldConflicts: conflicts.filter((c) => c.type === "cueField").length,
      cueOrderConflicts: conflicts.filter((c) => c.type === "cueOrder").length,
      newCueConflicts: conflicts.filter((c) => c.type === "newCue").length,
      removedCueConflicts: conflicts.filter((c) => c.type === "removedCue").length,
      versionNoteConflicts: conflicts.filter((c) => c.type === "versionNote").length,
    },
  };
}

export function getConflictId(conflict: Conflict): string {
  switch (conflict.type) {
    case "fixtureBrightness":
      return `fixture-${conflict.fixtureId}`;
    case "cueField":
      return `cuefield-${conflict.cueId}-${conflict.field}`;
    case "cueOrder":
      return `cueorder-${conflict.cueId}`;
    case "newCue":
      return `newcue-${conflict.side}-${conflict.cue.id}`;
    case "removedCue":
      return `removedcue-${conflict.side}-${conflict.cueId}`;
    case "versionNote":
      return `versionnote-${conflict.noteId}-${conflict.field}`;
    default:
      return `conflict-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export function mergeStates(
  baseState: {
    fixtures: LightFixture[];
    cues: Cue[];
    versionNotes: VersionNote[];
  },
  leftState: EditorState,
  rightState: EditorState,
  resolutions: Map<string, ResolvedConflict>
): MergeResult {
  const mergedFixtures = clone(baseState.fixtures);
  let mergedCues = clone(baseState.cues);
  const mergedVersionNotes = clone(baseState.versionNotes);

  const baseFixtureMap = new Map(baseState.fixtures.map((f) => [f.id, f]));
  const leftFixtureMap = new Map(leftState.fixtures.map((f) => [f.id, f]));
  const rightFixtureMap = new Map(rightState.fixtures.map((f) => [f.id, f]));
  const baseCueMap = new Map(baseState.cues.map((c) => [c.id, c]));
  const leftCueMap = new Map(leftState.cues.map((c) => [c.id, c]));
  const rightCueMap = new Map(rightState.cues.map((c) => [c.id, c]));
  const baseNoteMap = new Map(baseState.versionNotes.map((n) => [n.id, n]));
  const leftNoteMap = new Map(leftState.versionNotes.map((n) => [n.id, n]));
  const rightNoteMap = new Map(rightState.versionNotes.map((n) => [n.id, n]));

  for (const fixture of mergedFixtures) {
    const baseFixture = baseFixtureMap.get(fixture.id);
    const leftFixture = leftFixtureMap.get(fixture.id);
    const rightFixture = rightFixtureMap.get(fixture.id);
    if (!baseFixture || !leftFixture || !rightFixture) continue;
    fixture.brightness = mergeValue(
      baseFixture.brightness,
      leftFixture.brightness,
      rightFixture.brightness
    );
  }

  for (const cue of mergedCues) {
    const baseCue = baseCueMap.get(cue.id);
    const leftCue = leftCueMap.get(cue.id);
    const rightCue = rightCueMap.get(cue.id);
    if (!baseCue || !leftCue || !rightCue) continue;

    for (const field of CUE_MERGE_FIELDS) {
      cue[field] = mergeValue(baseCue[field], leftCue[field], rightCue[field]);
    }
  }

  const baseOrder = getOrderSignature(baseState.cues);
  const leftOrder = getOrderSignature(leftState.cues);
  const rightOrder = getOrderSignature(rightState.cues);
  if (leftOrder !== baseOrder && rightOrder === baseOrder) {
    mergedCues = applyCueOrder(mergedCues, leftState.cues);
  } else if (rightOrder !== baseOrder && leftOrder === baseOrder) {
    mergedCues = applyCueOrder(mergedCues, rightState.cues);
  } else if (leftOrder !== baseOrder && leftOrder === rightOrder) {
    mergedCues = applyCueOrder(mergedCues, leftState.cues);
  }

  for (const note of mergedVersionNotes) {
    const baseNote = baseNoteMap.get(note.id);
    const leftNote = leftNoteMap.get(note.id);
    const rightNote = rightNoteMap.get(note.id);
    if (!baseNote || !leftNote || !rightNote) continue;

    for (const field of VERSION_NOTE_MERGE_FIELDS) {
      note[field] = mergeValue(baseNote[field], leftNote[field], rightNote[field]);
    }
  }

  let resolvedCount = 0;
  let unresolvedCount = 0;

  for (const conflict of resolutions.values()) {
    const choice = conflict.choice;
    const c = conflict.conflict;

    switch (c.type) {
      case "fixtureBrightness": {
        const idx = mergedFixtures.findIndex((f) => f.id === c.fixtureId);
        if (idx >= 0) {
          if (choice === "keepLeft") {
            mergedFixtures[idx].brightness = c.leftBrightness;
          } else if (choice === "keepRight") {
            mergedFixtures[idx].brightness = c.rightBrightness;
          } else if (choice === "manual" && conflict.manualValue !== undefined) {
            mergedFixtures[idx].brightness = conflict.manualValue;
          }
          resolvedCount++;
        }
        break;
      }
      case "cueField": {
        const idx = mergedCues.findIndex((cue) => cue.id === c.cueId);
        if (idx >= 0) {
          const field = c.field as keyof Cue;
          if (choice === "keepLeft") {
            const leftCue = leftCueMap.get(c.cueId);
            if (leftCue) mergedCues[idx][field] = leftCue[field];
          } else if (choice === "keepRight") {
            const rightCue = rightCueMap.get(c.cueId);
            if (rightCue) mergedCues[idx][field] = rightCue[field];
          } else if (choice === "manual" && conflict.manualValue !== undefined) {
            mergedCues[idx][field] = conflict.manualValue;
          }
          resolvedCount++;
        }
        break;
      }
      case "cueOrder": {
        if (choice === "keepLeft") {
          const leftIndex = leftState.cues.findIndex((cue) => cue.id === c.cueId);
          const currentIndex = mergedCues.findIndex((cue) => cue.id === c.cueId);
          if (leftIndex >= 0 && currentIndex >= 0 && leftIndex !== currentIndex) {
            const [removed] = mergedCues.splice(currentIndex, 1);
            mergedCues.splice(leftIndex, 0, removed);
          }
        } else if (choice === "keepRight") {
          const rightIndex = rightState.cues.findIndex((cue) => cue.id === c.cueId);
          const currentIndex = mergedCues.findIndex((cue) => cue.id === c.cueId);
          if (rightIndex >= 0 && currentIndex >= 0 && rightIndex !== currentIndex) {
            const [removed] = mergedCues.splice(currentIndex, 1);
            mergedCues.splice(rightIndex, 0, removed);
          }
        } else if (choice === "manual" && conflict.manualValue !== undefined) {
          const targetIndex = conflict.manualValue;
          const currentIndex = mergedCues.findIndex((cue) => cue.id === c.cueId);
          if (targetIndex >= 0 && currentIndex >= 0 && targetIndex !== currentIndex) {
            const [removed] = mergedCues.splice(currentIndex, 1);
            mergedCues.splice(targetIndex, 0, removed);
          }
        }
        resolvedCount++;
        break;
      }
      case "newCue": {
        if (choice === "keepLeft" && c.side === "left") {
          mergedCues.push(JSON.parse(JSON.stringify(c.cue)));
          resolvedCount++;
        } else if (choice === "keepRight" && c.side === "right") {
          mergedCues.push(JSON.parse(JSON.stringify(c.cue)));
          resolvedCount++;
        } else if (choice === "manual" && conflict.manualValue === true) {
          mergedCues.push(JSON.parse(JSON.stringify(c.cue)));
          resolvedCount++;
        }
        break;
      }
      case "removedCue": {
        if (choice === "keepLeft" && c.side === "left") {
          const idx = mergedCues.findIndex((cue) => cue.id === c.cueId);
          if (idx >= 0) mergedCues.splice(idx, 1);
          resolvedCount++;
        } else if (choice === "keepRight" && c.side === "right") {
          const idx = mergedCues.findIndex((cue) => cue.id === c.cueId);
          if (idx >= 0) mergedCues.splice(idx, 1);
          resolvedCount++;
        } else if (choice === "manual" && conflict.manualValue === true) {
          const idx = mergedCues.findIndex((cue) => cue.id === c.cueId);
          if (idx >= 0) mergedCues.splice(idx, 1);
          resolvedCount++;
        }
        break;
      }
      case "versionNote": {
        const idx = mergedVersionNotes.findIndex((n) => n.id === c.noteId);
        if (idx >= 0) {
          const field = c.field as keyof VersionNote;
          if (choice === "keepLeft") {
            const leftNote = leftNoteMap.get(c.noteId);
            if (leftNote) (mergedVersionNotes[idx] as any)[field] = leftNote[field];
          } else if (choice === "keepRight") {
            const rightNote = rightNoteMap.get(c.noteId);
            if (rightNote) (mergedVersionNotes[idx] as any)[field] = rightNote[field];
          } else if (choice === "manual" && conflict.manualValue !== undefined) {
            (mergedVersionNotes[idx] as any)[field] = conflict.manualValue;
          }
          resolvedCount++;
        }
        break;
      }
    }
  }

  const resolvedIds = new Set(
    Array.from(resolutions.values()).map((r) => getConflictId(r.conflict))
  );
  unresolvedCount = resolutions.size - resolvedCount;

  return {
    fixtures: mergedFixtures,
    cues: mergedCues,
    versionNotes: mergedVersionNotes,
    resolvedCount,
    unresolvedCount,
  };
}

export function generateSampleConflicts(
  session: CollaborationSession
): CollaborationSession {
  const updated = JSON.parse(JSON.stringify(session)) as CollaborationSession;
  updated.resolutions = new Map();

  updated.leftEditor.editorName = "张老师";
  updated.rightEditor.editorName = "李老师";

  updated.leftEditor.fixtures[0].brightness = 90;
  updated.rightEditor.fixtures[0].brightness = 70;

  updated.leftEditor.fixtures[5].brightness = 80;
  updated.rightEditor.fixtures[5].brightness = 50;

  updated.leftEditor.cues[0].brightnessChange = "亮度75%";
  updated.rightEditor.cues[0].brightnessChange = "亮度55%";

  updated.leftEditor.cues[0].versionNote = "版本A - 张老师调整";
  updated.rightEditor.cues[0].versionNote = "版本A - 李老师修改";

  const leftCues = [...updated.leftEditor.cues];
  const [cue1] = leftCues.splice(1, 1);
  leftCues.splice(2, 0, cue1);
  updated.leftEditor.cues = leftCues;

  const rightCues = [...updated.rightEditor.cues];
  const [cue2] = rightCues.splice(2, 1);
  rightCues.splice(0, 0, cue2);
  updated.rightEditor.cues = rightCues;

  const newCue: Cue = {
    id: `cue-new-left-${Date.now()}`,
    number: "Cue 15",
    sceneName: "中场过渡光",
    fixtures: "CH 011-016",
    brightnessChange: "亮度45%",
    triggerNote: "中场休息结束前30秒",
    versionNote: "版本A",
  };
  updated.leftEditor.cues.push(newCue);

  updated.leftEditor.versionNotes[0].adjustmentReason =
    "冷蓝侧光亮度从70%调至65%，追光入场时机延后2秒，配合演员走位调整。张老师建议增加暖色辅助光。";
  updated.rightEditor.versionNotes[0].adjustmentReason =
    "冷蓝侧光亮度从70%调至65%，追光入场时机延后2秒，配合演员走位调整。李老师建议降低整体亮度避免过曝。";

  return updated;
}
