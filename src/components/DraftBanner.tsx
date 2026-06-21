import { type DraftMeta } from "../utils/draft";

export type DraftBannerMode = "restore" | "unsaved" | "saved" | "none";

interface Props {
  mode: DraftBannerMode;
  draftMeta: DraftMeta | null;
  onRestore: () => void;
  onDiscard: () => void;
  onExport: () => void;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

export function DraftBanner({ mode, draftMeta, onRestore, onDiscard, onExport }: Props) {
  if (mode === "none") return null;

  if (mode === "restore") {
    return (
      <div className="draft-banner draft-banner-restore">
        <div className="draft-banner-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
        <div className="draft-banner-content">
          <p className="draft-banner-title">检测到未导出的草稿</p>
          <p className="draft-banner-detail">
            {draftMeta
              ? `上次保存于 ${formatTimestamp(draftMeta.savedAt)}，恢复后将继续上次未完成的工作。`
              : "恢复草稿后可继续上次未完成的工作。"}
          </p>
        </div>
        <div className="draft-banner-actions">
          <button className="draft-btn draft-btn-restore" onClick={onRestore}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            恢复草稿
          </button>
          <button className="draft-btn draft-btn-discard" onClick={onDiscard}>
            丢弃草稿
          </button>
        </div>
      </div>
    );
  }

  if (mode === "unsaved") {
    return (
      <div className="draft-banner draft-banner-unsaved">
        <div className="draft-banner-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="draft-banner-content">
          <p className="draft-banner-title">有未导出的修改</p>
          <p className="draft-banner-detail">
            当前排练数据已自动保存为草稿，刷新页面后可恢复。
          </p>
        </div>
        <div className="draft-banner-actions">
          <button className="draft-btn draft-btn-export" onClick={onExport}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            导出当前版本
          </button>
        </div>
      </div>
    );
  }

  if (mode === "saved") {
    return (
      <div className="draft-banner draft-banner-saved">
        <div className="draft-banner-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="draft-banner-content">
          <p className="draft-banner-title">草稿已自动保存</p>
        </div>
      </div>
    );
  }

  return null;
}
