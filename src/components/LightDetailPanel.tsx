import { LIGHT_TYPE_COLORS, type LightFixture } from "../data/fixtures";

interface Props {
  fixture: LightFixture | null;
  onClose: () => void;
}

export function LightDetailPanel({ fixture, onClose }: Props) {
  if (!fixture) {
    return (
      <aside className="detail-panel detail-panel-empty">
        <div className="detail-empty-hint">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="22" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 3" />
            <path d="M24 16v8m0 4v2" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p>点击灯位点查看详情</p>
        </div>
      </aside>
    );
  }

  const color = LIGHT_TYPE_COLORS[fixture.type];

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <div className="detail-badge" style={{ background: color }}>
          {fixture.type}
        </div>
        <button className="detail-close" onClick={onClose} aria-label="关闭">
          ✕
        </button>
      </div>

      <h3 className="detail-title">{fixture.number}</h3>
      <p className="detail-channel">{fixture.channel}</p>

      <div className="detail-brightness">
        <div className="brightness-label">
          <span>当前亮度</span>
          <strong style={{ color: fixture.brightness === 0 ? "#94a3b8" : color }}>
            {fixture.brightness}%
          </strong>
        </div>
        <div className="brightness-bar">
          <div
            className="brightness-fill"
            style={{
              width: `${fixture.brightness}%`,
              background: fixture.brightness === 0 ? "#e2e8f0" : color,
            }}
          />
        </div>
      </div>

      <dl className="detail-fields">
        <div className="detail-field">
          <dt>色片</dt>
          <dd>
            <span className="color-swatch" style={{ background: fixture.color.includes("蓝") ? "#3b82f6" : fixture.color.includes("红") ? "#ef4444" : fixture.color.includes("紫") ? "#8b5cf6" : fixture.color.includes("橙") ? "#f97316" : fixture.color.includes("粉") ? "#ec4899" : "#94a3b8" }} />
            {fixture.color}
          </dd>
        </div>
        <div className="detail-field">
          <dt>焦点位置</dt>
          <dd>{fixture.focus}</dd>
        </div>
        <div className="detail-field">
          <dt>备注</dt>
          <dd>{fixture.notes}</dd>
        </div>
      </dl>
    </aside>
  );
}
