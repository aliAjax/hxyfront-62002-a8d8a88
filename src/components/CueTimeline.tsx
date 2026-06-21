import { useState, useRef, useCallback, useEffect } from "react";
import { type Cue, hasCueFixtureDivergence, parseCueBrightness } from "../data/cues";
import { type LightFixture } from "../data/fixtures";

interface Props {
  cues: Cue[];
  onAdd: () => void;
  onEdit: (cue: Cue) => void;
  selectedCueId: string | null;
  onSelect: (cueId: string) => void;
  onReorder: (cues: Cue[]) => void;
  fixtures: LightFixture[];
  showHeader?: boolean;
  viewMode?: "list" | "timeline";
  onViewModeChange?: (mode: "list" | "timeline") => void;
}

export function CueTimeline({
  cues,
  onAdd,
  onEdit,
  selectedCueId,
  onSelect,
  onReorder,
  fixtures,
  showHeader = true,
  viewMode = "timeline",
  onViewModeChange,
}: Props) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [insertPosition, setInsertPosition] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragLockRef = useRef<number>(0);
  const scrollSpeedRef = useRef<number>(0);
  const scrollRAFRef = useRef<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const cuesContainerRef = useRef<HTMLDivElement>(null);
  const cueWrappersRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(hover: none) and (pointer: coarse)").matches);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const autoScroll = useCallback(() => {
    if (!timelineRef.current || !isDragging) return;

    const container = timelineRef.current;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    const speed = scrollSpeedRef.current;

    if (speed !== 0 && ((speed > 0 && scrollLeft < scrollWidth - clientWidth - 5) || (speed < 0 && scrollLeft > 5))) {
      container.scrollLeft += speed;
      scrollRAFRef.current = requestAnimationFrame(autoScroll);
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging && scrollSpeedRef.current !== 0) {
      scrollRAFRef.current = requestAnimationFrame(autoScroll);
    }
    return () => {
      if (scrollRAFRef.current) {
        cancelAnimationFrame(scrollRAFRef.current);
      }
    };
  }, [isDragging, autoScroll]);

  const updateScrollSpeed = useCallback((clientX: number) => {
    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const edgeThreshold = 80;

    if (mouseX < edgeThreshold) {
      scrollSpeedRef.current = -8 * (1 - mouseX / edgeThreshold);
    } else if (mouseX > rect.width - edgeThreshold) {
      scrollSpeedRef.current = 8 * (1 - (rect.width - mouseX) / edgeThreshold);
    } else {
      scrollSpeedRef.current = 0;
    }
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDraggedIndex(index);
      setIsDragging(true);
      setInsertPosition(index);
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", String(index));
        } catch (_) {}
      }
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setInsertPosition(null);
    setIsDragging(false);
    scrollSpeedRef.current = 0;
    if (scrollRAFRef.current) {
      cancelAnimationFrame(scrollRAFRef.current);
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }

      const now = Date.now();
      if (now - dragLockRef.current < 30) return;
      dragLockRef.current = now;

      if (draggedIndex === null) return;

      updateScrollSpeed(e.clientX);

      const wrapper = cueWrappersRef.current[index];
      if (wrapper) {
        const wrapperRect = wrapper.getBoundingClientRect();
        const relativeX = e.clientX - wrapperRect.left;
        const isAfter = relativeX > wrapperRect.width / 2;
        const newInsertPos = isAfter ? index + 1 : index;
        const adjustedInsertPos =
          draggedIndex < newInsertPos ? Math.max(0, newInsertPos - 1) : newInsertPos;
        setInsertPosition(adjustedInsertPos);
      } else {
        setInsertPosition(index);
      }
    },
    [draggedIndex, updateScrollSpeed]
  );

  const handleDragOverTimeline = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }

      if (draggedIndex === null) return;

      updateScrollSpeed(e.clientX);

      const now = Date.now();
      if (now - dragLockRef.current < 30) return;
      dragLockRef.current = now;

      if (!cuesContainerRef.current || cues.length === 0) {
        setInsertPosition(0);
        return;
      }

      const containerRect = cuesContainerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;

      let firstWrapperLeft = Infinity;
      let lastWrapperRight = -Infinity;

      cueWrappersRef.current.forEach((wrapper) => {
        if (wrapper) {
          const r = wrapper.getBoundingClientRect();
          const left = r.left - containerRect.left;
          const right = r.right - containerRect.left;
          if (left < firstWrapperLeft) firstWrapperLeft = left;
          if (right > lastWrapperRight) lastWrapperRight = right;
        }
      });

      if (mouseX < firstWrapperLeft - 5) {
        const adjusted = draggedIndex < 0 ? 0 : 0;
        setInsertPosition(adjusted);
      } else if (mouseX > lastWrapperRight + 5) {
        setInsertPosition(cues.length - (draggedIndex !== null && draggedIndex < cues.length ? 1 : 0));
      }
    },
    [draggedIndex, cues.length, updateScrollSpeed]
  );

  const performReorder = useCallback(
    (targetInsertPos: number) => {
      if (draggedIndex === null) {
        handleDragEnd();
        return;
      }

      let insertPos = targetInsertPos;
      if (draggedIndex < insertPos) {
        insertPos = Math.max(0, insertPos - 1);
      }
      insertPos = Math.max(0, Math.min(cues.length - 1, insertPos));

      if (insertPos === draggedIndex) {
        handleDragEnd();
        return;
      }

      const newCues = [...cues];
      const [removed] = newCues.splice(draggedIndex, 1);
      newCues.splice(insertPos, 0, removed);

      onReorder(newCues);
      handleDragEnd();
    },
    [cues, draggedIndex, onReorder, handleDragEnd]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();

      if (draggedIndex === null) {
        handleDragEnd();
        return;
      }

      const wrapper = cueWrappersRef.current[index];
      let finalInsertPos = index;
      if (wrapper) {
        const wrapperRect = wrapper.getBoundingClientRect();
        const relativeX = e.clientX - wrapperRect.left;
        const isAfter = relativeX > wrapperRect.width / 2;
        finalInsertPos = isAfter ? index + 1 : index;
      }

      performReorder(finalInsertPos);
    },
    [draggedIndex, performReorder, handleDragEnd]
  );

  const handleDropTimeline = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      if (draggedIndex === null) {
        handleDragEnd();
        return;
      }

      if (!cuesContainerRef.current || cues.length === 0) {
        handleDragEnd();
        return;
      }

      const containerRect = cuesContainerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;

      let firstWrapperLeft = Infinity;
      let lastWrapperRight = -Infinity;
      let closestIndex = 0;
      let closestDistance = Infinity;

      cueWrappersRef.current.forEach((wrapper, idx) => {
        if (wrapper) {
          const r = wrapper.getBoundingClientRect();
          const left = r.left - containerRect.left;
          const right = r.right - containerRect.left;
          const center = (left + right) / 2;
          const dist = Math.abs(mouseX - center);
          if (dist < closestDistance) {
            closestDistance = dist;
            closestIndex = idx;
          }
          if (left < firstWrapperLeft) firstWrapperLeft = left;
          if (right > lastWrapperRight) lastWrapperRight = right;
        }
      });

      let finalInsertPos: number;
      if (mouseX < firstWrapperLeft - 5) {
        finalInsertPos = 0;
      } else if (mouseX > lastWrapperRight + 5) {
        finalInsertPos = cues.length;
      } else {
        const wrapper = cueWrappersRef.current[closestIndex];
        if (wrapper) {
          const r = wrapper.getBoundingClientRect();
          const relativeX = e.clientX - r.left;
          const isAfter = relativeX > r.width / 2;
          finalInsertPos = isAfter ? closestIndex + 1 : closestIndex;
        } else {
          finalInsertPos = closestIndex;
        }
      }

      performReorder(finalInsertPos);
    },
    [draggedIndex, cues.length, performReorder, handleDragEnd]
  );

  const moveCue = useCallback(
    (index: number, direction: "up" | "down") => {
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= cues.length) return;

      const newCues = [...cues];
      const [removed] = newCues.splice(index, 1);
      newCues.splice(newIndex, 0, removed);
      onReorder(newCues);
    },
    [cues, onReorder]
  );

  const moveCueToStart = useCallback(
    (index: number) => {
      if (index === 0) return;
      const newCues = [...cues];
      const [removed] = newCues.splice(index, 1);
      newCues.unshift(removed);
      onReorder(newCues);
    },
    [cues, onReorder]
  );

  const moveCueToEnd = useCallback(
    (index: number) => {
      if (index === cues.length - 1) return;
      const newCues = [...cues];
      const [removed] = newCues.splice(index, 1);
      newCues.push(removed);
      onReorder(newCues);
    },
    [cues, onReorder]
  );

  const getBrightnessColor = (cue: Cue) => {
    const brightness = parseCueBrightness(cue);
    if (brightness === null) return null;
    if (brightness >= 80) return "#10b981";
    if (brightness >= 50) return "#f59e0b";
    return "#ef4444";
  };

  const showStartIndicator = isDragging && insertPosition === 0;
  const showEndIndicator = isDragging && insertPosition === cues.length;

  if (cues.length === 0) {
    return (
      <section className="panel cue-timeline-panel">
        {showHeader && (
          <div className="heading">
            <div>
              <p>Cue时间线</p>
              <h2>Cue触发顺序</h2>
            </div>
            <div className="heading-actions">
              {onViewModeChange && (
                <div className="cue-view-toggle">
                  <button
                    className={`cue-view-toggle-btn${viewMode === "list" ? " active" : ""}`}
                    onClick={() => onViewModeChange("list")}
                  >
                    列表视图
                  </button>
                  <button
                    className={`cue-view-toggle-btn${viewMode === "timeline" ? " active" : ""}`}
                    onClick={() => onViewModeChange("timeline")}
                  >
                    时间线视图
                  </button>
                </div>
              )}
              <button className="primary" onClick={onAdd}>
                新增Cue
              </button>
            </div>
          </div>
        )}
        <div className="cue-empty">
          <p>暂无Cue，点击"新增Cue"添加</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel cue-timeline-panel">
      {showHeader && (
        <div className="heading">
          <div>
            <p>Cue时间线</p>
            <h2>Cue触发顺序</h2>
          </div>
          <div className="heading-actions">
            {isMobile && (
              <span className="timeline-mobile-hint">使用 ↑↓ 调整顺序</span>
            )}
            {onViewModeChange && (
              <div className="cue-view-toggle">
                <button
                  className={`cue-view-toggle-btn${viewMode === "list" ? " active" : ""}`}
                  onClick={() => onViewModeChange("list")}
                >
                  列表视图
                </button>
                <button
                  className={`cue-view-toggle-btn${viewMode === "timeline" ? " active" : ""}`}
                  onClick={() => onViewModeChange("timeline")}
                >
                  时间线视图
                </button>
              </div>
            )}
            <button className="primary" onClick={onAdd}>
              新增Cue
            </button>
          </div>
        </div>
      )}

      <div
        ref={timelineRef}
        className={`cue-timeline${isDragging ? " is-dragging" : ""}`}
        onDragOver={handleDragOverTimeline}
        onDrop={handleDropTimeline}
      >
        <div className="timeline-track">
          <div className="timeline-line" />
          <div className="timeline-cues" ref={cuesContainerRef}>
            {showStartIndicator && (
              <div className="timeline-insert-indicator timeline-insert-start">
                <div className="timeline-insert-line" />
                <span className="timeline-insert-label">插入到开头</span>
              </div>
            )}
            {cues.map((cue, index) => {
              const isSelected = cue.id === selectedCueId;
              const isDraggingItem = draggedIndex === index;
              const showBeforeIndicator =
                isDragging &&
                insertPosition === index &&
                !showStartIndicator &&
                draggedIndex !== index;
              const showAfterIndicator =
                isDragging &&
                insertPosition === index + 1 &&
                !showEndIndicator &&
                draggedIndex !== index;
              const diverged = hasCueFixtureDivergence(cue, fixtures);
              const brightnessColor = getBrightnessColor(cue);

              let transformClass = "";
              if (insertPosition !== null && draggedIndex !== null && draggedIndex !== insertPosition) {
                if (draggedIndex < insertPosition) {
                  if (index > draggedIndex && index < insertPosition) {
                    transformClass = " shift-left";
                  } else if (index === draggedIndex) {
                    transformClass = " shift-left-leaving";
                  }
                } else {
                  if (index < draggedIndex && index >= insertPosition) {
                    transformClass = " shift-right";
                  } else if (index === draggedIndex) {
                    transformClass = " shift-right-leaving";
                  }
                }
              }

              return (
                <div key={`group-${cue.id}`} className="timeline-cue-group">
                  {showBeforeIndicator && (
                    <div className="timeline-insert-indicator timeline-insert-before">
                      <div className="timeline-insert-line" />
                    </div>
                  )}
                  <div
                    key={cue.id}
                    ref={(el) => {
                      cueWrappersRef.current[index] = el;
                    }}
                    className={`timeline-cue-wrapper${
                      isDraggingItem ? " dragging" : ""
                    }${transformClass}`}
                    draggable={!isMobile}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                  >
                    <article
                      className={`timeline-cue${
                        isSelected ? " timeline-cue-selected" : ""
                      }${diverged ? " timeline-cue-diverged" : ""}`}
                      onClick={() => onSelect(cue.id)}
                    >
                      <div className="timeline-cue-dot" />
                      <div className="timeline-cue-index">
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <div className="timeline-cue-content">
                        <div className="timeline-cue-header">
                          <h3>{cue.number}</h3>
                          <span className="timeline-cue-scene">{cue.sceneName}</span>
                        </div>
                        <div className="timeline-cue-details">
                          <span className="timeline-cue-fixtures">
                            {cue.fixtures}
                          </span>
                          {brightnessColor && (
                            <span
                              className="timeline-cue-brightness"
                              style={{ color: brightnessColor }}
                            >
                              {cue.brightnessChange}
                            </span>
                          )}
                        </div>
                        {cue.triggerNote && (
                          <p className="timeline-cue-trigger">
                            触发: {cue.triggerNote}
                          </p>
                        )}
                        {diverged && (
                          <span className="timeline-cue-diverged-badge">
                            灯具已修改
                          </span>
                        )}
                        {cue.versionNote && (
                          <span className="timeline-cue-version">
                            {cue.versionNote}
                          </span>
                        )}
                      </div>
                      {isMobile && (
                        <div className="timeline-cue-mobile-actions">
                          <div className="timeline-move-group">
                            <button
                              className="timeline-move-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveCueToStart(index);
                              }}
                              disabled={index === 0}
                              title="移到开头"
                            >
                              ⏮
                            </button>
                            <button
                              className="timeline-move-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveCue(index, "up");
                              }}
                              disabled={index === 0}
                              title="上移"
                            >
                              ↑
                            </button>
                            <button
                              className="timeline-move-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveCue(index, "down");
                              }}
                              disabled={index === cues.length - 1}
                              title="下移"
                            >
                              ↓
                            </button>
                            <button
                              className="timeline-move-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveCueToEnd(index);
                              }}
                              disabled={index === cues.length - 1}
                              title="移到末尾"
                            >
                              ⏭
                            </button>
                          </div>
                        </div>
                      )}
                      <button
                        className="timeline-cue-edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(cue);
                        }}
                      >
                        编辑
                      </button>
                    </article>
                  </div>
                  {showAfterIndicator && (
                    <div className="timeline-insert-indicator timeline-insert-after">
                      <div className="timeline-insert-line" />
                    </div>
                  )}
                </div>
              );
            })}
            {showEndIndicator && (
              <div className="timeline-insert-indicator timeline-insert-end">
                <div className="timeline-insert-line" />
                <span className="timeline-insert-label">插入到末尾</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="timeline-footer">
        <span className="timeline-count">共 {cues.length} 个Cue</span>
        {!isMobile && (
          <span className="timeline-hint">拖拽Cue调整顺序 · 拖动到边缘自动滚动</span>
        )}
      </div>
    </section>
  );
}
