import { useState } from "react";
import { type VersionNote } from "../data/versionNotes";
import { VersionNoteEditDrawer } from "./VersionNoteEditDrawer";

type FilterType = "all" | "pending" | "confirmed";

interface Props {
  notes: VersionNote[];
  onChange: (notes: VersionNote[]) => void;
}

export function VersionNotesPanel({ notes, onChange }: Props) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<VersionNote | null>(null);

  const filtered = notes.filter((note) => {
    if (filter === "pending") return !note.confirmed;
    if (filter === "confirmed") return note.confirmed;
    return true;
  });

  const handleAdd = () => {
    setEditingNote(null);
    setDrawerOpen(true);
  };

  const handleEdit = (note: VersionNote) => {
    setEditingNote(note);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setEditingNote(null);
  };

  const handleSave = (note: VersionNote) => {
    onChange(
      notes.some((n) => n.id === note.id)
        ? notes.map((n) => (n.id === note.id ? note : n))
        : [...notes, note]
    );
    handleCloseDrawer();
  };

  const handleToggleConfirm = (id: string) => {
    onChange(
      notes.map((n) =>
        n.id === id ? { ...n, confirmed: !n.confirmed, updatedAt: formatNow() } : n
      )
    );
  };

  return (
    <section className="panel version-notes-panel">
      <div className="heading">
        <div>
          <p>排练记录</p>
          <h2>演出版本备注</h2>
        </div>
        <div className="version-notes-actions">
          <div className="version-notes-chips">
            <button
              className={filter === "all" ? "chip active" : "chip"}
              onClick={() => setFilter("all")}
            >
              全部
            </button>
            <button
              className={filter === "pending" ? "chip active" : "chip"}
              onClick={() => setFilter("pending")}
            >
              待确认
            </button>
            <button
              className={filter === "confirmed" ? "chip active" : "chip"}
              onClick={() => setFilter("confirmed")}
            >
              已确认
            </button>
          </div>
          <button className="primary" onClick={handleAdd}>
            新增备注
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="version-notes-empty">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="8" width="40" height="42" rx="4" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 3" fill="#f8fafc" />
            <path d="M14 20h20M14 28h20M14 36h12" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
            <circle cx="44" cy="44" r="10" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 3" fill="#f8fafc" />
            <path d="M44 39v5M44 47v0" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="version-notes-empty-title">
            {filter === "all" ? "暂无演出版本备注" : filter === "pending" ? "暂无待确认备注" : "暂无已确认备注"}
          </p>
          <p className="version-notes-empty-hint">
            {filter === "all" ? "点击右上角「新增备注」记录灯光调整说明" : "切换筛选条件查看其他备注"}
          </p>
        </div>
      ) : (
        <div className="version-notes-list">
          {filtered.map((note) => (
            <article key={note.id} className="version-note-item">
              <div className="version-note-header">
                <div className="version-note-title-wrap">
                  <h3 className="version-note-title">{note.versionName}</h3>
                  <span className={`version-note-status ${note.confirmed ? "confirmed" : "pending"}`}>
                    {note.confirmed ? "已确认" : "待确认"}
                  </span>
                </div>
                <div className="version-note-time">{note.updatedAt}</div>
              </div>

              <div className="version-note-cues">
                <span className="version-note-field-label">关联Cue：</span>
                {note.relatedCues.split(",").map((cue, i) => (
                  <span key={i} className="version-note-cue-tag">{cue.trim()}</span>
                ))}
              </div>

              <div className="version-note-reason">
                <span className="version-note-field-label">调整原因：</span>
                {note.adjustmentReason}
              </div>

              <div className="version-note-pending">
                <span className="version-note-field-label">待确认事项：</span>
                {note.pendingItems.trim() || "暂无待确认事项"}
              </div>

              <div className="version-note-actions">
                <button
                  className={`version-note-confirm-btn ${note.confirmed ? "confirmed" : ""}`}
                  onClick={() => handleToggleConfirm(note.id)}
                >
                  {note.confirmed ? "标记待确认" : "标记已确认"}
                </button>
                <button className="version-note-edit-btn" onClick={() => handleEdit(note)}>
                  编辑
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <VersionNoteEditDrawer
        open={drawerOpen}
        note={editingNote}
        onClose={handleCloseDrawer}
        onSave={handleSave}
      />
    </section>
  );
}

function formatNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
