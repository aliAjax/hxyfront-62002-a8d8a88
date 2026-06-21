import { useState, useEffect, useRef, useMemo } from "react";
import { type Cue, parseCueFixtures, parseCueBrightness, hasBrightnessField, getCueFixtureDiffs, hasCueFixtureDivergence, syncCueBrightnessFromFixtures } from "../data/cues";
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

interface Props {
  cue: Cue | null;
  fixtures: LightFixture[];
  onSyncCue?: (cue: Cue) => void;
}

export function ScenePreview({ cue, fixtures, onSyncCue }: Props) {
  const [animatedBrightness, setAnimatedBrightness] = useState<Record<string, number>>({});
  const [transitioning, setTransitioning] = useState(false);
  const currentBrightnessRef = useRef<Record<string, number>>({});
  const transitionIdRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const prevCueIdRef = useRef<string | null>(null);

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

  return (
    <section className="scene-preview-panel">
      <div className="heading">
        <div>
          <p>场景预览</p>
          <h2>当前场景灯光状态</h2>
        </div>
        {cue && (
          <div className="scene-preview-cue-badge">
            <span className="scene-preview-cue-number">{cue.number}</span>
            <span className="scene-preview-cue-name">{cue.sceneName}</span>
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

      {transitioning && (
        <div className="scene-preview-transition-indicator">
          <span className="scene-preview-transition-dot" />
          过渡中…
        </div>
      )}
    </section>
  );
}
