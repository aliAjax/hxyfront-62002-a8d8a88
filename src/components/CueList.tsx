import { type Cue } from "../data/cues";

interface Props {
  cues: Cue[];
  onAdd: () => void;
  onEdit: (cue: Cue) => void;
  selectedCueId: string | null;
  onSelect: (cueId: string) => void;
}

export function CueList({ cues, onAdd, onEdit, selectedCueId, onSelect }: Props) {
  return (
    <section className="panel cue-list-panel">
      <div className="heading">
        <div>
          <p>Cue序列</p>
          <h2>Cue触发顺序</h2>
        </div>
        <button className="primary" onClick={onAdd}>
          新增Cue
        </button>
      </div>
      <div className="cue-list">
        {cues.length === 0 ? (
          <div className="cue-empty">
            <p>暂无Cue，点击"新增Cue"添加</p>
          </div>
        ) : (
          cues.map((cue, index) => {
            const isSelected = cue.id === selectedCueId;
            return (
              <article
                key={cue.id}
                className={`cue-item${isSelected ? " cue-item-selected" : ""}`}
                onClick={() => onSelect(cue.id)}
              >
                <b className="cue-index">{String(index + 1).padStart(2, "0")}</b>
                <div className="cue-info">
                  <div className="cue-main">
                    <h3>{cue.number}</h3>
                    <span className="cue-scene">{cue.sceneName}</span>
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
