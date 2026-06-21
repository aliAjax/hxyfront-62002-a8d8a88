import { useState, useCallback, useMemo, useEffect } from "react";
import {
  type CollaborationSession,
  type Conflict,
  type ResolutionChoice,
  type EditorState,
  type ConflictType,
  createCollaborationSession,
  detectConflicts,
  getConflictId,
  mergeStates,
  generateSampleConflicts,
} from "../data/collaboration";
import { type LightFixture, LIGHT_TYPE_COLORS } from "../data/fixtures";
import { type Cue } from "../data/cues";
import { type VersionNote } from "../data/versionNotes";
import { StagePlan } from "./StagePlan";
import { CueList } from "./CueList";
import { VersionNotesPanel } from "./VersionNotesPanel";

interface Props {
  baseFixtures: LightFixture[];
  baseCues: Cue[];
  baseVersionNotes: VersionNote[];
  onMergeComplete: (result: {
    fixtures: LightFixture[];
    cues: Cue[];
    versionNotes: VersionNote[];
  }) => void;
  onClose?: () => void;
}

const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  fixtureBrightness: "灯具亮度",
  cueField: "Cue属性",
  cueOrder: "Cue顺序",
  newCue: "新增Cue",
  removedCue: "删除Cue",
  versionNote: "版本备注",
};

const CONFLICT_TYPE_COLORS: Record<ConflictType, string> = {
  fixtureBrightness: "#ef4444",
  cueField: "#f59e0b",
  cueOrder: "#8b5cf6",
  newCue: "#059669",
  removedCue: "#dc2626",
  versionNote: "#06b6d4",
};

export function CollaborationConflictSimulator({
  baseFixtures,
  baseCues,
  baseVersionNotes,
  onMergeComplete,
  onClose,
}: Props) {
  const [session, setSession] = useState<CollaborationSession>(() =>
    createCollaborationSession(baseFixtures, baseCues, baseVersionNotes)
  );
  const [activeTab, setActiveTab] = useState<"edit" | "resolve">("edit");
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(null);
  const [conflictFilter, setConflictFilter] = useState<ConflictType | "all">("all");
  const [showSampleData, setShowSampleData] = useState(false);

  const filteredConflicts = useMemo(() => {
    if (conflictFilter === "all") return session.conflicts;
    return session.conflicts.filter((c) => c.type === conflictFilter);
  }, [session.conflicts, conflictFilter]);

  const unresolvedCount = useMemo(() => {
    return session.conflicts.filter(
      (c) => !session.resolutions.has(getConflictId(c))
    ).length;
  }, [session.conflicts, session.resolutions]);

  const resolvedCount = session.conflicts.length - unresolvedCount;

  const handleLoadSampleData = useCallback(() => {
    setSession((prev) => generateSampleConflicts(prev));
    setShowSampleData(true);
  }, []);

  const handleDetectConflicts = useCallback(() => {
    const result = detectConflicts(
      session.baseState,
      session.leftEditor,
      session.rightEditor
    );
    setSession((prev) => ({
      ...prev,
      conflicts: result.conflicts,
      status: "resolving",
    }));
    setActiveTab("resolve");
    if (result.conflicts.length > 0) {
      setSelectedConflictId(getConflictId(result.conflicts[0]));
    }
  }, [session.baseState, session.leftEditor, session.rightEditor]);

  const handleResolution = useCallback(
    (conflict: Conflict, choice: ResolutionChoice, manualValue?: any) => {
      const conflictId = getConflictId(conflict);
      setSession((prev) => {
        const newResolutions = new Map(prev.resolutions);
        newResolutions.set(conflictId, { conflict, choice, manualValue });
        return { ...prev, resolutions: newResolutions };
      });
    },
    []
  );

  const handleClearResolution = useCallback((conflict: Conflict) => {
    const conflictId = getConflictId(conflict);
    setSession((prev) => {
      const newResolutions = new Map(prev.resolutions);
      newResolutions.delete(conflictId);
      return { ...prev, resolutions: newResolutions };
    });
  }, []);

  const handleResolveAll = useCallback((choice: ResolutionChoice) => {
    setSession((prev) => {
      const newResolutions = new Map(prev.resolutions);
      for (const conflict of prev.conflicts) {
        const conflictId = getConflictId(conflict);
        newResolutions.set(conflictId, { conflict, choice });
      }
      return { ...prev, resolutions: newResolutions };
    });
  }, []);

  const handleMerge = useCallback(() => {
    if (unresolvedCount > 0) {
      alert(`还有 ${unresolvedCount} 个冲突未解决，请先完成所有冲突的处理。`);
      return;
    }

    const result = mergeStates(
      session.baseState,
      session.leftEditor,
      session.rightEditor,
      session.resolutions
    );

    setSession((prev) => ({
      ...prev,
      status: "merged",
      mergedState: {
        fixtures: result.fixtures,
        cues: result.cues,
        versionNotes: result.versionNotes,
      },
    }));
  }, [session, unresolvedCount]);

  const handleApplyMerge = useCallback(() => {
    if (session.mergedState) {
      onMergeComplete(session.mergedState);
    }
  }, [session.mergedState, onMergeComplete]);

  const handleReset = useCallback(() => {
    setSession(
      createCollaborationSession(baseFixtures, baseCues, baseVersionNotes)
    );
    setActiveTab("edit");
    setSelectedConflictId(null);
    setShowSampleData(false);
  }, [baseFixtures, baseCues, baseVersionNotes]);

  const handleUpdateEditorFixture = useCallback(
    (side: "left" | "right", fixtureId: string, updates: Partial<LightFixture>) => {
      setSession((prev) => {
        const editor = side === "left" ? prev.leftEditor : prev.rightEditor;
        const fixtures = editor.fixtures.map((f) =>
          f.id === fixtureId ? { ...f, ...updates } : f
        );
        return {
          ...prev,
          [side === "left" ? "leftEditor" : "rightEditor"]: {
            ...editor,
            fixtures,
          },
          status: "editing",
          conflicts: [],
          resolutions: new Map(),
        };
      });
    },
    []
  );

  const handleUpdateEditorCue = useCallback(
    (side: "left" | "right", cueId: string, updates: Partial<Cue>) => {
      setSession((prev) => {
        const editor = side === "left" ? prev.leftEditor : prev.rightEditor;
        const cues = editor.cues.map((c) =>
          c.id === cueId ? { ...c, ...updates } : c
        );
        return {
          ...prev,
          [side === "left" ? "leftEditor" : "rightEditor"]: {
            ...editor,
            cues,
          },
          status: "editing",
          conflicts: [],
          resolutions: new Map(),
        };
      });
    },
    []
  );

  const handleReorderEditorCues = useCallback(
    (side: "left" | "right", newCues: Cue[]) => {
      setSession((prev) => {
        const editor = side === "left" ? prev.leftEditor : prev.rightEditor;
        return {
          ...prev,
          [side === "left" ? "leftEditor" : "rightEditor"]: {
            ...editor,
            cues: newCues,
          },
          status: "editing",
          conflicts: [],
          resolutions: new Map(),
        };
      });
    },
    []
  );

  const handleUpdateEditorVersionNotes = useCallback(
    (side: "left" | "right", notes: VersionNote[]) => {
      setSession((prev) => {
        const editor = side === "left" ? prev.leftEditor : prev.rightEditor;
        return {
          ...prev,
          [side === "left" ? "leftEditor" : "rightEditor"]: {
            ...editor,
            versionNotes: notes,
          },
          status: "editing",
          conflicts: [],
          resolutions: new Map(),
        };
      });
    },
    []
  );

  const selectedConflict = useMemo(() => {
    if (!selectedConflictId) return null;
    return session.conflicts.find((c) => getConflictId(c) === selectedConflictId) || null;
  }, [session.conflicts, selectedConflictId]);

  const renderConflictItem = (conflict: Conflict) => {
    const conflictId = getConflictId(conflict);
    const isResolved = session.resolutions.has(conflictId);
    const isSelected = selectedConflictId === conflictId;
    const resolution = session.resolutions.get(conflictId);

    return (
      <div
        key={conflictId}
        className={`collab-conflict-item ${isSelected ? "selected" : ""} ${isResolved ? "resolved" : ""}`}
        onClick={() => setSelectedConflictId(conflictId)}
      >
        <div className="collab-conflict-item-header">
          <span
            className="collab-conflict-type-badge"
            style={{
              background: CONFLICT_TYPE_COLORS[conflict.type],
              borderColor: CONFLICT_TYPE_COLORS[conflict.type],
            }}
          >
            {CONFLICT_TYPE_LABELS[conflict.type]}
          </span>
          {isResolved && (
            <span className="collab-conflict-resolved-badge">
              {resolution?.choice === "keepLeft"
                ? "保留左侧"
                : resolution?.choice === "keepRight"
                ? "保留右侧"
                : "手动合并"}
            </span>
          )}
        </div>
        <div className="collab-conflict-item-title">
          {conflict.type === "fixtureBrightness" && (
            <>
              <span className="collab-conflict-fixture-number">{conflict.fixtureNumber}</span>
              <span className="collab-conflict-desc">亮度冲突</span>
            </>
          )}
          {conflict.type === "cueField" && (
            <>
              <span className="collab-conflict-cue-number">{conflict.cueNumber}</span>
              <span className="collab-conflict-desc">{conflict.fieldLabel}冲突</span>
            </>
          )}
          {conflict.type === "cueOrder" && (
            <>
              <span className="collab-conflict-cue-number">{conflict.cueNumber}</span>
              <span className="collab-conflict-desc">顺序冲突</span>
            </>
          )}
          {conflict.type === "newCue" && (
            <>
              <span className="collab-conflict-cue-number">{conflict.cue.number}</span>
              <span className="collab-conflict-desc">
                {conflict.side === "left" ? session.leftEditor.editorName : session.rightEditor.editorName} 新增
              </span>
            </>
          )}
          {conflict.type === "removedCue" && (
            <>
              <span className="collab-conflict-cue-number">{conflict.baseCue.number}</span>
              <span className="collab-conflict-desc">
                {conflict.side === "left" ? session.leftEditor.editorName : session.rightEditor.editorName} 删除
              </span>
            </>
          )}
          {conflict.type === "versionNote" && (
            <>
              <span className="collab-conflict-desc">版本备注 - {conflict.field} 冲突</span>
            </>
          )}
        </div>
        {conflict.type === "fixtureBrightness" && (
          <div className="collab-conflict-values">
            <span className="collab-value-left">{conflict.leftBrightness}%</span>
            <span className="collab-value-vs">vs</span>
            <span className="collab-value-right">{conflict.rightBrightness}%</span>
          </div>
        )}
        {conflict.type === "cueField" && (
          <div className="collab-conflict-values">
            <span className="collab-value-left">{conflict.leftValue || "(空)"}</span>
            <span className="collab-value-vs">vs</span>
            <span className="collab-value-right">{conflict.rightValue || "(空)"}</span>
          </div>
        )}
        {conflict.type === "cueOrder" && (
          <div className="collab-conflict-values">
            <span className="collab-value-left">位置 {conflict.leftIndex + 1}</span>
            <span className="collab-value-vs">vs</span>
            <span className="collab-value-right">位置 {conflict.rightIndex + 1}</span>
          </div>
        )}
      </div>
    );
  };

  const renderConflictDetail = () => {
    if (!selectedConflict) {
      return (
        <div className="collab-conflict-detail-empty">
          <p>请从左侧列表选择一个冲突查看详情</p>
        </div>
      );
    }

    const conflictId = getConflictId(selectedConflict);
    const resolution = session.resolutions.get(conflictId);

    return (
      <div className="collab-conflict-detail">
        <div className="collab-conflict-detail-header">
          <span
            className="collab-conflict-type-badge large"
            style={{
              background: CONFLICT_TYPE_COLORS[selectedConflict.type],
              borderColor: CONFLICT_TYPE_COLORS[selectedConflict.type],
            }}
          >
            {CONFLICT_TYPE_LABELS[selectedConflict.type]}
          </span>
          {resolution && (
            <button
              className="collab-clear-resolution-btn"
              onClick={() => handleClearResolution(selectedConflict)}
            >
              清除选择
            </button>
          )}
        </div>

        <h3 className="collab-conflict-detail-title">
          {selectedConflict.type === "fixtureBrightness" &&
            `${selectedConflict.fixtureNumber} 亮度冲突`}
          {selectedConflict.type === "cueField" &&
            `${selectedConflict.cueNumber} - ${selectedConflict.fieldLabel}冲突`}
          {selectedConflict.type === "cueOrder" &&
            `${selectedConflict.cueNumber} 顺序冲突`}
          {selectedConflict.type === "newCue" &&
            `新增Cue: ${selectedConflict.cue.number} - ${selectedConflict.cue.sceneName}`}
          {selectedConflict.type === "removedCue" &&
            `删除Cue: ${selectedConflict.baseCue.number} - ${selectedConflict.baseCue.sceneName}`}
          {selectedConflict.type === "versionNote" &&
            `版本备注 - ${selectedConflict.field} 冲突`}
        </h3>

        <div className="collab-conflict-side-by-side">
          <div className="collab-conflict-side left">
            <div
              className="collab-conflict-side-header"
              style={{ borderColor: session.leftEditor.editorColor }}
            >
              <span
                className="collab-conflict-side-color"
                style={{ background: session.leftEditor.editorColor }}
              />
              <span className="collab-conflict-side-name">
                {session.leftEditor.editorName}
              </span>
            </div>
            <div className="collab-conflict-side-content">
              {selectedConflict.type === "fixtureBrightness" && (
                <div className="collab-brightness-display">
                  <div className="collab-brightness-bar-wrapper">
                    <div
                      className="collab-brightness-bar"
                      style={{
                        width: `${selectedConflict.leftBrightness}%`,
                        background: LIGHT_TYPE_COLORS[selectedConflict.fixtureType as keyof typeof LIGHT_TYPE_COLORS] || "#7c3aed",
                      }}
                    />
                  </div>
                  <span className="collab-brightness-value">
                    {selectedConflict.leftBrightness}%
                  </span>
                </div>
              )}
              {selectedConflict.type === "cueField" && (
                <p className="collab-field-value">
                  {selectedConflict.leftValue || "(空)"}
                </p>
              )}
              {selectedConflict.type === "cueOrder" && (
                <p className="collab-field-value">
                  位置: {selectedConflict.leftIndex + 1}
                </p>
              )}
              {selectedConflict.type === "newCue" && selectedConflict.side === "left" && (
                <div className="collab-cue-preview">
                  <p><strong>场景:</strong> {selectedConflict.cue.sceneName}</p>
                  <p><strong>灯具:</strong> {selectedConflict.cue.fixtures}</p>
                  <p><strong>亮度:</strong> {selectedConflict.cue.brightnessChange}</p>
                  <p><strong>触发:</strong> {selectedConflict.cue.triggerNote}</p>
                </div>
              )}
              {selectedConflict.type === "removedCue" && selectedConflict.side === "left" && (
                <p className="collab-removed-note">此Cue已被删除</p>
              )}
              {selectedConflict.type === "versionNote" && (
                <p className="collab-field-value">
                  {String(selectedConflict.leftValue) || "(空)"}
                </p>
              )}
            </div>
          </div>

          <div className="collab-conflict-vs">
            <span>VS</span>
          </div>

          <div className="collab-conflict-side right">
            <div
              className="collab-conflict-side-header"
              style={{ borderColor: session.rightEditor.editorColor }}
            >
              <span
                className="collab-conflict-side-color"
                style={{ background: session.rightEditor.editorColor }}
              />
              <span className="collab-conflict-side-name">
                {session.rightEditor.editorName}
              </span>
            </div>
            <div className="collab-conflict-side-content">
              {selectedConflict.type === "fixtureBrightness" && (
                <div className="collab-brightness-display">
                  <div className="collab-brightness-bar-wrapper">
                    <div
                      className="collab-brightness-bar"
                      style={{
                        width: `${selectedConflict.rightBrightness}%`,
                        background: LIGHT_TYPE_COLORS[selectedConflict.fixtureType as keyof typeof LIGHT_TYPE_COLORS] || "#7c3aed",
                      }}
                    />
                  </div>
                  <span className="collab-brightness-value">
                    {selectedConflict.rightBrightness}%
                  </span>
                </div>
              )}
              {selectedConflict.type === "cueField" && (
                <p className="collab-field-value">
                  {selectedConflict.rightValue || "(空)"}
                </p>
              )}
              {selectedConflict.type === "cueOrder" && (
                <p className="collab-field-value">
                  位置: {selectedConflict.rightIndex + 1}
                </p>
              )}
              {selectedConflict.type === "newCue" && selectedConflict.side === "right" && (
                <div className="collab-cue-preview">
                  <p><strong>场景:</strong> {selectedConflict.cue.sceneName}</p>
                  <p><strong>灯具:</strong> {selectedConflict.cue.fixtures}</p>
                  <p><strong>亮度:</strong> {selectedConflict.cue.brightnessChange}</p>
                  <p><strong>触发:</strong> {selectedConflict.cue.triggerNote}</p>
                </div>
              )}
              {selectedConflict.type === "removedCue" && selectedConflict.side === "right" && (
                <p className="collab-removed-note">此Cue已被删除</p>
              )}
              {selectedConflict.type === "versionNote" && (
                <p className="collab-field-value">
                  {String(selectedConflict.rightValue) || "(空)"}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="collab-conflict-actions">
          <button
            className={`collab-action-btn left ${resolution?.choice === "keepLeft" ? "active" : ""}`}
            style={{
              borderColor: session.leftEditor.editorColor,
              background: resolution?.choice === "keepLeft" ? session.leftEditor.editorColor : "transparent",
              color: resolution?.choice === "keepLeft" ? "#fff" : session.leftEditor.editorColor,
            }}
            onClick={() => handleResolution(selectedConflict, "keepLeft")}
          >
            ✓ 保留{session.leftEditor.editorName}的修改
          </button>
          <button
            className={`collab-action-btn right ${resolution?.choice === "keepRight" ? "active" : ""}`}
            style={{
              borderColor: session.rightEditor.editorColor,
              background: resolution?.choice === "keepRight" ? session.rightEditor.editorColor : "transparent",
              color: resolution?.choice === "keepRight" ? "#fff" : session.rightEditor.editorColor,
            }}
            onClick={() => handleResolution(selectedConflict, "keepRight")}
          >
            ✓ 保留{session.rightEditor.editorName}的修改
          </button>
          <button
            className={`collab-action-btn manual ${resolution?.choice === "manual" ? "active" : ""}`}
            onClick={() => {
              if (selectedConflict.type === "fixtureBrightness") {
                const avg = Math.round((selectedConflict.leftBrightness + selectedConflict.rightBrightness) / 2);
                handleResolution(selectedConflict, "manual", avg);
              } else if (selectedConflict.type === "cueField") {
                const combined = `${selectedConflict.leftValue} | ${selectedConflict.rightValue}`;
                handleResolution(selectedConflict, "manual", combined);
              } else if (selectedConflict.type === "cueOrder") {
                const avgIndex = Math.round((selectedConflict.leftIndex + selectedConflict.rightIndex) / 2);
                handleResolution(selectedConflict, "manual", avgIndex);
              } else if (selectedConflict.type === "newCue") {
                handleResolution(selectedConflict, "manual", true);
              } else if (selectedConflict.type === "removedCue") {
                handleResolution(selectedConflict, "manual", true);
              } else if (selectedConflict.type === "versionNote") {
                const combined = `${selectedConflict.leftValue} | ${selectedConflict.rightValue}`;
                handleResolution(selectedConflict, "manual", combined);
              }
            }}
          >
            ✎ 手动合并
          </button>
        </div>

        {resolution?.choice === "manual" && (
          <div className="collab-manual-resolution">
            <p className="collab-manual-label">合并后的值:</p>
            <p className="collab-manual-value">
              {selectedConflict.type === "fixtureBrightness" && `${resolution.manualValue}%`}
              {selectedConflict.type === "cueField" && resolution.manualValue}
              {selectedConflict.type === "cueOrder" && `位置 ${resolution.manualValue + 1}`}
              {selectedConflict.type === "newCue" && "保留此新增Cue"}
              {selectedConflict.type === "removedCue" && "确认删除此Cue"}
              {selectedConflict.type === "versionNote" && resolution.manualValue}
            </p>
          </div>
        )}

        {selectedConflict.type !== "newCue" && selectedConflict.type !== "removedCue" && (
          <div className="collab-base-value">
            <span className="collab-base-label">原始值:</span>
            <span className="collab-base-text">
              {selectedConflict.type === "fixtureBrightness" && `${selectedConflict.baseBrightness}%`}
              {selectedConflict.type === "cueField" && (selectedConflict.baseValue || "(空)")}
              {selectedConflict.type === "cueOrder" && `位置 ${selectedConflict.baseIndex + 1}`}
              {selectedConflict.type === "versionNote" && String(selectedConflict.baseValue)}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderEditorPanel = (side: "left" | "right") => {
    const editor = side === "left" ? session.leftEditor : session.rightEditor;
    const [selectedFixtureIds, setSelectedFixtureIds] = useState<Set<string>>(new Set());
    const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
    const [cueViewMode, setCueViewMode] = useState<"list" | "timeline">("list");

    return (
      <div className={`collab-editor-panel ${side}`}>
        <div
          className="collab-editor-header"
          style={{ borderColor: editor.editorColor }}
        >
          <div className="collab-editor-info">
            <span
              className="collab-editor-color-dot"
              style={{ background: editor.editorColor }}
            />
            <h3>{editor.editorName}</h3>
          </div>
          <div className="collab-editor-stats">
            <span>{editor.fixtures.length} 台灯具</span>
            <span>{editor.cues.length} 个Cue</span>
          </div>
        </div>

        <div className="collab-editor-section">
          <h4 className="collab-section-title">灯位布局</h4>
          <div className="collab-mini-stage">
            <svg viewBox="0 0 900 400" className="collab-mini-stage-svg">
              <rect x="0" y="0" width="900" height="400" fill="#f8fafc" />
              <rect x="100" y="30" width="700" height="300" rx="4" fill="url(#grid)" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 2" />
              {editor.fixtures.map((fixture) => {
                const color = LIGHT_TYPE_COLORS[fixture.type];
                const isOff = fixture.brightness === 0;
                const radius = isOff ? 6 : 8 + (fixture.brightness / 100) * 3;
                const scaleY = 400 / 600;
                const y = fixture.y * scaleY * 0.6 + 30;
                const x = fixture.x * 0.8 + 100;

                return (
                  <g
                    key={fixture.id}
                    className="collab-mini-fixture"
                    onClick={() => {
                      const val = prompt(
                        `设置 ${fixture.number} 的亮度 (0-100):`,
                        String(fixture.brightness)
                      );
                      if (val !== null) {
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num >= 0 && num <= 100) {
                          handleUpdateEditorFixture(side, fixture.id, { brightness: num });
                        }
                      }
                    }}
                  >
                    {fixture.brightness > 0 && (
                      <circle cx={x} cy={y} r={radius + 4} fill={color} opacity={fixture.brightness / 300} />
                    )}
                    <circle
                      cx={x}
                      cy={y}
                      r={radius}
                      fill={isOff ? "#e2e8f0" : color}
                      stroke="transparent"
                      strokeWidth="0"
                      opacity={isOff ? 0.5 : 1}
                    />
                    <text x={x} y={y - radius - 4} textAnchor="middle" fill="#334155" fontSize="8" fontWeight="600">
                      {fixture.number}
                    </text>
                    <text x={x} y={y + radius + 10} textAnchor="middle" fill={isOff ? "#94a3b8" : color} fontSize="7" fontWeight="600">
                      {fixture.brightness}%
                    </text>
                  </g>
                );
              })}
            </svg>
            <p className="collab-mini-hint">点击灯具修改亮度</p>
          </div>
        </div>

        <div className="collab-editor-section">
          <h4 className="collab-section-title">Cue列表</h4>
          <div className="collab-mini-cue-list">
            {editor.cues.map((cue, index) => (
              <div
                key={cue.id}
                className="collab-mini-cue-item"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", cue.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const draggedId = e.dataTransfer.getData("text/plain");
                  const draggedIndex = editor.cues.findIndex((c) => c.id === draggedId);
                  const targetIndex = index;
                  if (draggedIndex !== -1 && draggedIndex !== targetIndex) {
                    const newCues = [...editor.cues];
                    const [removed] = newCues.splice(draggedIndex, 1);
                    newCues.splice(targetIndex, 0, removed);
                    handleReorderEditorCues(side, newCues);
                  }
                }}
                onClick={() => {
                  const field = prompt(
                    `编辑 ${cue.number} 的亮度变化:`,
                    cue.brightnessChange
                  );
                  if (field !== null) {
                    handleUpdateEditorCue(side, cue.id, { brightnessChange: field });
                  }
                }}
              >
                <span className="collab-mini-cue-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="collab-mini-cue-info">
                  <span className="collab-mini-cue-number">{cue.number}</span>
                  <span className="collab-mini-cue-brightness">{cue.brightnessChange}</span>
                </div>
                <span className="collab-mini-cue-drag">⋮⋮</span>
              </div>
            ))}
          </div>
          <p className="collab-mini-hint">点击修改亮度，拖拽调整顺序</p>
        </div>

        <div className="collab-editor-section">
          <h4 className="collab-section-title">版本备注</h4>
          <div className="collab-mini-version-notes">
            {editor.versionNotes.slice(0, 1).map((note) => (
              <div
                key={note.id}
                className="collab-mini-version-note"
                onClick={() => {
                  const reason = prompt(
                    `编辑调整原因:`,
                    note.adjustmentReason
                  );
                  if (reason !== null) {
                    handleUpdateEditorVersionNotes(side,
                      editor.versionNotes.map((n) =>
                        n.id === note.id ? { ...n, adjustmentReason: reason } : n
                      )
                    );
                  }
                }}
              >
                <p className="collab-mini-version-name">{note.versionName}</p>
                <p className="collab-mini-version-reason">{note.adjustmentReason}</p>
              </div>
            ))}
          </div>
          <p className="collab-mini-hint">点击编辑版本备注</p>
        </div>
      </div>
    );
  };

  const renderMergedPreview = () => {
    if (!session.mergedState) return null;

    return (
      <div className="collab-merged-preview">
        <div className="collab-merged-header">
          <div className="collab-merged-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h3>合并完成！</h3>
            <p>所有冲突已解决，以下是合并后的结果预览</p>
          </div>
        </div>

        <div className="collab-merged-sections">
          <div className="collab-merged-section">
            <h4>灯位布局</h4>
            <StagePlan
              fixtures={session.mergedState.fixtures}
              selectedFixtureIds={new Set()}
              onToggleFixtureSelection={() => {}}
            />
          </div>

          <div className="collab-merged-section">
            <h4>Cue列表</h4>
            <CueList
              cues={session.mergedState.cues}
              onAdd={() => {}}
              onEdit={() => {}}
              selectedCueId={null}
              onSelect={() => {}}
              fixtures={session.mergedState.fixtures}
              showHeader={false}
            />
          </div>

          <div className="collab-merged-section">
            <h4>版本备注</h4>
            <VersionNotesPanel
              notes={session.mergedState.versionNotes}
              onChange={() => {}}
            />
          </div>
        </div>

        <div className="collab-merged-actions">
          <button className="collab-merged-btn secondary" onClick={handleReset}>
            重新开始
          </button>
          <button className="collab-merged-btn primary" onClick={handleApplyMerge}>
            ✓ 应用合并结果到主应用
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="collab-simulator-module">
      <div className="collab-simulator-header">
        <div>
          <p className="collab-simulator-label">协同排练</p>
          <h2>多人编辑冲突模拟</h2>
          <p className="collab-simulator-desc">
            模拟多名灯光师同时编辑Cue表的场景，检测并解决编辑冲突
          </p>
        </div>
        <div className="collab-simulator-header-actions">
          {onClose && (
            <button className="collab-close-btn" onClick={onClose}>
              ✕
            </button>
          )}
        </div>
      </div>

      {session.status !== "merged" && (
        <div className="collab-tabs">
          <button
            className={`collab-tab ${activeTab === "edit" ? "active" : ""}`}
            onClick={() => setActiveTab("edit")}
          >
            双视角编辑
          </button>
          <button
            className={`collab-tab ${activeTab === "resolve" ? "active" : ""}`}
            onClick={() => setActiveTab("resolve")}
            disabled={session.conflicts.length === 0}
          >
            冲突解决
            {session.conflicts.length > 0 && (
              <span className="collab-tab-badge">
                {resolvedCount}/{session.conflicts.length}
              </span>
            )}
          </button>
        </div>
      )}

      {session.status === "merged" && renderMergedPreview()}

      {session.status !== "merged" && activeTab === "edit" && (
        <div className="collab-edit-view">
          {!showSampleData && (
            <div className="collab-sample-prompt">
              <div className="collab-sample-prompt-icon">💡</div>
              <div className="collab-sample-prompt-content">
                <h4>开始冲突模拟</h4>
                <p>
                  您可以手动在左右两侧分别修改数据制造冲突，或者点击下方按钮自动加载示例冲突数据来体验完整流程。
                </p>
                <button
                  className="collab-sample-btn"
                  onClick={handleLoadSampleData}
                >
                  加载示例冲突数据
                </button>
              </div>
            </div>
          )}

          <div className="collab-editors-container">
            {renderEditorPanel("left")}
            <div className="collab-editors-divider">
              <div className="collab-editors-divider-line" />
              <span>VS</span>
              <div className="collab-editors-divider-line" />
            </div>
            {renderEditorPanel("right")}
          </div>

          <div className="collab-edit-actions">
            <button className="collab-detect-btn" onClick={handleDetectConflicts}>
              🔍 检测冲突
            </button>
            {showSampleData && (
              <button className="collab-reset-btn" onClick={handleReset}>
                重置
              </button>
            )}
          </div>
        </div>
      )}

      {session.status !== "merged" && activeTab === "resolve" && (
        <div className="collab-resolve-view">
          <div className="collab-resolve-summary">
            <div className="collab-summary-card">
              <span className="collab-summary-label">总冲突数</span>
              <strong>{session.conflicts.length}</strong>
            </div>
            <div className="collab-summary-card resolved">
              <span className="collab-summary-label">已解决</span>
              <strong>{resolvedCount}</strong>
            </div>
            <div className="collab-summary-card unresolved">
              <span className="collab-summary-label">待解决</span>
              <strong>{unresolvedCount}</strong>
            </div>
          </div>

          <div className="collab-resolve-filters">
            <button
              className={`chip ${conflictFilter === "all" ? "active" : ""}`}
              onClick={() => setConflictFilter("all")}
            >
              全部 ({session.conflicts.length})
            </button>
            {(Object.keys(CONFLICT_TYPE_LABELS) as ConflictType[]).map((type) => {
              const count = session.conflicts.filter((c) => c.type === type).length;
              if (count === 0) return null;
              return (
                <button
                  key={type}
                  className={`chip ${conflictFilter === type ? "active" : ""}`}
                  style={
                    conflictFilter === type
                      ? {
                          background: CONFLICT_TYPE_COLORS[type],
                          borderColor: CONFLICT_TYPE_COLORS[type],
                        }
                      : {}
                  }
                  onClick={() => setConflictFilter(type)}
                >
                  {CONFLICT_TYPE_LABELS[type]} ({count})
                </button>
              );
            })}
          </div>

          <div className="collab-bulk-actions">
            <button
              className="collab-bulk-btn"
              onClick={() => handleResolveAll("keepLeft")}
            >
              全部保留{session.leftEditor.editorName}
            </button>
            <button
              className="collab-bulk-btn"
              onClick={() => handleResolveAll("keepRight")}
            >
              全部保留{session.rightEditor.editorName}
            </button>
          </div>

          <div className="collab-resolve-content">
            <div className="collab-conflict-list">
              {filteredConflicts.length === 0 ? (
                <div className="collab-conflict-list-empty">
                  <p>当前筛选条件下没有冲突</p>
                </div>
              ) : (
                filteredConflicts.map(renderConflictItem)
              )}
            </div>
            <div className="collab-conflict-detail-panel">
              {renderConflictDetail()}
            </div>
          </div>

          <div className="collab-resolve-footer">
            <button className="collab-back-btn" onClick={() => setActiveTab("edit")}>
              ← 返回编辑
            </button>
            <button
              className={`collab-merge-btn ${unresolvedCount === 0 ? "ready" : ""}`}
              onClick={handleMerge}
              disabled={unresolvedCount > 0}
            >
              {unresolvedCount > 0
                ? `还有 ${unresolvedCount} 个冲突待解决`
                : "✓ 完成合并"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
