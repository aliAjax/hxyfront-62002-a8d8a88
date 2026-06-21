export interface VersionNote {
  id: string;
  versionName: string;
  relatedCues: string;
  adjustmentReason: string;
  pendingItems: string;
  confirmed: boolean;
  updatedAt: string;
}

export const INITIAL_VERSION_NOTES: VersionNote[] = [
  {
    id: "note-1",
    versionName: "版本A - 首演版",
    relatedCues: "Cue 12, Cue 18",
    adjustmentReason: "冷蓝侧光亮度从70%调至65%，追光入场时机延后2秒，配合演员走位调整。",
    pendingItems: "",
    confirmed: true,
    updatedAt: "2025-06-18 14:30",
  },
  {
    id: "note-2",
    versionName: "版本B - 彩排调整",
    relatedCues: "Cue 24",
    adjustmentReason: "谢幕灯光整体提亮，面光从70%提升至80%，暖色调更加饱满。",
    pendingItems: "需与导演确认谢幕音乐配合点",
    confirmed: false,
    updatedAt: "2025-06-19 20:15",
  },
];
