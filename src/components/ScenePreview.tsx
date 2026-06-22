import { useState, useEffect, useRef, useMemo } from "react";
import {
  type Cue,
  parseCueFixtures,
  parseCueBrightness,
  hasBrightnessField,
  getCueFixtureDiffs,
  hasCueFixtureDivergence,
  syncCueBrightnessFromFixtures,
  compareAdjacentCues,
  type CueComparisonResult,
  type FixtureTransition,
  type FixtureChangeType,
} from "../data/cues";
import { LIGHT_TYPE_COLORS, type LightType, type LightFixture } from "../data/fixtures";

const ALL_TYPES: LightType[] = ["面光", "侧光", "逆光", "效果光"];

interface FixtureState {
  id: string;
  number: string;
  channel: string;
  brightness: number;
  color: string;
  focus: string;
  notes: string;
  type: LightType;
  active: boolean;
  brightnessMissing: boolean;
  cueBrightness: number | null;
  brightnessDiffers: boolean;
}

function colorToSwatch(colorText: string): string {
  if (colorText.includes("蓝")) return "#3b82f6";
  if (colorText.includes("红")) return "#ef4444";
  if (colorText.includes("紫")) return "#8b5cf6";
  if (colorText.includes("橙")) return "#f97316";
  if (colorText.includes("粉")) return "#ec4899";
  return "#94a3b8";
}

function focusToAngle(focus: string): number {
  if (focus.includes("左")) return -30;
  if (focus.includes("右")) return 30;
  return 0;
}

const CHANGE_TYPE_LABELS: Record<FixtureChangeType, { label: string; color: string; icon: string }> = {
  turnedOn: { label: "开灯", color: "#22c55e", icon: "↑" },
  turnedOff: { label: "关灯", color: "#64748b", icon: "↓" },
  brightened: { label: "变亮", color: "#f97316", icon: "↗" },
  dimmed: { label: "变暗", color: "#0ea5e9", icon: "↘" },
  colorChanged: { label: "换色", color: "#a855f7", icon: "◐" },
  unchanged: { label: "无变化", color: "#94a3b8", icon: "—" },
};

type ViewMode = "single" | "compare";

interface Props {
  cue: Cue | null;
  allCues: Cue[];
  fixtures: LightFixture[];
  onSyncCue?: (cue: Cue) => void;
}

export function ScenePreview({ cue, allCues, fixtures, onSyncCue }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [animatedBrightness, setAnimatedBrightness] = useState<Record<string, number>>({});
  const [transitioning, setTransitioning] = useState(false);
  const currentBrightnessRef = useRef<Record<string, number>>({});
  const transitionIdRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const prevCueIdRef = useRef<string | null>(null);

  const comparison = useMemo<CueComparisonResult | null>(() => {
    if (!cue || viewMode !== "compare") return null;
    return compareAdjacentCues(cue, allCues, fixtures);
  }, [cue, allCues, fixtures, viewMode]);

  const cueFixtures = useMemo(() => (cue ? parseCueFixtures(cue, fixtures) : []), [cue, fixtures]);
  const cueBrightness = useMemo(() => (cue ? parseCueBrightness(cue) : null), [cue]);
  const brightnessFieldSet = useMemo(() => (cue ? hasBrightnessField(cue) : false), [cue]);
  const brightnessInvalid = brightnessFieldSet && cueBrightness === null;

  const fixtureStates: FixtureState[] = useMemo(() => {
    if (!cue) return [];

    const activeIds = new Set(cueFixtures.map((f) => f.id));
    const diffs = getCueFixtureDiffs(cue, fixtures);
    const diffMap = new Map(diffs.map((d) => [d.fixtureId, d]));

    return cueFixtures.map((f) => {
      const diff = diffMap.get(f.id);
      return {
        id: f.id,
        number: f.number,
        channel: f.channel,
        brightness: f.brightness,
        color: f.color,
        focus: f.focus,
        notes: f.notes,
        type: f.type,
        active: activeIds.has(f.id),
        brightnessMissing: brightnessInvalid,
        cueBrightness: diff?.cueBrightness ?? null,
        brightnessDiffers: diff?.brightnessDiffers ?? false,
      };
    });
  }, [cue, cueFixtures, brightnessInvalid, fixtures]);

  const hasDivergence = useMemo(() => {
    if (!cue) return false;
    return hasCueFixtureDivergence(cue, fixtures);
  }, [cue, fixtures]);

  const groupedFixtures = useMemo(() => {
    const groups: Record<LightType, FixtureState[]> = {
      面光: [],
      侧光: [],
      逆光: [],
      效果光: [],
    };
    for (const fs of fixtureStates) {
      groups[fs.type].push(fs);
    }
    return groups;
  }, [fixtureStates]);

  useEffect(() => {
    if (fixtureStates.length === 0) {
      setAnimatedBrightness({});
      currentBrightnessRef.current = {};
      prevCueIdRef.current = cue?.id ?? null;
      return;
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }

    const cueChanged = prevCueIdRef.current !== cue?.id;
    prevCueIdRef.current = cue?.id ?? null;

    const currentId = ++transitionIdRef.current;
    setTransitioning(true);

    const startBrightness: Record<string, number> = {};
    const endBrightness: Record<string, number> = {};
    const newIds = new Set<string>();

    for (const fs of fixtureStates) {
      newIds.add(fs.id);
      if (cueChanged) {
        startBrightness[fs.id] = currentBrightnessRef.current[fs.id] ?? 0;
      } else {
        startBrightness[fs.id] = animatedBrightness[fs.id] ?? currentBrightnessRef.current[fs.id] ?? 0;
      }
      endBrightness[fs.id] = fs.brightness;
    }

    for (const id of Object.keys(currentBrightnessRef.current)) {
      if (!newIds.has(id)) {
        startBrightness[id] = currentBrightnessRef.current[id];
        endBrightness[id] = 0;
      }
    }

    const duration = 400;
    const startTime = performance.now();

    const animate = (now: number) => {
      if (currentId !== transitionIdRef.current) return;

      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      const next: Record<string, number> = {};
      for (const id of Object.keys(endBrightness)) {
        next[id] = Math.round(
          startBrightness[id] + (endBrightness[id] - startBrightness[id]) * eased
        );
      }

      currentBrightnessRef.current = next;
      setAnimatedBrightness(next);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setTransitioning(false);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [fixtureStates, cue?.id]);

  const noFixtures = cue && fixtureStates.length === 0;

  const renderCueBadge = (c: Cue | null, dimmed = false) => {
    if (!c) return null;
    return (
      <div className={`scene-preview-cue-badge${dimmed ? " scene-preview-cue-badge-dimmed" : ""}`}>
        <span className="scene-preview-cue-number">{c.number}</span>
        <span className="scene-preview-cue-name">{c.sceneName}</span>
      </div>
    );
  };

  const filterMatchedTransitions = (transitions: FixtureTransition[]) =>
    transitions.filter((t) => t.toState?.matched && !t.changeTypes.includes("unchanged"));

  const groupTransitionsByType = (transitions: FixtureTransition[]) => {
    const groups: Record<FixtureChangeType, FixtureTransition[]> = {
      turnedOn: [],
      turnedOff: [],
      brightened: [],
      dimmed: [],
      colorChanged: [],
      unchanged: [],
    };
    for (const t of transitions) {
      for (const ct of t.changeTypes) {
        if (ct !== "unchanged") {
          groups[ct].push(t);
        }
      }
    }
    return groups;
  };

  const getPrimaryChangeType = (transition: FixtureTransition): FixtureChangeType => {
    const priority: FixtureChangeType[] = ["colorChanged", "turnedOn", "turnedOff", "brightened", "dimmed"];
    for (const p of priority) {
      if (transition.changeTypes.includes(p)) return p;
    }
    return "unchanged";
  };

  return (
    <section className="scene-preview-panel">
      <div className="heading">
        <div>
          <p>场景预览</p>
          <h2>{viewMode === "single" ? "当前场景灯光状态" : "前后Cue对照"}</h2>
        </div>
        {cue && viewMode === "single" && renderCueBadge(cue)}
        {cue && (
          <div className="scene-preview-view-toggle">
            <button
              className={viewMode === "single" ? "chip active" : "chip"}
              onClick={() => setViewMode("single")}
            >
              单Cue
            </button>
            <button
              className={viewMode === "compare" ? "chip active" : "chip"}
              onClick={() => setViewMode("compare")}
              disabled={allCues.length < 2}
              title={allCues.length < 2 ? "需要至少2个Cue才能使用对照模式" : ""}
            >
              前后对照
            </button>
          </div>
        )}
      </div>

      {!cue && (
        <div className="scene-preview-empty">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="28" r="26" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="6 4" />
            <path d="M28 18v12m0 4v4" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <p className="scene-preview-empty-title">点击Cue列表项预览灯光状态</p>
          <p className="scene-preview-empty-hint">选中任意Cue即可查看该场景的可视化灯具信息</p>
        </div>
      )}

      {noFixtures && (
        <div className="scene-preview-warning">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L1 21h22L12 2z" stroke="#f59e0b" strokeWidth="2" fill="none" />
            <line x1="12" y1="9" x2="12" y2="14" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="17" r="1" fill="#f59e0b" />
          </svg>
          <div>
            <p className="scene-preview-warning-title">未匹配到关联灯具</p>
            <p className="scene-preview-warning-text">当前Cue的灯具描述「{cue.fixtures}」无法匹配到灯位图中的灯具，请检查Cue的关联灯具字段。</p>
          </div>
        </div>
      )}

      {fixtureStates.length > 0 && brightnessInvalid && (
        <div className="scene-preview-warning scene-preview-warning-info">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#8b5cf6" strokeWidth="2" fill="none" />
            <line x1="12" y1="8" x2="12" y2="13" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="17" r="1" fill="#8b5cf6" />
          </svg>
          <div>
            <p className="scene-preview-warning-title scene-preview-warning-title-info">亮度值无法解析，已使用灯具默认亮度</p>
            <p className="scene-preview-warning-text scene-preview-warning-text-info">Cue的亮度变化描述「{cue?.brightnessChange}」未能识别，请使用「亮度XX%」格式。</p>
          </div>
        </div>
      )}

      {hasDivergence && cue && (
        <div className="scene-preview-divergence-bar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L1 21h22L12 2z" stroke="#f59e0b" strokeWidth="2" fill="none" />
            <line x1="12" y1="9" x2="12" y2="14" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="17" r="1" fill="#f59e0b" />
          </svg>
          <span className="scene-preview-divergence-text">
            灯具当前亮度与Cue指令「{cue.brightnessChange}」不一致，显示的是灯具实际值
          </span>
          {onSyncCue && (
            <button
              className="scene-preview-sync-btn"
              onClick={() => onSyncCue(syncCueBrightnessFromFixtures(cue, fixtures))}
            >
              同步灯具亮度到Cue
            </button>
          )}
        </div>
      )}

      {fixtureStates.length > 0 && (
        <div className="scene-preview-zones">
          {ALL_TYPES.map((type) => {
            const groupFixtures = groupedFixtures[type];
            if (groupFixtures.length === 0) return null;
            const typeColor = LIGHT_TYPE_COLORS[type];

            return (
              <div key={type} className="scene-preview-zone">
                <div className="scene-preview-zone-header">
                  <span className="scene-preview-zone-dot" style={{ background: typeColor }} />
                  <span className="scene-preview-zone-label">{type}</span>
                  <span className="scene-preview-zone-count">{groupFixtures.length}台</span>
                </div>
                <div className="scene-preview-fixtures">
                  {groupFixtures.map((fs) => {
                    const displayBrightness = animatedBrightness[fs.id] ?? fs.brightness;
                    const angle = focusToAngle(fs.focus);
                    const isDimmed = displayBrightness === 0 || fs.brightnessMissing;

                    return (
                      <div key={fs.id} className={`scene-preview-fixture${fs.brightnessMissing ? " scene-preview-fixture-missing" : ""}${fs.brightnessDiffers ? " scene-preview-fixture-diverged" : ""}`}>
                        <div className="scene-preview-fixture-header">
                          <span className="scene-preview-fixture-number">{fs.number}</span>
                          <span className="scene-preview-fixture-channel">{fs.channel}</span>
                          {fs.brightnessDiffers && (
                            <span className="scene-preview-fixture-badge scene-preview-fixture-badge-diverged">
                              Cue{fs.cueBrightness}%→{fs.brightness}%
                            </span>
                          )}
                          {fs.brightnessMissing && (
                            <span className="scene-preview-fixture-badge scene-preview-fixture-badge-error">解析失败</span>
                          )}
                        </div>

                        <div className="scene-preview-brightness">
                          <div className="scene-preview-brightness-bar">
                            <div
                              className="scene-preview-brightness-fill"
                              style={{
                                width: `${displayBrightness}%`,
                                background: isDimmed ? "#e2e8f0" : typeColor,
                              }}
                            />
                          </div>
                          <span
                            className="scene-preview-brightness-value"
                            style={{
                              color: fs.brightnessMissing ? "#7c3aed" : (isDimmed ? "#94a3b8" : typeColor),
                            }}
                          >
                            {`${displayBrightness}%`}
                          </span>
                        </div>

                        <div className="scene-preview-meta">
                          <span className="scene-preview-meta-item">
                            <span
                              className="scene-preview-color-swatch"
                              style={{ background: colorToSwatch(fs.color) }}
                            />
                            {fs.color}
                          </span>
                          <span className="scene-preview-meta-item">
                            <svg
                              className="scene-preview-focus-arrow"
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              style={{ transform: `rotate(${angle}deg)` }}
                            >
                              <path d="M7 2v8m0 0l-3-3m3 3l3-3" stroke={isDimmed ? "#94a3b8" : typeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {fs.focus}
                          </span>
                          {fs.notes && (
                            <span className="scene-preview-meta-item scene-preview-note">
                              备注：{fs.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "compare" && comparison && (
        <div className="scene-preview-compare">
          <div className="scene-preview-compare-header">
            <div className="scene-preview-compare-summary">
              {comparison.summary.turnedOnCount > 0 && (
                <span className="scene-preview-summary-tag" style={{ background: CHANGE_TYPE_LABELS.turnedOn.color }}>
                  {CHANGE_TYPE_LABELS.turnedOn.icon} 开灯 {comparison.summary.turnedOnCount}台
                </span>
              )}
              {comparison.summary.turnedOffCount > 0 && (
                <span className="scene-preview-summary-tag" style={{ background: CHANGE_TYPE_LABELS.turnedOff.color }}>
                  {CHANGE_TYPE_LABELS.turnedOff.icon} 关灯 {comparison.summary.turnedOffCount}台
                </span>
              )}
              {comparison.summary.brightenedCount > 0 && (
                <span className="scene-preview-summary-tag" style={{ background: CHANGE_TYPE_LABELS.brightened.color }}>
                  {CHANGE_TYPE_LABELS.brightened.icon} 变亮 {comparison.summary.brightenedCount}台
                </span>
              )}
              {comparison.summary.dimmedCount > 0 && (
                <span className="scene-preview-summary-tag" style={{ background: CHANGE_TYPE_LABELS.dimmed.color }}>
                  {CHANGE_TYPE_LABELS.dimmed.icon} 变暗 {comparison.summary.dimmedCount}台
                </span>
              )}
              {comparison.summary.colorChangedCount > 0 && (
                <span className="scene-preview-summary-tag" style={{ background: CHANGE_TYPE_LABELS.colorChanged.color }}>
                  {CHANGE_TYPE_LABELS.colorChanged.icon} 换色 {comparison.summary.colorChangedCount}台
                </span>
              )}
              {comparison.summary.prevUnmatchedCount > 0 && (
                <span className="scene-preview-summary-tag scene-preview-summary-tag-warning">
                  ⚠ 无法匹配 {comparison.summary.prevUnmatchedCount}台
                </span>
              )}
            </div>
          </div>

          <div className="scene-preview-compare-columns">
            <div className={`scene-preview-compare-column${!comparison.prevCue ? " scene-preview-column-empty" : ""}`}>
              <div className="scene-preview-column-header">
                <span className="scene-preview-column-label">上一个Cue</span>
                {comparison.prevCue ? renderCueBadge(comparison.prevCue, true) : (
                  <span className="scene-preview-column-empty-hint">（首个Cue）</span>
                )}
              </div>
              {comparison.prevCue ? (
                <div className="scene-preview-compare-content">
                  <div className="scene-preview-compare-brightness">
                    <span className="scene-preview-brightness-label">亮度</span>
                    <span className="scene-preview-brightness-value-large">
                      {parseCueBrightness(comparison.prevCue) ?? "—"}%
                    </span>
                  </div>
                  <div className="scene-preview-compare-fixtures">
                    <span className="scene-preview-fixtures-label">灯具</span>
                    <span className="scene-preview-fixtures-value">{comparison.prevCue.fixtures}</span>
                  </div>
                </div>
              ) : (
                <div className="scene-preview-column-placeholder">
                  这是演出的第一个Cue
                </div>
              )}
            </div>

            <div className="scene-preview-compare-arrow">→</div>

            <div className="scene-preview-compare-column scene-preview-column-current">
              <div className="scene-preview-column-header">
                <span className="scene-preview-column-label">当前Cue</span>
                {renderCueBadge(comparison.currentCue)}
              </div>
              <div className="scene-preview-compare-content">
                <div className="scene-preview-compare-brightness">
                  <span className="scene-preview-brightness-label">亮度</span>
                  <span className="scene-preview-brightness-value-large" style={{ color: LIGHT_TYPE_COLORS.面光 }}>
                    {parseCueBrightness(comparison.currentCue) ?? "—"}%
                  </span>
                </div>
                <div className="scene-preview-compare-fixtures">
                  <span className="scene-preview-fixtures-label">灯具</span>
                  <span className="scene-preview-fixtures-value">{comparison.currentCue.fixtures}</span>
                </div>
                {comparison.currentCue.triggerNote && (
                  <div className="scene-preview-compare-trigger">
                    <span className="scene-preview-trigger-label">触发</span>
                    <span className="scene-preview-trigger-value">{comparison.currentCue.triggerNote}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="scene-preview-compare-arrow">→</div>

            <div className={`scene-preview-compare-column${!comparison.nextCue ? " scene-preview-column-empty" : ""}`}>
              <div className="scene-preview-column-header">
                <span className="scene-preview-column-label">下一个Cue</span>
                {comparison.nextCue ? renderCueBadge(comparison.nextCue, true) : (
                  <span className="scene-preview-column-empty-hint">（最后一个Cue）</span>
                )}
              </div>
              {comparison.nextCue ? (
                <div className="scene-preview-compare-content">
                  <div className="scene-preview-compare-brightness">
                    <span className="scene-preview-brightness-label">亮度</span>
                    <span className="scene-preview-brightness-value-large">
                      {parseCueBrightness(comparison.nextCue) ?? "—"}%
                    </span>
                  </div>
                  <div className="scene-preview-compare-fixtures">
                    <span className="scene-preview-fixtures-label">灯具</span>
                    <span className="scene-preview-fixtures-value">{comparison.nextCue.fixtures}</span>
                  </div>
                </div>
              ) : (
                <div className="scene-preview-column-placeholder">
                  这是演出的最后一个Cue
                </div>
              )}
            </div>
          </div>

          <div className="scene-preview-compare-transitions">
            <div className="scene-preview-transitions-section">
              <div className="scene-preview-transitions-header">
                <span className="scene-preview-transitions-title">
                  ← 上一个 → 当前 变化摘要
                </span>
                {filterMatchedTransitions(comparison.prevTransitions).length === 0 && comparison.prevCue && (
                  <span className="scene-preview-transitions-hint">无变化</span>
                )}
              </div>
              {comparison.prevCue && (
                <div className="scene-preview-transition-groups">
                  {(() => {
                    const groups = groupTransitionsByType(filterMatchedTransitions(comparison.prevTransitions));
                    return (Object.keys(groups) as FixtureChangeType[]).map((changeType) => {
                      const groupTransitions = groups[changeType];
                      if (groupTransitions.length === 0) return null;
                      const label = CHANGE_TYPE_LABELS[changeType];
                      return (
                        <div key={changeType} className="scene-preview-transition-group">
                          <div className="scene-preview-transition-group-header">
                            <span
                              className="scene-preview-transition-group-icon"
                              style={{ background: label.color }}
                            >
                              {label.icon}
                            </span>
                            <span className="scene-preview-transition-group-label">{label.label}</span>
                            <span className="scene-preview-transition-group-count">{groupTransitions.length}台</span>
                          </div>
                          <div className="scene-preview-transition-fixtures">
                            {groupTransitions.map((t) => {
                              const typeColor = LIGHT_TYPE_COLORS[t.type];
                              return (
                                <div key={t.fixtureId} className="scene-preview-transition-fixture">
                                  <div className="scene-preview-transition-fixture-header">
                                    <span className="scene-preview-transition-fixture-number" style={{ color: typeColor }}>
                                      {t.fixtureNumber}
                                    </span>
                                    <span className="scene-preview-transition-fixture-channel">{t.channel}</span>
                                  </div>
                                  <div className="scene-preview-transition-brightness">
                                    <span className="scene-preview-transition-brightness-old">
                                      {t.fromState?.brightness ?? "—"}%
                                    </span>
                                    <span className="scene-preview-transition-arrow" style={{ color: label.color }}>
                                      {t.brightnessDelta !== null && t.brightnessDelta > 0 ? "↗" : t.brightnessDelta !== null && t.brightnessDelta < 0 ? "↘" : "→"}
                                    </span>
                                    <span className="scene-preview-transition-brightness-new" style={{ color: typeColor }}>
                                      {t.toState?.brightness ?? "—"}%
                                    </span>
                                    {t.brightnessDelta !== null && (
                                      <span
                                        className={`scene-preview-transition-delta${t.brightnessDelta > 0 ? " scene-preview-delta-up" : t.brightnessDelta < 0 ? " scene-preview-delta-down" : ""}`}
                                      >
                                        {t.brightnessDelta > 0 ? "+" : ""}{t.brightnessDelta}
                                      </span>
                                    )}
                                  </div>
                                  {t.changeTypes.includes("colorChanged") && (
                                    <div className="scene-preview-transition-color">
                                      <span
                                        className="scene-preview-color-swatch"
                                        style={{ background: colorToSwatch(t.fromState?.color ?? "") }}
                                      />
                                      <span className="scene-preview-transition-arrow" style={{ color: CHANGE_TYPE_LABELS.colorChanged.color }}>→</span>
                                      <span
                                        className="scene-preview-color-swatch"
                                        style={{ background: colorToSwatch(t.toState?.color ?? "") }}
                                      />
                                      <span className="scene-preview-transition-color-text">{t.toState?.color}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            <div className="scene-preview-transitions-section">
              <div className="scene-preview-transitions-header">
                <span className="scene-preview-transitions-title">
                  当前 → 下一个 变化预览 →
                </span>
                {filterMatchedTransitions(comparison.nextTransitions).length === 0 && comparison.nextCue && (
                  <span className="scene-preview-transitions-hint">无变化</span>
                )}
              </div>
              {comparison.nextCue && (
                <div className="scene-preview-transition-groups">
                  {(() => {
                    const groups = groupTransitionsByType(filterMatchedTransitions(comparison.nextTransitions));
                    return (Object.keys(groups) as FixtureChangeType[]).map((changeType) => {
                      const groupTransitions = groups[changeType];
                      if (groupTransitions.length === 0) return null;
                      const label = CHANGE_TYPE_LABELS[changeType];
                      return (
                        <div key={changeType} className="scene-preview-transition-group scene-preview-transition-group-future">
                          <div className="scene-preview-transition-group-header">
                            <span
                              className="scene-preview-transition-group-icon"
                              style={{ background: label.color, opacity: 0.7 }}
                            >
                              {label.icon}
                            </span>
                            <span className="scene-preview-transition-group-label">{label.label}</span>
                            <span className="scene-preview-transition-group-count">{groupTransitions.length}台</span>
                          </div>
                          <div className="scene-preview-transition-fixtures">
                            {groupTransitions.map((t) => {
                              const typeColor = LIGHT_TYPE_COLORS[t.type];
                              return (
                                <div key={t.fixtureId} className="scene-preview-transition-fixture scene-preview-transition-fixture-future">
                                  <div className="scene-preview-transition-fixture-header">
                                    <span className="scene-preview-transition-fixture-number" style={{ color: typeColor, opacity: 0.8 }}>
                                      {t.fixtureNumber}
                                    </span>
                                    <span className="scene-preview-transition-fixture-channel">{t.channel}</span>
                                  </div>
                                  <div className="scene-preview-transition-brightness">
                                    <span className="scene-preview-transition-brightness-old">
                                      {t.fromState?.brightness ?? "—"}%
                                    </span>
                                    <span className="scene-preview-transition-arrow" style={{ color: label.color, opacity: 0.7 }}>
                                      {t.brightnessDelta !== null && t.brightnessDelta > 0 ? "↗" : t.brightnessDelta !== null && t.brightnessDelta < 0 ? "↘" : "→"}
                                    </span>
                                    <span className="scene-preview-transition-brightness-new" style={{ color: typeColor, opacity: 0.8 }}>
                                      {t.toState?.brightness ?? "—"}%
                                    </span>
                                    {t.brightnessDelta !== null && (
                                      <span
                                        className={`scene-preview-transition-delta${t.brightnessDelta > 0 ? " scene-preview-delta-up" : t.brightnessDelta < 0 ? " scene-preview-delta-down" : ""}`}
                                        style={{ opacity: 0.7 }}
                                      >
                                        {t.brightnessDelta > 0 ? "+" : ""}{t.brightnessDelta}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {transitioning && viewMode === "single" && (
        <div className="scene-preview-transition-indicator">
          <span className="scene-preview-transition-dot" />
          过渡中…
        </div>
      )}
    </section>
  );
}
