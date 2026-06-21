import { FIXTURES, type LightFixture, type LightType } from "./fixtures";

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

const TYPE_KEYWORDS: Record<string, LightType> = {
  "面光": "面光",
  "侧光": "侧光",
  "逆光": "逆光",
  "效果光": "效果光",
};

function parseChannelRange(rangeStr: string): string[] {
  const channels: string[] = [];
  const segments = rangeStr.split(/[，,、;；]+/).map((s) => s.trim()).filter(Boolean);

  for (const seg of segments) {
    const rangeMatch = seg.match(/CH\s*(\d+)\s*[-–—~至到]\s*(\d+)/i);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      const [s, e] = start <= end ? [start, end] : [end, start];
      for (let i = s; i <= e; i++) {
        channels.push(`CH${String(i).padStart(3, "0")}`);
      }
      continue;
    }
    const singleMatches = seg.match(/CH\s*(\d+)/gi);
    if (singleMatches) {
      for (const m of singleMatches) {
        const num = m.match(/\d+/);
        if (num) {
          channels.push(`CH${String(parseInt(num[0], 10)).padStart(3, "0")}`);
        }
      }
    }
  }
  return Array.from(new Set(channels));
}

function parseFixtureNumbers(text: string): string[] {
  const numbers: string[] = [];
  const patterns = [
    /FOH-\d+/gi,
    /SL-\d+/gi,
    /SR-\d+/gi,
    /BL-\d+/gi,
    /FX-\d+/gi,
  ];
  for (const pat of patterns) {
    const matches = text.match(pat);
    if (matches) {
      numbers.push(...matches.map((m) => m.toUpperCase()));
    }
  }
  return numbers;
}

export function parseCueFixtures(cue: Cue, allFixtures: LightFixture[] = FIXTURES): LightFixture[] {
  if (!cue || !cue.fixtures || !cue.fixtures.trim()) return [];

  const text = cue.fixtures.trim();

  if (text === "全台" || text === "全台灯具") {
    return [...allFixtures];
  }

  for (const [keyword, lightType] of Object.entries(TYPE_KEYWORDS)) {
    if (text.includes(keyword) || text.includes(`全台${keyword}`)) {
      return allFixtures.filter((f) => f.type === lightType);
    }
  }

  const channels = parseChannelRange(text);
  if (channels.length > 0) {
    return allFixtures.filter((f) => channels.includes(f.channel.toUpperCase()));
  }

  const fixtureNumbers = parseFixtureNumbers(text);
  if (fixtureNumbers.length > 0) {
    return allFixtures.filter((f) => fixtureNumbers.includes(f.number.toUpperCase()));
  }

  return [];
}

export function parseCueBrightness(cue: Cue): number | null {
  if (!cue || !cue.brightnessChange || !cue.brightnessChange.trim()) return null;
  const text = cue.brightnessChange.trim();
  const match = text.match(/(\d+(?:\.\d+)?)\s*%?/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function hasBrightnessField(cue: Cue): boolean {
  if (!cue || !cue.brightnessChange) return false;
  return cue.brightnessChange.trim().length > 0;
}

export interface CueFixtureDiff {
  fixtureId: string;
  fixtureNumber: string;
  cueBrightness: number | null;
  actualBrightness: number;
  cueFocus: string | null;
  actualFocus: string;
  brightnessDiffers: boolean;
  focusDiffers: boolean;
}

export function getCueFixtureDiffs(
  cue: Cue,
  allFixtures: LightFixture[] = FIXTURES
): CueFixtureDiff[] {
  const cueFixtures = parseCueFixtures(cue, allFixtures);
  const cueBrightness = parseCueBrightness(cue);
  const hasCueBrightness = hasBrightnessField(cue);

  return cueFixtures.map((f) => {
    const effectiveCueBrightness = hasCueBrightness ? cueBrightness : null;
    const brightnessDiffers = effectiveCueBrightness !== null && effectiveCueBrightness !== f.brightness;
    const focusDiffers = hasCueBrightness && cueBrightness !== null
      ? false
      : false;

    return {
      fixtureId: f.id,
      fixtureNumber: f.number,
      cueBrightness: effectiveCueBrightness,
      actualBrightness: f.brightness,
      cueFocus: null,
      actualFocus: f.focus,
      brightnessDiffers,
      focusDiffers,
    };
  });
}

export function hasCueFixtureDivergence(
  cue: Cue,
  allFixtures: LightFixture[] = FIXTURES
): boolean {
  const diffs = getCueFixtureDiffs(cue, allFixtures);
  return diffs.some((d) => d.brightnessDiffers || d.focusDiffers);
}

export function syncCueBrightnessFromFixtures(
  cue: Cue,
  allFixtures: LightFixture[] = FIXTURES
): Cue {
  const cueFixtures = parseCueFixtures(cue, allFixtures);
  if (cueFixtures.length === 0) return cue;

  const brightnesses = cueFixtures.map((f) => f.brightness);
  const avg = Math.round(brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length);

  return {
    ...cue,
    brightnessChange: `亮度${avg}%`,
  };
}
