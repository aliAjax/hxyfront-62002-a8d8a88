import { createVersionSnapshot, type VersionSnapshot } from "./cues";
import { FIXTURES } from "./fixtures";

const CUES_VERSION_A = [
  {
    id: "cue-12",
    number: "Cue 12",
    sceneName: "冷蓝侧光",
    fixtures: "CH 021-028",
    brightnessChange: "亮度70%",
    triggerNote: "二幕开场",
    versionNote: "版本A - 首演版",
  },
  {
    id: "cue-18",
    number: "Cue 18",
    sceneName: "追光入场",
    fixtures: "FOH-03",
    brightnessChange: "亮度90%",
    triggerNote: "演员入场时触发",
    versionNote: "版本A - 首演版",
  },
  {
    id: "cue-20",
    number: "Cue 20",
    sceneName: "过渡光",
    fixtures: "BL-01, BL-02",
    brightnessChange: "亮度40%",
    triggerNote: "场景切换",
    versionNote: "版本A - 首演版",
  },
  {
    id: "cue-24",
    number: "Cue 24",
    sceneName: "暖色谢幕",
    fixtures: "全台面光",
    brightnessChange: "亮度70%",
    triggerNote: "谢幕音乐起",
    versionNote: "版本A - 首演版",
  },
];

const CUES_VERSION_B = [
  {
    id: "cue-12",
    number: "Cue 12",
    sceneName: "冷蓝侧光",
    fixtures: "CH 021-028",
    brightnessChange: "亮度65%",
    triggerNote: "二幕开场",
    versionNote: "版本B - 彩排调整",
  },
  {
    id: "cue-18",
    number: "Cue 18",
    sceneName: "追光入场",
    fixtures: "FOH-03",
    brightnessChange: "亮度100%",
    triggerNote: "需演员走位确认",
    versionNote: "版本B - 彩排调整",
  },
  {
    id: "cue-22",
    number: "Cue 22",
    sceneName: "高潮效果光",
    fixtures: "FX-01, FX-02, FX-03",
    brightnessChange: "亮度85%",
    triggerNote: "主角独唱时",
    versionNote: "版本B - 彩排调整",
  },
  {
    id: "cue-24-renamed",
    number: "Cue 24",
    sceneName: "暖色谢幕",
    fixtures: "全台面光",
    brightnessChange: "亮度80%",
    triggerNote: "谢幕音乐起",
    versionNote: "版本B - 彩排调整",
  },
];

const FIXTURES_VERSION_A = FIXTURES.map((f) => ({
  ...f,
  color: f.id === "s1" ? "HT201 冷蓝" : f.color,
  brightness: f.id === "f3" ? 60 : f.brightness,
}));

const FIXTURES_VERSION_B = FIXTURES.map((f) => {
  if (f.id === "s1") return { ...f, color: "HT202 淡蓝", brightness: 65 };
  if (f.id === "s4") return { ...f, color: "HT202 淡蓝", brightness: 65 };
  if (f.id === "f3") return { ...f, brightness: 65, focus: "舞台中心" };
  if (f.id === "e4") return { ...f, brightness: 30 };
  return { ...f };
});

export const SAMPLE_SNAPSHOTS: VersionSnapshot[] = [
  {
    ...createVersionSnapshot(
      "版本A - 首演版",
      "首演定稿版本，包含基础Cue序列和灯具预设",
      CUES_VERSION_A as any,
      FIXTURES_VERSION_A
    ),
    id: "snapshot-a",
    createdAt: "2025-06-18T14:30:00.000Z",
  },
  {
    ...createVersionSnapshot(
      "版本B - 彩排调整",
      "根据彩排反馈调整：Cue12/18亮度微调，新增Cue22效果光，谢幕整体提亮",
      CUES_VERSION_B as any,
      FIXTURES_VERSION_B
    ),
    id: "snapshot-b",
    createdAt: "2025-06-19T20:15:00.000Z",
  },
];

export function saveSnapshots(snapshots: VersionSnapshot[]): void {
  try {
    localStorage.setItem("cue-snapshots", JSON.stringify(snapshots));
  } catch (e) {
    console.error("Failed to save snapshots:", e);
  }
}

export function loadSnapshots(): VersionSnapshot[] {
  try {
    const stored = localStorage.getItem("cue-snapshots");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load snapshots:", e);
  }
  return SAMPLE_SNAPSHOTS;
}
