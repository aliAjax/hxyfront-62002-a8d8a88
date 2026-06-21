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
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragLockRef = useRef<number>(0);
  const scrollSpeedRef = useRef<number>(0);
  const scrollRAFRef = useRef<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

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

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDraggedIndex(index);
      setIsDragging(true);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsDragging(false);
    scrollSpeedRef.current = 0;
    if (scrollRAFRef.current) {
      cancelAnimationFrame(scrollRAFRef.current);
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const now = Date.now();
      if (now - dragLockRef.current < 30) return;
      dragLockRef.current = now;

      if (draggedIndex === null) return;

      if (timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const edgeThreshold = 80;

        if (mouseX < edgeThreshold) {
          scrollSpeedRef.current = -8 * (1 - mouseX / edgeThreshold);
        } else if (mouseX > rect.width - edgeThreshold) {
          scrollSpeedRef.current = 8 * (1 - (rect.width - mouseX) / edgeThreshold);
        } else {
          scrollSpeedRef.current = 0;
        }
      }

      if (draggedIndex === index) return;
      setDragOverIndex(index);
    },
    [draggedIndex]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === dropIndex) {
        handleDragEnd();
        return;
      }

      const newCues = [...cues];
      const [removed] = newCues.splice(draggedIndex, 1);
      newCues.splice(dropIndex, 0, removed);

      onReorder(newCues);
      handleDragEnd();
    },
    [cues, draggedIndex, onReorder, handleDragEnd]
  );

  const handleDragOverTimeline = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

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
      >
        <div className="timeline-track">
          <div className="timeline-line" />
          <div className="timeline-cues">
            {cues.map((cue, index) => {
              const isSelected = cue.id === selectedCueId;
              const isDraggingItem = draggedIndex === index;
              const isDragOver = dragOverIndex === index;
              const diverged = hasCueFixtureDivergence(cue, fixtures);
              const brightnessColor = getBrightnessColor(cue);

              let transformClass = "";
              if (dragOverIndex !== null && draggedIndex !== null && draggedIndex !== dragOverIndex) {
                if (draggedIndex < dragOverIndex) {
                  if (index > draggedIndex && index <= dragOverIndex) {
                    transformClass = " shift-left";
                  }
                } else {
                  if (index < draggedIndex && index >= dragOverIndex) {
                    transformClass = " shift-right";
                  }
                }
              }

              return (
                <div
                  key={cue.id}
                  className={`timeline-cue-wrapper${
                    isDraggingItem ? " dragging" : ""
                  }${isDragOver ? " drag-over" : ""}${transformClass}`}
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
              );
            })}
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
