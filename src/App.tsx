import { useState, useRef, useCallback, useEffect } from "react";
import "./styles.css";
import { StagePlan } from "./components/StagePlan";
import { CueList } from "./components/CueList";
import { CueTimeline } from "./components/CueTimeline";
import { CueEditDrawer } from "./components/CueEditDrawer";
import { VersionNotesPanel } from "./components/VersionNotesPanel";
import { ScenePreview } from "./components/ScenePreview";
import { FixtureBatchWorkspace } from "./components/FixtureBatchWorkspace";
import { DataImportPreview } from "./components/DataImportPreview";
import { DraftBanner, type DraftBannerMode } from "./components/DraftBanner";
import { FIXTURES, type LightFixture } from "./data/fixtures";
import { INITIAL_CUES, type Cue } from "./data/cues";
import { INITIAL_VERSION_NOTES, type VersionNote } from "./data/versionNotes";
import {
  saveDraft,
  loadDraft,
  loadDraftMeta,
  clearDraft,
  draftExists,
  dataDiffersFromInitial,
  exportDraftAsJson,
  stashPendingRestoreDraft,
  loadPendingRestoreDraft,
  loadPendingRestoreMeta,
  pendingRestoreDraftExists,
  clearPendingRestoreDraft,
  promotePendingRestoreToActive,
  type DraftData,
  type DraftMeta,
} from "./utils/draft";

const project = {
  "sourceNo": 2,
  "id": "hxyfront-62002",
  "port": 62002,
  "title": "剧场灯光Cue表管理",
  "domain": "剧场灯光",
  "prompt": "做一个给剧场灯光师使用的灯位与Cue表管理前端项目，可以维护演出名称、灯具编号、通道号、色片、焦点位置、亮度预设和Cue触发顺序。页面需要有舞台平面灯位图、Cue列表、当前场景预览、灯具筛选和演出版本备注，适合排练期间快速调整。",
  "palette": [
    "#7c3aed",
    "#f59e0b",
    "#06b6d4"
  ],
  "metrics": [
    "灯具数量",
    "Cue数量",
    "当前场景",
    "待确认焦点"
  ],
  "filters": [
    "面光",
    "侧光",
    "逆光",
    "效果光"
  ],
  "fields": [
    "演出名称",
    "灯具编号",
    "通道号",
    "色片",
    "焦点位置",
    "亮度预设"
  ],
};

const INITIAL_DRAFT_DATA: DraftData = {
  fixtures: FIXTURES,
  cues: INITIAL_CUES,
  versionNotes: INITIAL_VERSION_NOTES,
};

function getInitialAppData(): DraftData {
  if (pendingRestoreDraftExists()) {
    return loadDraft() ?? INITIAL_DRAFT_DATA;
  }
  return INITIAL_DRAFT_DATA;
}

function App() {
  const initialAppDataRef = useRef<DraftData | null>(null);
  if (!initialAppDataRef.current) {
    initialAppDataRef.current = getInitialAppData();
  }

  const [fixtures, setFixtures] = useState<LightFixture[]>(() => initialAppDataRef.current!.fixtures);
  const [selectedFixtureIds, setSelectedFixtureIds] = useState<Set<string>>(new Set());
  const [cues, setCues] = useState<Cue[]>(() => initialAppDataRef.current!.cues);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCue, setEditingCue] = useState<Cue | null>(null);
  const [versionNotes, setVersionNotes] = useState<VersionNote[]>(() => initialAppDataRef.current!.versionNotes);
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const [cueViewMode, setCueViewMode] = useState<"list" | "timeline">("timeline");
  const [importOpen, setImportOpen] = useState(false);
  const transitionLockRef = useRef<number>(0);

  const [draftBannerMode, setDraftBannerMode] = useState<DraftBannerMode>(() => {
    if (pendingRestoreDraftExists()) return "restore";
    if (draftExists()) {
      stashPendingRestoreDraft();
      clearDraft();
      return "restore";
    }
    return "none";
  });
  const [draftMeta, setDraftMeta] = useState<DraftMeta | null>(() => {
    const pending = loadPendingRestoreMeta();
    return pending ?? loadDraftMeta();
  });
  const [savedFlash, setSavedFlash] = useState(false);
  const [editsMadeDuringRestore, setEditsMadeDuringRestore] = useState(() =>
    pendingRestoreDraftExists() && dataDiffersFromInitial(initialAppDataRef.current!, INITIAL_DRAFT_DATA)
  );
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRenderRef = useRef(true);

  const getCurrentDraftData = useCallback((): DraftData => {
    return { fixtures, cues, versionNotes };
  }, [fixtures, cues, versionNotes]);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    if (draftBannerMode === "restore") {
      const data = { fixtures, cues, versionNotes };
      if (dataDiffersFromInitial(data, INITIAL_DRAFT_DATA)) {
        setEditsMadeDuringRestore(true);
      }
    }
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      const data = { fixtures, cues, versionNotes };
      const hasChanges = dataDiffersFromInitial(data, INITIAL_DRAFT_DATA);
      if (hasChanges) {
        const ok = saveDraft(data);
        if (ok) {
          setDraftMeta(loadDraftMeta());
          if (draftBannerMode !== "restore") {
            setDraftBannerMode("unsaved");
          }
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 2000);
        }
      } else if (draftBannerMode !== "restore") {
        clearDraft();
        setDraftMeta(pendingRestoreDraftExists() ? loadPendingRestoreMeta() : null);
        setDraftBannerMode("none");
      }
    }, 800);
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [fixtures, cues, versionNotes, draftBannerMode]);

  const handleRestoreDraft = useCallback(() => {
    if (editsMadeDuringRestore) {
      setConfirmRestoreOpen(true);
      return;
    }
    const draft = loadPendingRestoreDraft();
    if (draft) {
      setFixtures(draft.fixtures);
      setCues(draft.cues);
      setVersionNotes(draft.versionNotes);
      promotePendingRestoreToActive();
      setDraftMeta(loadDraftMeta());
    }
    setEditsMadeDuringRestore(false);
    setDraftBannerMode("unsaved");
  }, [editsMadeDuringRestore]);

  const handleConfirmRestoreOverride = useCallback(() => {
    const draft = loadPendingRestoreDraft();
    if (draft) {
      setFixtures(draft.fixtures);
      setCues(draft.cues);
      setVersionNotes(draft.versionNotes);
      promotePendingRestoreToActive();
      setDraftMeta(loadDraftMeta());
    }
    setEditsMadeDuringRestore(false);
    setConfirmRestoreOpen(false);
    setDraftBannerMode("unsaved");
  }, []);

  const handleCancelRestore = useCallback(() => {
    setConfirmRestoreOpen(false);
  }, []);

  const handleDiscardDraft = useCallback(() => {
    clearPendingRestoreDraft();
    const data = { fixtures, cues, versionNotes };
    const hasChanges = dataDiffersFromInitial(data, INITIAL_DRAFT_DATA);
    if (!hasChanges) {
      clearDraft();
      setDraftMeta(null);
      setDraftBannerMode("none");
    } else {
      setDraftMeta(loadDraftMeta());
      setDraftBannerMode("unsaved");
    }
    setEditsMadeDuringRestore(false);
  }, [fixtures, cues, versionNotes]);

  const handleExportDraft = useCallback(() => {
    const data = getCurrentDraftData();
    exportDraftAsJson(data, draftMeta);
  }, [getCurrentDraftData, draftMeta]);

  const selectedCue = cues.find((c) => c.id === selectedCueId) ?? null;

  const metricValues = [
    fixtures.length,
    cues.length,
    cues.length > 0 ? cues[cues.length - 1].number : "无",
    versionNotes.filter((n) => !n.confirmed).length,
  ];

  const handleUpdateFixtures = useCallback((updates: Partial<LightFixture> & { id: string }[]) => {
    setFixtures((prev) => {
      const next = [...prev];
      for (const update of updates) {
        const idx = next.findIndex((f) => f.id === update.id);
        if (idx >= 0) {
          next[idx] = { ...next[idx], ...update };
        }
      }
      return next;
    });
  }, []);

  const handleToggleFixtureSelection = useCallback((fixtureId: string) => {
    setSelectedFixtureIds((prev) => {
      const next = new Set(prev);
      if (next.has(fixtureId)) {
        next.delete(fixtureId);
      } else {
        next.add(fixtureId);
      }
      return next;
    });
  }, []);

  const handleSetSelectedFixtures = useCallback((ids: Set<string>) => {
    setSelectedFixtureIds(ids);
  }, []);

  const handleClearSelectedFixtures = useCallback(() => {
    setSelectedFixtureIds(new Set());
  }, []);

  const handleAddCue = () => {
    setEditingCue(null);
    setDrawerOpen(true);
  };

  const handleEditCue = (cue: Cue) => {
    setEditingCue(cue);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setEditingCue(null);
  };

  const handleSaveCue = (cue: Cue) => {
    setCues((prev) => {
      const existingIndex = prev.findIndex((c) => c.id === cue.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = cue;
        return updated;
      } else {
        return [...prev, cue];
      }
    });
    handleCloseDrawer();
  };

  const handleSelectCue = useCallback((cueId: string) => {
    const lockId = Date.now();
    transitionLockRef.current = lockId;
    setSelectedCueId(cueId);
  }, []);

  const handleSyncCue = useCallback((syncedCue: Cue) => {
    setCues((prev) => {
      const idx = prev.findIndex((c) => c.id === syncedCue.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = syncedCue;
        return updated;
      }
      return prev;
    });
  }, []);

  const handleReorderCues = useCallback((newCues: Cue[]) => {
    setCues(newCues);
  }, []);

  const handleImportClick = useCallback(() => {
    setImportOpen(true);
  }, []);

  const handleImportClose = useCallback(() => {
    setImportOpen(false);
  }, []);

  const handleImportConfirm = useCallback((data: { fixtures: LightFixture[]; cues: Cue[] }) => {
    if (data.fixtures.length > 0) {
      setFixtures((prev) => {
        const existingNumbers = new Set(prev.map((f) => f.number.toUpperCase()));
        const newFixtures = data.fixtures.filter(
          (f) => !existingNumbers.has(f.number.toUpperCase())
        );
        return [...prev, ...newFixtures];
      });
    }
    if (data.cues.length > 0) {
      setCues((prev) => [...prev, ...data.cues]);
    }
    setImportOpen(false);
  }, []);

  const effectiveBannerMode: DraftBannerMode = savedFlash
    ? "saved"
    : draftBannerMode;

  const effectiveDraftMeta: DraftMeta | null = draftBannerMode === "restore"
    ? (loadPendingRestoreMeta() ?? draftMeta)
    : draftMeta;

  return (
    <main className="app">
      <DraftBanner
        mode={effectiveBannerMode}
        draftMeta={effectiveDraftMeta}
        onRestore={handleRestoreDraft}
        onDiscard={handleDiscardDraft}
        onExport={handleExportDraft}
      />

      <section className="hero">
        <p>{project.id} · 源提示词{project.sourceNo} · Port {project.port}</p>
        <h1>{project.title}</h1>
        <span>{project.prompt}</span>
      </section>

      <section className="metrics">
        {project.metrics.map((metric: string, index: number) => (
          <article key={metric}>
            <small>{metric}</small>
            <strong>{metricValues[index]}</strong>
          </article>
        ))}
      </section>

      <FixtureBatchWorkspace
        fixtures={fixtures}
        selectedFixtureIds={selectedFixtureIds}
        onToggleSelection={handleToggleFixtureSelection}
        onSetSelectedFixtures={handleSetSelectedFixtures}
        onClearSelectedFixtures={handleClearSelectedFixtures}
        onUpdateFixtures={handleUpdateFixtures}
      />

      <StagePlan
        fixtures={fixtures}
        selectedFixtureIds={selectedFixtureIds}
        onToggleFixtureSelection={handleToggleFixtureSelection}
        onImportClick={handleImportClick}
      />

      {cueViewMode === "list" ? (
        <CueList
          cues={cues}
          onAdd={handleAddCue}
          onEdit={handleEditCue}
          selectedCueId={selectedCueId}
          onSelect={handleSelectCue}
          fixtures={fixtures}
          viewMode={cueViewMode}
          onViewModeChange={setCueViewMode}
        />
      ) : (
        <CueTimeline
          cues={cues}
          onAdd={handleAddCue}
          onEdit={handleEditCue}
          selectedCueId={selectedCueId}
          onSelect={handleSelectCue}
          onReorder={handleReorderCues}
          fixtures={fixtures}
          viewMode={cueViewMode}
          onViewModeChange={setCueViewMode}
        />
      )}

      <ScenePreview cue={selectedCue} fixtures={fixtures} onSyncCue={handleSyncCue} />

      <VersionNotesPanel notes={versionNotes} onChange={setVersionNotes} />

      <CueEditDrawer
        open={drawerOpen}
        cue={editingCue}
        allCues={cues}
        fixtures={fixtures}
        onClose={handleCloseDrawer}
        onSave={handleSaveCue}
      />

      <DataImportPreview
        open={importOpen}
        existingFixtures={fixtures}
        onClose={handleImportClose}
        onConfirm={handleImportConfirm}
      />

      {confirmRestoreOpen && (
        <div className="draft-confirm-overlay">
          <div className="draft-confirm-dialog">
            <div className="draft-confirm-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3>当前已有未保存的修改</h3>
            <p>恢复草稿将覆盖您刚才的编辑内容，此操作不可撤销。确定要继续吗？</p>
            <div className="draft-confirm-actions">
              <button className="draft-btn draft-btn-discard" onClick={handleCancelRestore}>
                取消，保留当前编辑
              </button>
              <button className="draft-btn draft-btn-restore" onClick={handleConfirmRestoreOverride}>
                确认覆盖，恢复旧草稿
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
