import { FIXTURES, type LightFixture, type LightType } from "./fixtures";

export type { LightFixture };

export interface Cue {
  id: string;
  number: string;
  sceneName: string;
  fixtures: string;
  brightnessChange: string;
  triggerNote: string;
  versionNote: string;
}

export const INITIAL_CUES: Cue[] = [
  {
    id: "cue-12",
    number: "Cue 12",
    sceneName: "冷蓝侧光",
    fixtures: "CH 021-028",
    brightnessChange: "亮度65%",
    triggerNote: "二幕开场",
    versionNote: "版本A",
  },
  {
    id: "cue-18",
    number: "Cue 18",
    sceneName: "追光入场",
    fixtures: "FOH-03",
    brightnessChange: "亮度100%",
    triggerNote: "需演员走位确认",
    versionNote: "版本A",
  },
  {
    id: "cue-24",
    number: "Cue 24",
    sceneName: "暖色谢幕",
    fixtures: "全台面光",
    brightnessChange: "亮度80%",
    triggerNote: "谢幕音乐起",
    versionNote: "版本B",
  },
];

export const EMPTY_CUE: Cue = {
  id: "",
  number: "",
  sceneName: "",
  fixtures: "",
  brightnessChange: "",
  triggerNote: "",
  versionNote: "",
};

const TYPE_KEYWORDS: Record<string, LightType> = {
  "面光": "面光",
  "侧光": "侧光",
  "逆光": "逆光",
  "效果光": "效果光",
};

function parseChannelRange(rangeStr: string): string[] {
  const channels: string[] = [];
  const segments = rangeStr.split(/[，,、;；]+/).map((s) => s.trim()).filter(Boolean);

  for (const seg of segments) {
    const rangeMatch = seg.match(/CH\s*(\d+)\s*[-–—~至到]\s*(\d+)/i);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      const [s, e] = start <= end ? [start, end] : [end, start];
      for (let i = s; i <= e; i++) {
        channels.push(`CH${String(i).padStart(3, "0")}`);
      }
      continue;
    }
    const singleMatches = seg.match(/CH\s*(\d+)/gi);
    if (singleMatches) {
      for (const m of singleMatches) {
        const num = m.match(/\d+/);
        if (num) {
          channels.push(`CH${String(parseInt(num[0], 10)).padStart(3, "0")}`);
        }
      }
    }
  }
  return Array.from(new Set(channels));
}

function parseFixtureNumbers(text: string): string[] {
  const numbers: string[] = [];
  const patterns = [
    /FOH-\d+/gi,
    /SL-\d+/gi,
    /SR-\d+/gi,
    /BL-\d+/gi,
    /FX-\d+/gi,
  ];
  for (const pat of patterns) {
    const matches = text.match(pat);
    if (matches) {
      numbers.push(...matches.map((m) => m.toUpperCase()));
    }
  }
  return numbers;
}

export function parseCueFixtures(cue: Cue, allFixtures: LightFixture[] = FIXTURES): LightFixture[] {
  if (!cue || !cue.fixtures || !cue.fixtures.trim()) return [];

  const text = cue.fixtures.trim();

  if (text === "全台" || text === "全台灯具") {
    return [...allFixtures];
  }

  const segments = text.split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean);
  const resultIds = new Set<string>();

  for (const seg of segments) {
    let matchedInSeg = false;

    for (const [keyword, lightType] of Object.entries(TYPE_KEYWORDS)) {
      if (seg === keyword || seg === `全台${keyword}` || seg.includes(keyword)) {
        for (const f of allFixtures) {
          if (f.type === lightType) {
            resultIds.add(f.id);
          }
        }
        matchedInSeg = true;
        break;
      }
    }
    if (matchedInSeg) continue;

    const channels = parseChannelRange(seg);
    if (channels.length > 0) {
      for (const f of allFixtures) {
        if (channels.includes(f.channel.toUpperCase())) {
          resultIds.add(f.id);
        }
      }
      matchedInSeg = true;
    }
    if (matchedInSeg) continue;

    const fixtureNumbers = parseFixtureNumbers(seg);
    if (fixtureNumbers.length > 0) {
      for (const f of allFixtures) {
        if (fixtureNumbers.includes(f.number.toUpperCase())) {
          resultIds.add(f.id);
        }
      }
    }
  }

  return allFixtures.filter((f) => resultIds.has(f.id));
}

export function parseCueBrightness(cue: Cue): number | null {
  if (!cue || !cue.brightnessChange || !cue.brightnessChange.trim()) return null;
  const text = cue.brightnessChange.trim();
  const match = text.match(/(\d+(?:\.\d+)?)\s*%?/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function hasBrightnessField(cue: Cue): boolean {
  if (!cue || !cue.brightnessChange) return false;
  return cue.brightnessChange.trim().length > 0;
}

export interface CueFixtureDiff {
  fixtureId: string;
  fixtureNumber: string;
  cueBrightness: number | null;
  actualBrightness: number;
  cueFocus: string | null;
  actualFocus: string;
  brightnessDiffers: boolean;
  focusDiffers: boolean;
}

export function getCueFixtureDiffs(
  cue: Cue,
  allFixtures: LightFixture[] = FIXTURES
): CueFixtureDiff[] {
  const cueFixtures = parseCueFixtures(cue, allFixtures);
  const cueBrightness = parseCueBrightness(cue);
  const hasCueBrightness = hasBrightnessField(cue);

  return cueFixtures.map((f) => {
    const effectiveCueBrightness = hasCueBrightness ? cueBrightness : null;
    const brightnessDiffers = effectiveCueBrightness !== null && effectiveCueBrightness !== f.brightness;
    const focusDiffers = hasCueBrightness && cueBrightness !== null
      ? false
      : false;

    return {
      fixtureId: f.id,
      fixtureNumber: f.number,
      cueBrightness: effectiveCueBrightness,
      actualBrightness: f.brightness,
      cueFocus: null,
      actualFocus: f.focus,
      brightnessDiffers,
      focusDiffers,
    };
  });
}

export function hasCueFixtureDivergence(
  cue: Cue,
  allFixtures: LightFixture[] = FIXTURES
): boolean {
  const diffs = getCueFixtureDiffs(cue, allFixtures);
  return diffs.some((d) => d.brightnessDiffers || d.focusDiffers);
}

export function syncCueBrightnessFromFixtures(
  cue: Cue,
  allFixtures: LightFixture[] = FIXTURES
): Cue {
  const cueFixtures = parseCueFixtures(cue, allFixtures);
  if (cueFixtures.length === 0) return cue;

  const brightnesses = cueFixtures.map((f) => f.brightness);
  const avg = Math.round(brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length);

  return {
    ...cue,
    brightnessChange: `亮度${avg}%`,
  };
}

export type DiffType = "added" | "removed" | "modified" | "orderChanged";

export type FieldChangeType =
  | "number"
  | "sceneName"
  | "fixtures"
  | "brightnessChange"
  | "triggerNote"
  | "versionNote"
  | "order"
  | "fixtureBrightness"
  | "fixtureColor"
  | "fixtureFocus";

export interface FieldDiff {
  field: FieldChangeType;
  oldValue: string | number | null;
  newValue: string | number | null;
  fixtureId?: string;
  fixtureNumber?: string;
}

export interface FixtureDiff {
  fixtureId: string;
  fixtureNumber: string;
  brightnessDiff?: { old: number | null; new: number | null };
  colorDiff?: { old: string; new: string };
  focusDiff?: { old: string; new: string };
}

export interface CueVersionDiff {
  cueId: string;
  cueNumber: string;
  diffType: DiffType;
  baseCue?: Cue;
  targetCue?: Cue;
  fieldDiffs: FieldDiff[];
  orderChanged?: {
    oldIndex: number;
    newIndex: number;
  };
  isRenamed?: boolean;
  matchedByContent?: boolean;
  fixtureDiffs?: FixtureDiff[];
}

export interface VersionSnapshot {
  id: string;
  name: string;
  createdAt: string;
  description: string;
  cues: Cue[];
  fixtures: LightFixture[];
  dataVersion: number;
}

export interface CompareResult {
  baseVersion: VersionSnapshot;
  targetVersion: VersionSnapshot;
  diffs: CueVersionDiff[];
  summary: {
    totalAdded: number;
    totalRemoved: number;
    totalModified: number;
    totalOrderChanged: number;
    fixturesAffected: string[];
  };
}

const COMPARE_FIELDS: (keyof Cue)[] = [
  "number",
  "sceneName",
  "fixtures",
  "brightnessChange",
  "triggerNote",
  "versionNote",
];

function getFieldLabel(field: keyof Cue): FieldChangeType {
  const labels: Record<keyof Cue, FieldChangeType> = {
    id: "number",
    number: "number",
    sceneName: "sceneName",
    fixtures: "fixtures",
    brightnessChange: "brightnessChange",
    triggerNote: "triggerNote",
    versionNote: "versionNote",
  };
  return labels[field] || field;
}

function calculateContentSimilarity(a: Cue, b: Cue): number {
  let score = 0;
  let total = 0;

  if (a.sceneName && b.sceneName) {
    total++;
    if (a.sceneName === b.sceneName) score++;
    else if (
      a.sceneName.includes(b.sceneName) ||
      b.sceneName.includes(a.sceneName)
    )
      score += 0.5;
  }

  if (a.fixtures && b.fixtures) {
    total++;
    if (a.fixtures === b.fixtures) score++;
    else {
      const aFixtures = parseCueFixtures(a).map((f) => f.id);
      const bFixtures = parseCueFixtures(b).map((f) => f.id);
      const intersection = aFixtures.filter((id) => bFixtures.includes(id));
      if (aFixtures.length > 0 || bFixtures.length > 0) {
        const union = new Set([...aFixtures, ...bFixtures]);
        score += intersection.length / union.size;
      }
      total++;
    }
  }

  if (a.triggerNote && b.triggerNote) {
    total++;
    if (a.triggerNote === b.triggerNote) score++;
    else if (
      a.triggerNote.includes(b.triggerNote) ||
      b.triggerNote.includes(a.triggerNote)
    )
      score += 0.5;
  }

  return total > 0 ? score / total : 0;
}

function matchCuesByContent(
  baseCues: Cue[],
  targetCues: Cue[],
  baseMatched: Set<string>,
  targetMatched: Set<string>
): Array<{ base: Cue; target: Cue; similarity: number }> {
  const matches: Array<{ base: Cue; target: Cue; similarity: number }> = [];
  const SIMILARITY_THRESHOLD = 0.6;

  for (const baseCue of baseCues) {
    if (baseMatched.has(baseCue.id)) continue;

    let bestMatch: Cue | null = null;
    let bestScore = 0;

    for (const targetCue of targetCues) {
      if (targetMatched.has(targetCue.id)) continue;

      const similarity = calculateContentSimilarity(baseCue, targetCue);
      if (similarity >= SIMILARITY_THRESHOLD && similarity > bestScore) {
        bestMatch = targetCue;
        bestScore = similarity;
      }
    }

    if (bestMatch) {
      matches.push({ base: baseCue, target: bestMatch, similarity: bestScore });
      baseMatched.add(baseCue.id);
      targetMatched.add(bestMatch.id);
    }
  }

  return matches;
}

function getCueFieldDiffs(baseCue: Cue, targetCue: Cue): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  for (const field of COMPARE_FIELDS) {
    const oldVal = baseCue[field] ?? "";
    const newVal = targetCue[field] ?? "";

    if (oldVal !== newVal) {
      diffs.push({
        field: getFieldLabel(field),
        oldValue: oldVal || null,
        newValue: newVal || null,
      });
    }
  }

  return diffs;
}

function getFixtureDiffs(
  baseCue: Cue,
  targetCue: Cue,
  baseFixtures: LightFixture[],
  targetFixtures: LightFixture[]
): FixtureDiff[] {
  const diffs: FixtureDiff[] = [];

  const baseCueFixtures = parseCueFixtures(baseCue, baseFixtures);
  const targetCueFixtures = parseCueFixtures(targetCue, targetFixtures);

  const baseFixtureMap = new Map(baseCueFixtures.map((f) => [f.id, f]));
  const targetFixtureMap = new Map(targetCueFixtures.map((f) => [f.id, f]));

  const allFixtureIds = new Set([
    ...baseFixtureMap.keys(),
    ...targetFixtureMap.keys(),
  ]);

  for (const fixtureId of allFixtureIds) {
    const baseF = baseFixtureMap.get(fixtureId);
    const targetF = targetFixtureMap.get(fixtureId);

    if (!baseF || !targetF) continue;

    const fixtureDiff: FixtureDiff = {
      fixtureId,
      fixtureNumber: baseF.number,
    };

    const baseBrightness = parseCueBrightness(baseCue);
    const targetBrightness = parseCueBrightness(targetCue);

    if (baseBrightness !== targetBrightness) {
      fixtureDiff.brightnessDiff = {
        old: baseBrightness,
        new: targetBrightness,
      };
    }

    if (baseF.color !== targetF.color) {
      fixtureDiff.colorDiff = { old: baseF.color, new: targetF.color };
    }

    if (baseF.focus !== targetF.focus) {
      fixtureDiff.focusDiff = { old: baseF.focus, new: targetF.focus };
    }

    if (
      fixtureDiff.brightnessDiff ||
      fixtureDiff.colorDiff ||
      fixtureDiff.focusDiff
    ) {
      diffs.push(fixtureDiff);
    }
  }

  return diffs;
}

export function compareVersions(
  baseVersion: VersionSnapshot,
  targetVersion: VersionSnapshot
): CompareResult {
  const diffs: CueVersionDiff[] = [];
  const baseCues = baseVersion.cues;
  const targetCues = targetVersion.cues;
  const baseFixtures = baseVersion.fixtures;
  const targetFixtures = targetVersion.fixtures;

  const baseMatched = new Set<string>();
  const targetMatched = new Set<string>();

  for (let i = 0; i < baseCues.length; i++) {
    const baseCue = baseCues[i];
    const targetCue = targetCues.find((c) => c.id === baseCue.id);

    if (targetCue) {
      baseMatched.add(baseCue.id);
      targetMatched.add(targetCue.id);

      const fieldDiffs = getCueFieldDiffs(baseCue, targetCue);
      const fixtureDiffs = getFixtureDiffs(
        baseCue,
        targetCue,
        baseFixtures,
        targetFixtures
      );

      const baseIndex = i;
      const targetIndex = targetCues.findIndex((c) => c.id === baseCue.id);
      const orderChanged = baseIndex !== targetIndex;

      const isRenamed =
        fieldDiffs.some((d) => d.field === "number" || d.field === "sceneName") &&
        fieldDiffs.length <= 2;

      if (fieldDiffs.length > 0 || fixtureDiffs.length > 0 || orderChanged) {
        diffs.push({
          cueId: baseCue.id,
          cueNumber: targetCue.number || baseCue.number,
          diffType: orderChanged && fieldDiffs.length === 0 ? "orderChanged" : "modified",
          baseCue,
          targetCue,
          fieldDiffs,
          fixtureDiffs,
          orderChanged: orderChanged
            ? { oldIndex: baseIndex, newIndex: targetIndex }
            : undefined,
          isRenamed,
        });
      }
    }
  }

  const contentMatches = matchCuesByContent(
    baseCues,
    targetCues,
    baseMatched,
    targetMatched
  );

  for (const match of contentMatches) {
    const fieldDiffs = getCueFieldDiffs(match.base, match.target);
    const fixtureDiffs = getFixtureDiffs(
      match.base,
      match.target,
      baseFixtures,
      targetFixtures
    );

    const baseIndex = baseCues.findIndex((c) => c.id === match.base.id);
    const targetIndex = targetCues.findIndex((c) => c.id === match.target.id);
    const orderChanged = baseIndex !== targetIndex;

    diffs.push({
      cueId: match.target.id,
      cueNumber: match.target.number,
      diffType: "modified",
      baseCue: match.base,
      targetCue: match.target,
      fieldDiffs,
      fixtureDiffs,
      orderChanged: orderChanged
        ? { oldIndex: baseIndex, newIndex: targetIndex }
        : undefined,
      isRenamed: true,
      matchedByContent: true,
    });
  }

  for (const baseCue of baseCues) {
    if (!baseMatched.has(baseCue.id)) {
      diffs.push({
        cueId: baseCue.id,
        cueNumber: baseCue.number,
        diffType: "removed",
        baseCue,
        fieldDiffs: [],
      });
    }
  }

  for (const targetCue of targetCues) {
    if (!targetMatched.has(targetCue.id)) {
      diffs.push({
        cueId: targetCue.id,
        cueNumber: targetCue.number,
        diffType: "added",
        targetCue,
        fieldDiffs: [],
      });
    }
  }

  const fixturesAffected = new Set<string>();
  for (const diff of diffs) {
    if (diff.fixtureDiffs) {
      for (const fd of diff.fixtureDiffs) {
        fixturesAffected.add(fd.fixtureId);
      }
    }
    if (diff.targetCue) {
      const targetFixtureIds = parseCueFixtures(
        diff.targetCue,
        targetFixtures
      ).map((f) => f.id);
      targetFixtureIds.forEach((id) => fixturesAffected.add(id));
    }
    if (diff.baseCue) {
      const baseFixtureIds = parseCueFixtures(
        diff.baseCue,
        baseFixtures
      ).map((f) => f.id);
      baseFixtureIds.forEach((id) => fixturesAffected.add(id));
    }
  }

  return {
    baseVersion,
    targetVersion,
    diffs,
    summary: {
      totalAdded: diffs.filter((d) => d.diffType === "added").length,
      totalRemoved: diffs.filter((d) => d.diffType === "removed").length,
      totalModified: diffs.filter((d) => d.diffType === "modified").length,
      totalOrderChanged: diffs.filter((d) => d.orderChanged !== undefined).length,
      fixturesAffected: Array.from(fixturesAffected),
    },
  };
}

export function createVersionSnapshot(
  name: string,
  description: string,
  cues: Cue[],
  fixtures: LightFixture[]
): VersionSnapshot {
  return {
    id: `snapshot-${Date.now()}`,
    name,
    description,
    createdAt: new Date().toISOString(),
    cues: JSON.parse(JSON.stringify(cues)),
    fixtures: JSON.parse(JSON.stringify(fixtures)),
    dataVersion: 1,
  };
}

export function normalizeCueData(cue: any): Cue {
  const normalized: Cue = {
    id: cue.id || `cue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    number: cue.number || cue.cueNumber || "",
    sceneName: cue.sceneName || cue.scene || "",
    fixtures: cue.fixtures || cue.fixtureIds || "",
    brightnessChange: cue.brightnessChange || cue.brightness || "",
    triggerNote: cue.triggerNote || cue.trigger || "",
    versionNote: cue.versionNote || cue.version || "",
  };

  if (typeof cue.brightness === "number") {
    normalized.brightnessChange = `亮度${cue.brightness}%`;
  }

  return normalized;
}

export function normalizeVersionSnapshot(snapshot: any): VersionSnapshot {
  return {
    id: snapshot.id || `snapshot-${Date.now()}`,
    name: snapshot.name || snapshot.versionName || "未命名版本",
    createdAt: snapshot.createdAt || snapshot.timestamp || new Date().toISOString(),
    description: snapshot.description || snapshot.notes || "",
    cues: Array.isArray(snapshot.cues)
      ? snapshot.cues.map(normalizeCueData)
      : [],
    fixtures: Array.isArray(snapshot.fixtures) ? snapshot.fixtures : FIXTURES,
    dataVersion: snapshot.dataVersion || 1,
  };
}

export type FixtureChangeType = "turnedOn" | "turnedOff" | "brightened" | "dimmed" | "added" | "removed" | "unchanged";

export interface FixtureCueState {
  fixtureId: string;
  fixtureNumber: string;
  channel: string;
  type: LightType;
  brightness: number | null;
  color: string;
  focus: string;
  notes: string;
  matched: boolean;
}

export interface FixtureTransition {
  fixtureId: string;
  fixtureNumber: string;
  channel: string;
  type: LightType;
  fromState: FixtureCueState | null;
  toState: FixtureCueState | null;
  changeTypes: FixtureChangeType[];
  brightnessDelta: number | null;
}

export interface CueComparisonResult {
  prevCue: Cue | null;
  currentCue: Cue;
  nextCue: Cue | null;
  prevTransitions: FixtureTransition[];
  nextTransitions: FixtureTransition[];
  summary: {
    turnedOnCount: number;
    turnedOffCount: number;
    brightenedCount: number;
    dimmedCount: number;
    addedCount: number;
    removedCount: number;
    currentCueUnmatched: boolean;
    nextCueUnmatched: boolean;
  };
}

function getFixtureCueState(cue: Cue | null, fixture: LightFixture): FixtureCueState {
  if (!cue) {
    return {
      fixtureId: fixture.id,
      fixtureNumber: fixture.number,
      channel: fixture.channel,
      type: fixture.type,
      brightness: null,
      color: fixture.color,
      focus: fixture.focus,
      notes: fixture.notes,
      matched: false,
    };
  }

  const cueFixtures = parseCueFixtures(cue, [fixture]);
  const isMatched = cueFixtures.length > 0;
  const cueBrightness = parseCueBrightness(cue);

  return {
    fixtureId: fixture.id,
    fixtureNumber: fixture.number,
    channel: fixture.channel,
    type: fixture.type,
    brightness: isMatched ? (cueBrightness ?? fixture.brightness) : null,
    color: fixture.color,
    focus: fixture.focus,
    notes: fixture.notes,
    matched: isMatched,
  };
}

function getCueAllFixturesState(cue: Cue | null, allFixtures: LightFixture[]): Map<string, FixtureCueState> {
  const stateMap = new Map<string, FixtureCueState>();
  for (const f of allFixtures) {
    stateMap.set(f.id, getFixtureCueState(cue, f));
  }
  return stateMap;
}

function isCueUnmatched(cue: Cue, allFixtures: LightFixture[]): boolean {
  if (!cue.fixtures || !cue.fixtures.trim()) return false;
  const matched = parseCueFixtures(cue, allFixtures);
  return matched.length === 0;
}

function determineChangeTypes(from: FixtureCueState | null, to: FixtureCueState | null): FixtureChangeType[] {
  const changes: FixtureChangeType[] = [];

  const fromMatched = from?.matched ?? false;
  const toMatched = to?.matched ?? false;
  const fromBrightness = from?.brightness ?? null;
  const toBrightness = to?.brightness ?? null;

  if (!fromMatched && toMatched) {
    if (toBrightness !== null && toBrightness > 0) {
      changes.push("turnedOn");
    } else if (toBrightness !== null && toBrightness === 0) {
      changes.push("added");
    } else {
      changes.push("added");
    }
  } else if (fromMatched && !toMatched) {
    changes.push("removed");
  } else if (fromMatched && toMatched) {
    if (fromBrightness !== null && fromBrightness === 0 && toBrightness !== null && toBrightness > 0) {
      changes.push("turnedOn");
    } else if (fromBrightness !== null && fromBrightness > 0 && toBrightness !== null && toBrightness === 0) {
      changes.push("turnedOff");
    } else if (fromBrightness !== null && toBrightness !== null && fromBrightness > 0 && toBrightness > 0) {
      if (toBrightness > fromBrightness) {
        changes.push("brightened");
      } else if (toBrightness < fromBrightness) {
        changes.push("dimmed");
      }
    }
  }

  if (changes.length === 0) {
    changes.push("unchanged");
  }

  return changes;
}

function calculateBrightnessDelta(from: FixtureCueState | null, to: FixtureCueState | null): number | null {
  const fromBrightness = from?.brightness;
  const toBrightness = to?.brightness;

  if (fromBrightness == null || toBrightness == null) return null;
  return toBrightness - fromBrightness;
}

function buildTransitions(
  fromCue: Cue | null,
  toCue: Cue,
  allFixtures: LightFixture[]
): FixtureTransition[] {
  const fromStates = getCueAllFixturesState(fromCue, allFixtures);
  const toStates = getCueAllFixturesState(toCue, allFixtures);
  const transitions: FixtureTransition[] = [];

  const allFixtureIds = new Set([...fromStates.keys(), ...toStates.keys()]);

  for (const fixtureId of allFixtureIds) {
    const fromState = fromStates.get(fixtureId) ?? null;
    const toState = toStates.get(fixtureId) ?? null;

    if (!toState) continue;

    const changeTypes = determineChangeTypes(fromState, toState);
    const brightnessDelta = calculateBrightnessDelta(fromState, toState);

    transitions.push({
      fixtureId,
      fixtureNumber: toState.fixtureNumber,
      channel: toState.channel,
      type: toState.type,
      fromState,
      toState,
      changeTypes,
      brightnessDelta,
    });
  }

  return transitions;
}

export function compareAdjacentCues(
  currentCue: Cue,
  allCues: Cue[],
  allFixtures: LightFixture[]
): CueComparisonResult {
  const currentIndex = allCues.findIndex((c) => c.id === currentCue.id);
  const prevCue = currentIndex > 0 ? allCues[currentIndex - 1] : null;
  const nextCue = currentIndex >= 0 && currentIndex < allCues.length - 1 ? allCues[currentIndex + 1] : null;

  const prevTransitions = prevCue ? buildTransitions(prevCue, currentCue, allFixtures) : [];
  const nextTransitions = nextCue ? buildTransitions(currentCue, nextCue, allFixtures) : [];

  const countChanges = (transitions: FixtureTransition[], type: FixtureChangeType) =>
    transitions.filter((t) => t.changeTypes.includes(type) && (t.toState?.matched || t.fromState?.matched)).length;

  return {
    prevCue,
    currentCue,
    nextCue,
    prevTransitions,
    nextTransitions,
    summary: {
      turnedOnCount: countChanges(prevTransitions, "turnedOn"),
      turnedOffCount: countChanges(prevTransitions, "turnedOff"),
      brightenedCount: countChanges(prevTransitions, "brightened"),
      dimmedCount: countChanges(prevTransitions, "dimmed"),
      addedCount: countChanges(prevTransitions, "added"),
      removedCount: countChanges(prevTransitions, "removed"),
      currentCueUnmatched: isCueUnmatched(currentCue, allFixtures),
      nextCueUnmatched: nextCue ? isCueUnmatched(nextCue, allFixtures) : false,
    },
  };
}

export function buildFixturesString(fixtureIds: string[], allFixtures: LightFixture[] = FIXTURES): string {
  if (fixtureIds.length === 0) return "";

  const selectedFixtures = allFixtures.filter((f) => fixtureIds.includes(f.id));
  if (selectedFixtures.length === 0) return "";

  if (selectedFixtures.length === allFixtures.length) {
    return "全台灯具";
  }

  const selectedByType: Record<LightType, LightFixture[]> = {
    面光: [],
    侧光: [],
    逆光: [],
    效果光: [],
  };
  for (const f of selectedFixtures) {
    selectedByType[f.type].push(f);
  }

  const allByType: Record<LightType, LightFixture[]> = {
    面光: [],
    侧光: [],
    逆光: [],
    效果光: [],
  };
  for (const f of allFixtures) {
    allByType[f.type].push(f);
  }

  const completeTypes: LightType[] = [];
  const partialFixtures: LightFixture[] = [];

  const TYPES: LightType[] = ["面光", "侧光", "逆光", "效果光"];
  for (const t of TYPES) {
    if (selectedByType[t].length === 0) continue;
    if (selectedByType[t].length === allByType[t].length) {
      completeTypes.push(t);
    } else {
      partialFixtures.push(...selectedByType[t]);
    }
  }

  const parts: string[] = [];

  for (const t of completeTypes) {
    parts.push(t);
  }

  if (partialFixtures.length > 0) {
    const sorted = [...partialFixtures].sort((a, b) => {
      const aNum = parseInt(a.number.replace(/\D/g, ""), 10) || 0;
      const bNum = parseInt(b.number.replace(/\D/g, ""), 10) || 0;
      if (aNum !== bNum) return aNum - bNum;
      return a.number.localeCompare(b.number);
    });
    parts.push(sorted.map((f) => f.number).join("、"));
  }

  return parts.join(" + ");
}
