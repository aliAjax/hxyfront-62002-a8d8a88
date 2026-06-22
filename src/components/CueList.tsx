import { useState } from "react";
import { type Cue, type RehearsalMark, REHEARSAL_MARKS, hasCueFixtureDivergence } from "../data/cues";
import { type LightFixture } from "../data/fixtures";

interface Props {
  cues: Cue[];
  onAdd: () => void;
  onEdit: (cue: Cue) => void;
  selectedCueId: string | null;
  onSelect: (cueId: string) => void;
  onToggleRehearsalMark: (cueId: string, mark: RehearsalMark | null) => void;
  fixtures: LightFixture[];
  showHeader?: boolean;
  viewMode?: "list" | "timeline";
  onViewModeChange?: (mode: "list" | "timeline") => void;
  rehearsalMarkFilter: RehearsalMark | null;
  onRehearsalMarkFilterChange: (filter: RehearsalMark | null) => void;
}

export function CueList({
  cues,
  onAdd,
  onEdit,
  selectedCueId,
  onSelect,
  onToggleRehearsalMark,
  fixtures,
  showHeader = true,
  viewMode = "list",
  onViewModeChange,
  rehearsalMarkFilter,
  onRehearsalMarkFilterChange,
}: Props) {
  const [markPopoverCueId, setMarkPopoverCueId] = useState<string | null>(null);

  const filteredCues = rehearsalMarkFilter
    ? cues.filter((c) => c.rehearsalMark === rehearsalMarkFilter)
    : cues;

  const getMarkInfo = (mark: RehearsalMark | null) => {
    if (!mark) return null;
    return REHEARSAL_MARKS.find((m) => m.key === mark) ?? null;
  };

  const handleMarkClick = (e: React.MouseEvent, cueId: string) => {
    e.stopPropagation();
    setMarkPopoverCueId((prev) => (prev === cueId ? null : cueId));
  };

  const handleMarkSelect = (cueId: string, mark: RehearsalMark | null) => {
    onToggleRehearsalMark(cueId, mark);
    setMarkPopoverCueId(null);
  };

  return (
    <section className="panel cue-list-panel">
      {showHeader && (
        <div className="heading">
          <div>
            <p>Cue序列</p>
            <h2>Cue触发顺序</h2>
          </div>
          <div className="heading-actions">
            <div className="rehearsal-mark-filter">
              <span className="rehearsal-mark-filter-label">排练标记：</span>
              <div className="rehearsal-mark-chips">
                <button
                  className={!rehearsalMarkFilter ? "chip active" : "chip"}
                  onClick={() => onRehearsalMarkFilterChange(null)}
                >
                  全部
                </button>
                {REHEARSAL_MARKS.map((m) => (
                  <button
                    key={m.key}
                    className={rehearsalMarkFilter === m.key ? "chip active" : "chip"}
                    style={
                      rehearsalMarkFilter === m.key
                        ? { background: m.color, borderColor: m.color, color: "#fff" }
                        : { borderColor: m.color, color: m.color }
                    }
                    onClick={() => onRehearsalMarkFilterChange(rehearsalMarkFilter === m.key ? null : m.key)}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
            </div>
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
      <div className="cue-list">
        {filteredCues.length === 0 ? (
          <div className="cue-empty">
            <p>{rehearsalMarkFilter ? "无匹配排练标记的Cue" : "暂无Cue，点击\"新增Cue\"添加"}</p>
          </div>
        ) : (
          filteredCues.map((cue) => {
            const originalIndex = cues.indexOf(cue);
            const isSelected = cue.id === selectedCueId;
            const diverged = hasCueFixtureDivergence(cue, fixtures);
            const markInfo = getMarkInfo(cue.rehearsalMark);
            return (
              <article
                key={cue.id}
                data-cue-id={cue.id}
                className={`cue-item${isSelected ? " cue-item-selected" : ""}${diverged ? " cue-item-diverged" : ""}${cue.rehearsalMark ? " cue-item-marked" : ""}`}
                style={cue.rehearsalMark && markInfo ? { borderLeftColor: markInfo.color } : undefined}
                onClick={() => onSelect(cue.id)}
              >
                <b className="cue-index">{String(originalIndex + 1).padStart(2, "0")}</b>
                <div className="cue-info">
                  <div className="cue-main">
                    <h3>{cue.number}</h3>
                    <span className="cue-scene">{cue.sceneName}</span>
                    {markInfo && (
                      <button
                        className="rehearsal-mark-badge"
                        style={{ background: markInfo.color }}
                        onClick={(e) => handleMarkClick(e, cue.id)}
                      >
                        {markInfo.icon} {markInfo.label}
                      </button>
                    )}
                    {!markInfo && (
                      <button
                        className="rehearsal-mark-badge rehearsal-mark-badge-add"
                        onClick={(e) => handleMarkClick(e, cue.id)}
                      >
                        + 标记
                      </button>
                    )}
                    {diverged && (
                      <span className="cue-diverged-badge">灯具已修改</span>
                    )}
                  </div>
                  <div className="cue-detail">
                    <span className="cue-fixtures">灯具: {cue.fixtures}</span>
                    <span className="cue-brightness">{cue.brightnessChange}</span>
                  </div>
                  {cue.triggerNote && (
                    <p className="cue-trigger">触发: {cue.triggerNote}</p>
                  )}
                  {cue.versionNote && (
                    <span className="cue-version">{cue.versionNote}</span>
                  )}
                  {markPopoverCueId === cue.id && (
                    <div className="rehearsal-mark-popover" onClick={(e) => e.stopPropagation()}>
                      <div className="rehearsal-mark-popover-title">排练标记</div>
                      {REHEARSAL_MARKS.map((m) => (
                        <button
                          key={m.key}
                          className={`rehearsal-mark-popover-item${cue.rehearsalMark === m.key ? " active" : ""}`}
                          style={cue.rehearsalMark === m.key ? { background: m.color, color: "#fff", borderColor: m.color } : { color: m.color }}
                          onClick={() => handleMarkSelect(cue.id, cue.rehearsalMark === m.key ? null : m.key)}
                        >
                          {m.icon} {m.label}
                        </button>
                      ))}
                      {cue.rehearsalMark && (
                        <button
                          className="rehearsal-mark-popover-item rehearsal-mark-popover-clear"
                          onClick={() => handleMarkSelect(cue.id, null)}
                        >
                          ✕ 清除标记
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="cue-edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(cue);
                  }}
                >
                  编辑
                </button>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
