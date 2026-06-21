export type LightType = "面光" | "侧光" | "逆光" | "效果光";

export interface LightFixture {
  id: string;
  number: string;
  channel: string;
  brightness: number;
  color: string;
  focus: string;
  notes: string;
  type: LightType;
  x: number;
  y: number;
}

export const LIGHT_TYPE_COLORS: Record<LightType, string> = {
  面光: "#7c3aed",
  侧光: "#f59e0b",
  逆光: "#06b6d4",
  效果光: "#ef4444",
};

export const FIXTURES: LightFixture[] = [
  { id: "f1", number: "FOH-01", channel: "CH001", brightness: 80, color: "R02 曙红", focus: "舞台中心偏左", notes: "主面光，需与FOH-02平衡", type: "面光", x: 340, y: 500 },
  { id: "f2", number: "FOH-02", channel: "CH002", brightness: 75, color: "R02 曙红", focus: "舞台中心偏右", notes: "主面光，需与FOH-01平衡", type: "面光", x: 560, y: 500 },
  { id: "f3", number: "FOH-03", channel: "CH003", brightness: 65, color: "R12 粉红", focus: "门口区域", notes: "追光入场备用，需演员走位确认", type: "面光", x: 450, y: 520 },
  { id: "f4", number: "FOH-04", channel: "CH004", brightness: 0, color: "R08 深红", focus: "台口前区", notes: "备灯，Cue12后启用", type: "面光", x: 250, y: 510 },
  { id: "f5", number: "FOH-05", channel: "CH005", brightness: 0, color: "R08 深红", focus: "台口前区", notes: "备灯，Cue12后启用", type: "面光", x: 650, y: 510 },

  { id: "s1", number: "SL-01", channel: "CH011", brightness: 65, color: "HT201 冷蓝", focus: "二幕左区", notes: "冷蓝侧光，Cue12核心灯", type: "侧光", x: 80, y: 180 },
  { id: "s2", number: "SL-02", channel: "CH012", brightness: 55, color: "HT201 冷蓝", focus: "二幕中区", notes: "冷蓝侧光，与SR-01对称", type: "侧光", x: 80, y: 300 },
  { id: "s3", number: "SL-03", channel: "CH013", brightness: 40, color: "HT202 淡蓝", focus: "一幕左区", notes: "过渡灯，需确认焦点", type: "侧光", x: 80, y: 420 },
  { id: "s4", number: "SR-01", channel: "CH021", brightness: 65, color: "HT201 冷蓝", focus: "二幕右区", notes: "冷蓝侧光，Cue12核心灯", type: "侧光", x: 820, y: 180 },
  { id: "s5", number: "SR-02", channel: "CH022", brightness: 55, color: "HT201 冷蓝", focus: "二幕中区", notes: "冷蓝侧光，与SL-02对称", type: "侧光", x: 820, y: 300 },
  { id: "s6", number: "SR-03", channel: "CH023", brightness: 40, color: "HT202 淡蓝", focus: "一幕右区", notes: "过渡灯，需确认焦点", type: "侧光", x: 820, y: 420 },

  { id: "b1", number: "BL-01", channel: "CH031", brightness: 70, color: "HT120 淡蓝", focus: "舞台后区中心", notes: "主逆光，营造纵深", type: "逆光", x: 350, y: 80 },
  { id: "b2", number: "BL-02", channel: "CH032", brightness: 60, color: "HT120 淡蓝", focus: "舞台后区偏右", notes: "辅助逆光", type: "逆光", x: 550, y: 80 },
  { id: "b3", number: "BL-03", channel: "CH033", brightness: 50, color: "R80 原色蓝", focus: "后区左角", notes: "角光补充", type: "逆光", x: 200, y: 70 },
  { id: "b4", number: "BL-04", channel: "CH034", brightness: 50, color: "R80 原色蓝", focus: "后区右角", notes: "角光补充", type: "逆光", x: 700, y: 70 },

  { id: "e1", number: "FX-01", channel: "CH041", brightness: 30, color: "R326 紫色", focus: "舞台中心上方", notes: "效果灯，二幕高潮用", type: "效果光", x: 450, y: 260 },
  { id: "e2", number: "FX-02", channel: "CH042", brightness: 45, color: "R314 橙色", focus: "左前区地面", notes: "地排灯，模拟火光", type: "效果光", x: 280, y: 440 },
  { id: "e3", number: "FX-03", channel: "CH043", brightness: 35, color: "R314 橙色", focus: "右前区地面", notes: "地排灯，模拟火光", type: "效果光", x: 620, y: 440 },
  { id: "e4", number: "FX-04", channel: "CH044", brightness: 20, color: "R02 曙红", focus: "全台散光", notes: "谢幕暖色氛围，Cue24启用", type: "效果光", x: 450, y: 160 },
];
