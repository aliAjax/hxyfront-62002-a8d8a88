export interface Cue {
  id: string;
  number: string;
  sceneName: string;
  fixtures: string;
  brightnessChange: string;
  triggerNote: string;
  versionNote: string;
}

export const INITIAL_CUES: Cue[] = [
  {
    id: "cue-12",
    number: "Cue 12",
    sceneName: "冷蓝侧光",
    fixtures: "CH 021-028",
    brightnessChange: "亮度65%",
    triggerNote: "二幕开场",
    versionNote: "版本A",
  },
  {
    id: "cue-18",
    number: "Cue 18",
    sceneName: "追光入场",
    fixtures: "FOH-03",
    brightnessChange: "亮度100%",
    triggerNote: "需演员走位确认",
    versionNote: "版本A",
  },
  {
    id: "cue-24",
    number: "Cue 24",
    sceneName: "暖色谢幕",
    fixtures: "全台面光",
    brightnessChange: "亮度80%",
    triggerNote: "谢幕音乐起",
    versionNote: "版本B",
  },
];

export const EMPTY_CUE: Cue = {
  id: "",
  number: "",
  sceneName: "",
  fixtures: "",
  brightnessChange: "",
  triggerNote: "",
  versionNote: "",
};
