import { useEffect, useState, useRef } from "react";
import { FIXTURES, LIGHT_TYPE_COLORS, type LightFixture, type LightType } from "../data/fixtures";
import { type Cue } from "../data/cues";

const ALL_TYPES: LightType[] = ["面光", "侧光", "逆光", "效果光"];

interface PreviewFixture extends LightFixture {
  cueBrightness: number | null;
  isActiveInCue: boolean;
}

function parseBrightness(brightnessChange: string): number | null {
  if (!brightnessChange) return null;
  const match = brightnessChange.match(/(\d+)/);
  if (match) {
    const value = parseInt(match[1], 10);
    return Math.max(0, Math.min(100, value));
  }
  return null;
}

function parseFixtureIds(fixturesStr: string, allFixtures: LightFixture[]): string[] {
  if (!fixturesStr || !fixturesStr.trim()) return [];

  const trimmed = fixturesStr.trim();
  const matchedIds: Set<string> = new Set();

  if (trimmed.includes("全台") || trimmed.includes("全部") || trimmed.includes("所有")) {
    allFixtures.forEach((f) => matchedIds.add(f.id));
    return Array.from(matchedIds);
  }

  ALL_TYPES.forEach((type) => {
    if (trimmed.includes(type)) {
      allFixtures.filter((f) => f.type === type).forEach((f) => matchedIds.add(f.id));
    }
  });

  const chRangeMatch = trimmed.match(/CH\s*(\d+)\s*[-~至到]\s*(\d+)/i);
  if (chRangeMatch) {
    const start = parseInt(chRangeMatch[1], 10);
    const end = parseInt(chRangeMatch[2], 10);
    const min = Math.min(start, end);
    const max = Math.max(start, end);
    allFixtures.forEach((f) => {
      const chNumMatch = f.channel.match(/CH\s*(\d+)/i);
      if (chNumMatch) {
        const chNum = parseInt(chNumMatch[1], 10);
        if (chNum >= min && chNum <= max) {
          matchedIds.add(f.id);
        }
      }
    });
  }

  const chSingleMatches = trimmed.match(/CH\s*(\d+)/gi);
  if (chSingleMatches) {
    chSingleMatches.forEach((ch) => {
      const numMatch = ch.match(/(\d+)/);
      if (numMatch) {
        const chNum = parseInt(numMatch[1], 10);
        allFixtures.forEach((f) => {
          const fNumMatch = f.channel.match(/CH\s*(\d+)/i);
          if (fNumMatch && parseInt(fNumMatch[1], 10) === chNum) {
            matchedIds.add(f.id);
          }
        });
      }
    });
  }

  allFixtures.forEach((f) => {
    if (trimmed.includes(f.number)) {
      matchedIds.add(f.id);
    }
  });

  return Array.from(matchedIds);
}

function getColorFromName(colorName: string): string {
  if (!colorName) return "#94a3b8";
  if (colorName.includes("冷蓝") || colorName.includes("淡蓝") || colorName.includes("原色蓝")) return "#3b82f6";
  if (colorName.includes("曙红")) return "#ec4899";
  if (colorName.includes("深红")) return "#dc2626";
  if (colorName.includes("粉红")) return "#f472b6";
  if (colorName.includes("紫色")) return "#8b5cf6";
  if (colorName.includes("橙色")) return "#f97316";
  return "#94a3b8";
}

interface Props {
  cue: Cue | null;
  allCues: Cue[];
  onCueChange?: (cue: Cue) => void;
}

export function ScenePreview({ cue, allCues, onCueChange }: Props) {
  const [displayFixtures, setDisplayFixtures] = useState<PreviewFixture[]>(() =>
    FIXTURES.map((f) => ({
      ...f,
      cueBrightness: null,
      isActiveInCue: false,
    }))
  );
  const animationRef = useRef<number | null>(null);
  const displayFixturesRef = useRef<PreviewFixture[]>(displayFixtures);

  useEffect(() => {
    displayFixturesRef.current = displayFixtures;
  }, [displayFixtures]);

  const matchedIds = cue ? parseFixtureIds(cue.fixtures, FIXTURES) : [];
  const cueBrightness = cue ? parseBrightness(cue.brightnessChange) : null;
  const activeCount = matchedIds.length;

  useEffect(() => {
    const target: PreviewFixture[] = FIXTURES.map((f) => ({
      ...f,
      cueBrightness,
      isActiveInCue: matchedIds.includes(f.id),
    }));

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startFixtures = displayFixturesRef.current;
    const duration = 600;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);

      const interpolated = target.map((tf, i) => {
        const sf = startFixtures[i] || tf;
        const startBrightness = sf?.brightness ?? 0;
        const targetBrightness = tf.isActiveInCue
          ? (tf.cueBrightness ?? tf.brightness)
          : 0;
        const interpolatedBrightness = Math.round(startBrightness + (targetBrightness - startBrightness) * eased);

        return {
          ...tf,
          brightness: interpolatedBrightness,
        };
      });

      setDisplayFixtures(interpolated);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    setDisplayFixtures(target.map((tf, i) => ({
      ...tf,
      brightness: startFixtures[i]?.brightness ?? 0,
    })));

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [cue?.id, matchedIds.join(','), cueBrightness]);

  const groupedByType: Record<LightType, PreviewFixture[]> = {
    面光: [],
    侧光: [],
    逆光: [],
    效果光: [],
  };

  displayFixtures.forEach((f) => {
    groupedByType[f.type].push(f);
  });

  return (
    <section className="scene-preview-module">
      <div className="scene-preview-header">
        <div>
          <p className="scene-preview-label">当前场景</p>
          <h2 className="scene-preview-title">
            {cue ? `${cue.number} · ${cue.sceneName}` : "请选择一个Cue"}
          </h2>
          {cue && (
            <div className="scene-preview-meta">
              <span className="scene-meta-item">
                <strong>灯具:</strong> {cue.fixtures}
              </span>
              <span className="scene-meta-item">
                <strong>亮度:</strong> {cue.brightnessChange}
              </span>
              {cue.triggerNote && (
                <span className="scene-meta-item">
                  <strong>触发:</strong> {cue.triggerNote}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="scene-preview-summary">
          <div className="summary-item">
            <small>激活灯具</small>
            <strong>{activeCount}/{FIXTURES.length}</strong>
          </div>
        </div>
      </div>

      {!cue ? (
        <div className="scene-preview-empty">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="32" cy="32" r="28" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="6 4" />
            <path d="M32 20v12M32 38v3" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="32" cy="47" r="2.5" fill="#cbd5e1" />
          </svg>
          <p className="empty-title">暂无选中Cue</p>
          <p className="empty-hint">点击下方Cue列表中的Cue项，查看该场景的灯光状态预览</p>
        </div>
      ) : activeCount === 0 ? (
        <div className="scene-preview-empty scene-preview-warning">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="28" r="26" stroke="#f59e0b" strokeWidth="2" fill="#fef3c7" />
            <path d="M28 16v14M28 34v3" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="28" cy="42" r="2.5" fill="#f59e0b" />
          </svg>
          <p className="empty-title">未匹配到关联灯具</p>
          <p className="empty-hint">当前Cue的灯具描述 "{cue.fixtures}" 未能匹配到任何灯具。请检查灯具编号、通道号或灯区描述是否正确。</p>
        </div>
      ) : (
        <div className="scene-preview-zones">
          {ALL_TYPES.map((type) => {
            const fixtures = groupedByType[type];
            const typeActive = fixtures.filter((f) => f.isActiveInCue).length;
            const typeColor = LIGHT_TYPE_COLORS[type];

            return (
              <div key={type} className="preview-zone">
                <div className="zone-header">
                  <div className="zone-title-wrap">
                    <span className="zone-color-dot" style={{ background: typeColor }} />
                    <h3 className="zone-title">{type}</h3>
                  </div>
                  <span className="zone-count">
                    {typeActive}/{fixtures.length} 激活
                  </span>
                </div>

                <div className="zone-fixtures">
                  {fixtures.length === 0 ? (
                    <p className="zone-empty">暂无此类型灯具</p>
                  ) : (
                    fixtures.map((f) => {
                      const displayBrightness = f.isActiveInCue
                        ? (f.cueBrightness ?? f.brightness)
                        : 0;
                      const isOn = displayBrightness > 0;
                      const swatchColor = getColorFromName(f.color);

                      return (
                        <div
                          key={f.id}
                          className={`preview-fixture-card ${f.isActiveInCue ? "active" : "inactive"}`}
                        >
                          <div className="fixture-visual">
                            <svg width="80" height="80" viewBox="0 0 80 80">
                              <defs>
                                <radialGradient id={`glow-${f.id}`} cx="50%" cy="50%" r="50%">
                                  <stop offset="0%" stopColor={typeColor} stopOpacity={isOn ? 0.7 : 0} />
                                  <stop offset="100%" stopColor={typeColor} stopOpacity="0" />
                                </radialGradient>
                              </defs>
                              {isOn && (
                                <circle cx="40" cy="40" r="36" fill={`url(#glow-${f.id})`} />
                              )}
                              <circle
                                cx="40"
                                cy="40"
                                r={isOn ? 20 + (displayBrightness / 100) * 6 : 18}
                                fill={isOn ? typeColor : "#e2e8f0"}
                                opacity={isOn ? 0.9 : 0.4}
                                style={{ transition: "all 0.3s" }}
                              />
                              <circle
                                cx="40"
                                cy="40"
                                r={isOn ? 12 : 10}
                                fill={isOn ? "#ffffff" : "#cbd5e1"}
                                opacity={0.85}
                                style={{ transition: "all 0.3s" }}
                              />
                              <circle
                                cx="40"
                                cy="40"
                                r={isOn ? 7 : 5}
                                fill={swatchColor}
                                opacity={isOn ? 0.8 : 0.3}
                                style={{ transition: "all 0.3s" }}
                              />
                            </svg>
                          </div>

                          <div className="fixture-info">
                            <div className="fixture-head">
                              <span className="fixture-number">{f.number}</span>
                              <span className="fixture-channel">{f.channel}</span>
                            </div>

                            <div className="fixture-brightness">
                              <div className="fixture-brightness-label">
                                <span>亮度</span>
                                <strong
                                  style={{
                                    color: isOn ? typeColor : "#94a3b8",
                                  }}
                                >
                                  {displayBrightness}%
                                </strong>
                              </div>
                              <div className="fixture-brightness-bar">
                                <div
                                  className="fixture-brightness-fill"
                                  style={{
                                    width: `${displayBrightness}%`,
                                    background: isOn ? typeColor : "#e2e8f0",
                                    transition: "width 0.3s, background 0.3s",
                                  }}
                                />
                              </div>
                            </div>

                            <div className="fixture-attrs">
                              <div className="fixture-attr">
                                <span
                                  className="color-swatch"
                                  style={{
                                    background: swatchColor,
                                    opacity: isOn ? 1 : 0.4,
                                  }}
                                />
                                <span className={f.isActiveInCue ? "" : "attr-dim"}>
                                  {f.color}
                                </span>
                              </div>
                              <div className="fixture-attr fixture-focus">
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 12 12"
                                  fill="none"
                                  style={{ opacity: isOn ? 1 : 0.4 }}
                                >
                                  <path
                                    d="M6 1L8 5L11 5.5L8.5 8L9 11L6 9.5L3 11L3.5 8L1 5.5L4 5L6 1Z"
                                    stroke={isOn ? "#64748b" : "#cbd5e1"}
                                    strokeWidth="0.8"
                                    fill="none"
                                  />
                                </svg>
                                <span className={f.isActiveInCue ? "" : "attr-dim"}>
                                  {f.focus}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cue && allCues.length > 1 && (
        <div className="scene-preview-nav">
          {(() => {
            const currentIndex = allCues.findIndex((c) => c.id === cue.id);
            const hasPrev = currentIndex > 0;
            const hasNext = currentIndex < allCues.length - 1;

            return (
              <>
                <button
                  className="nav-btn"
                  disabled={!hasPrev}
                  onClick={() => hasPrev && onCueChange && onCueChange(allCues[currentIndex - 1])}
                >
                  ← 上一Cue
                </button>
                <span className="nav-indicator">
                  {currentIndex + 1} / {allCues.length}
                </span>
                <button
                  className="nav-btn"
                  disabled={!hasNext}
                  onClick={() => hasNext && onCueChange && onCueChange(allCues[currentIndex + 1])}
                >
                  下一Cue →
                </button>
              </>
            );
          })()}
        </div>
      )}
    </section>
  );
}
