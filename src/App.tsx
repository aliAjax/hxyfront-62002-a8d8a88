import { useState } from "react";
import "./styles.css";
import { StagePlan } from "./components/StagePlan";
import { CueList } from "./components/CueList";
import { CueEditDrawer } from "./components/CueEditDrawer";
import { VersionNotesPanel } from "./components/VersionNotesPanel";
import { ScenePreview } from "./components/ScenePreview";
import { FIXTURES } from "./data/fixtures";
import { INITIAL_CUES, type Cue } from "./data/cues";
import { INITIAL_VERSION_NOTES, type VersionNote } from "./data/versionNotes";

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

function App() {
  const [cues, setCues] = useState<Cue[]>(INITIAL_CUES);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCue, setEditingCue] = useState<Cue | null>(null);
  const [versionNotes, setVersionNotes] = useState<VersionNote[]>(INITIAL_VERSION_NOTES);
  const [selectedCue, setSelectedCue] = useState<Cue | null>(cues.length > 0 ? cues[0] : null);

  const metricValues = [
    FIXTURES.length,
    cues.length,
    selectedCue ? selectedCue.number : (cues.length > 0 ? cues[cues.length - 1].number : "无"),
    versionNotes.filter((n) => !n.confirmed).length,
  ];

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

  const handleSelectCue = (cue: Cue) => {
    setSelectedCue(cue);
  };

  const handleSaveCue = (cue: Cue) => {
    setCues((prev) => {
      const existingIndex = prev.findIndex((c) => c.id === cue.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = cue;
        if (selectedCue?.id === cue.id) {
          setSelectedCue(cue);
        }
        return updated;
      } else {
        const newCues = [...prev, cue];
        if (!selectedCue) {
          setSelectedCue(cue);
        }
        return newCues;
      }
    });
    handleCloseDrawer();
  };

  return (
    <main className="app">
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

      <StagePlan />

      <ScenePreview
        cue={selectedCue}
        allCues={cues}
        onCueChange={handleSelectCue}
      />

      <CueList
        cues={cues}
        onAdd={handleAddCue}
        onEdit={handleEditCue}
        selectedCueId={selectedCue?.id ?? null}
        onSelect={handleSelectCue}
      />

      <VersionNotesPanel notes={versionNotes} onChange={setVersionNotes} />

      <CueEditDrawer
        open={drawerOpen}
        cue={editingCue}
        allCues={cues}
        onClose={handleCloseDrawer}
        onSave={handleSaveCue}
      />
    </main>
  );
}

export default App;
