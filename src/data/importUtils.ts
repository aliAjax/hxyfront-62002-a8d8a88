import { type LightFixture, type LightType } from "./fixtures";
import { type Cue } from "./cues";

export type ImportDataType = "fixtures" | "cues";

export const FIXTURE_FIELD_ALIASES: Record<string, string | string[]> = {
  number: ["number", "编号", "灯具编号", "fixture", "fixturenumber", "num", "灯具号"],
  channel: ["channel", "通道", "通道号", "ch", "channelno"],
  type: ["type", "类型", "灯区", "灯区类型", "灯型"],
  color: ["color", "色片", "色片编号", "gel", "gelfilter"],
  focus: ["focus", "焦点", "焦点位置", "spot"],
  notes: ["notes", "备注", "说明", "remark", "comment"],
  brightness: ["brightness", "亮度", "亮度预设", "level"],
  x: ["x", "x坐标", "xaxis", "xpos", "横向", "横坐标"],
  y: ["y", "y坐标", "yaxis", "ypos", "纵向", "纵坐标"],
};

export const CUE_FIELD_ALIASES: Record<string, string | string[]> = {
  number: ["number", "编号", "cue编号", "cue", "cueno", "cuenumber"],
  sceneName: ["scenename", "场景", "场景名称", "scene", "name", "场景名"],
  fixtures: ["fixtures", "灯具", "灯具范围", "channel", "灯具编号"],
  brightnessChange: ["brightnesschange", "亮度", "亮度变化", "亮度预设", "level", "亮度调整"],
  triggerNote: ["triggernote", "触发", "触发条件", "触发备注", "trigger"],
  versionNote: ["versionnote", "版本", "版本备注", "version", "版本号"],
};

const VALID_LIGHT_TYPES: LightType[] = ["面光", "侧光", "逆光", "效果光"];

const CHANNEL_PATTERN = /^CH\s*\d{1,3}$/i;
const CHANNEL_NORMALIZE = /^CH\s*0*(\d{1,3})$/i;

export function normalizeChannel(ch: string): string {
  const m = ch.trim().match(CHANNEL_NORMALIZE);
  if (m) return `CH${m[1].padStart(3, "0")}`;
  return ch.trim().toUpperCase();
}

export interface ImportError {
  rowIndex: number;
  rowNumber: number;
  type: "error" | "warning" | "info";
  field?: string;
  message: string;
  suggestion?: string;
}

export interface FixtureRow {
  rowIndex: number;
  rawRow: string[];
  parsed: Partial<LightFixture>;
  valid: boolean;
}

export interface CueRow {
  rowIndex: number;
  rawRow: string[];
  parsed: Partial<Cue>;
  valid: boolean;
}

export interface FieldMap {
  detectedHeaders: string[];
  mappedFields: Record<number, string>;
  extraColumns: number[];
}

export interface FixtureImportResult {
  type: "fixtures";
  fieldMap: FieldMap;
  rows: FixtureRow[];
  validRows: FixtureRow[];
  errorRows: FixtureRow[];
  emptyRows: number[];
  errors: ImportError[];
  conflicts: {
    duplicateNumbers: { number: string; rows: number[] }[];
    duplicateChannels: { channel: string; rows: number[] }[];
    numberConflictsWithExisting: { number: string; rows: number[] }[];
    channelConflictsWithExisting: { channel: string; rows: number[] }[];
  };
}

export interface CueImportResult {
  type: "cues";
  fieldMap: FieldMap;
  rows: CueRow[];
  validRows: CueRow[];
  errorRows: CueRow[];
  emptyRows: number[];
  errors: ImportError[];
  conflicts: {
    duplicateCueNumbers: { number: string; rows: number[] }[];
    missingFixtures: { fixtureRef: string; rows: number[] }[];
    cueNumberConflictsWithExisting: { number: string; rows: number[] }[];
  };
}

export type ImportResult = FixtureImportResult | CueImportResult;

function splitCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\n") {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else if (char === "\r") {
        continue;
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

function parseChannelsField(field: string): string {
  if (CHANNEL_PATTERN.test(field.trim())) {
    return normalizeChannel(field);
  }
  const num = field.trim().match(/^(\d{1,3})$/);
  if (num) {
    return `CH${num[1].padStart(3, "0")}`;
  }
  return field.trim().toUpperCase();
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_\-\/()（）]+/g, "");
}

function mapFields(headers: string[], aliases: Record<string, string | string[]>): FieldMap {
  const mappedFields: Record<number, string> = {};
  const extraColumns: number[] = [];
  const usedFields = new Set<string>();
  const detectedHeaders = headers.map((h) => h.trim());

  for (let i = 0; i < headers.length; i++) {
    const rawHeader = normalizeHeader(headers[i]);
    let found = false;

    for (const [fieldName, aliasesList] of Object.entries(aliases)) {
      const aliasArr = Array.isArray(aliasesList) ? aliasesList : [aliasesList];
      const normalizedAliases = aliasArr.map((a) => normalizeHeader(a));
      if (normalizedAliases.some((a) => a === rawHeader || rawHeader.includes(a))) {
        if (!usedFields.has(fieldName)) {
          mappedFields[i] = fieldName;
          usedFields.add(fieldName);
          found = true;
        }
        break;
      }
    }

    if (!found && headers[i].trim().length > 0) {
      extraColumns.push(i);
    }
  }

  return { detectedHeaders, mappedFields, extraColumns };
}

function inferBrightness(val: string): number {
  const s = val.trim();
  if (!s) return 0;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (m) {
    const v = Math.round(parseFloat(m[1]));
    return Math.max(0, Math.min(100, v));
  }
  return 0;
}

function inferLightType(val: string): LightType | null {
  const s = val.trim();
  if (!s) return null;
  for (const t of VALID_LIGHT_TYPES) {
    if (s.includes(t)) return t;
  }
  if (s.includes("foh") || s.includes("面") || s.includes("front")) return "面光";
  if (s.includes("side") || s.includes("侧")) return "侧光";
  if (s.includes("back") || s.includes("逆")) return "逆光";
  if (s.includes("effect") || s.includes("fx") || s.includes("效果") || s.includes("效")) return "效果光";
  return null;
}

function isRowEmpty(row: string[]): boolean {
  return row.every((cell) => !cell || cell.trim().length === 0);
}

export function parseAndValidateFixtures(
  csvText: string,
  existingFixtures: LightFixture[]
): FixtureImportResult {
  const rawRows = splitCSV(csvText);
  const emptyResult: FixtureImportResult = {
    type: "fixtures",
    fieldMap: { detectedHeaders: [], mappedFields: {}, extraColumns: [] },
    rows: [],
    validRows: [],
    errorRows: [],
    emptyRows: [],
    errors: [],
    conflicts: {
      duplicateNumbers: [],
      duplicateChannels: [],
      numberConflictsWithExisting: [],
      channelConflictsWithExisting: [],
    },
  };

  if (rawRows.length === 0) return emptyResult;

  const headerRow = rawRows[0];
  const fieldMap = mapFields(headerRow, FIXTURE_FIELD_ALIASES);

  const dataRows = rawRows.slice(1);
  const fixtureRows: FixtureRow[] = [];
  const errors: ImportError[] = [];
  const emptyRows: number[] = [];

  const numberToRows: Record<string, number[]> = {};
  const channelToRows: Record<string, number[]> = {};

  for (let i = 0; i < dataRows.length; i++) {
    const rawRow = dataRows[i];
    const rowNumber = i + 2;
    const rowIndex = i + 1;

    if (isRowEmpty(rawRow)) {
      emptyRows.push(rowNumber);
      continue;
    }

    const parsed: Partial<LightFixture> = {};
    let rowValid = true;

    for (const [colIdx, fieldName] of Object.entries(fieldMap.mappedFields)) {
      const rawVal = rawRow[parseInt(colIdx, 10)] ?? "";
      const val = rawVal;

      switch (fieldName) {
        case "number":
          parsed.number = val.trim();
          break;
        case "channel":
          parsed.channel = parseChannelsField(val);
          break;
        case "type":
          parsed.type = inferLightType(val);
          break;
        case "color":
          parsed.color = val.trim();
          break;
        case "focus":
          parsed.focus = val.trim();
          break;
        case "notes":
          parsed.notes = val.trim();
          break;
        case "brightness":
          parsed.brightness = inferBrightness(val);
          break;
        case "x": {
          const n = parseFloat(val);
          if (!isNaN(n)) parsed.x = n;
          break;
        }
        case "y": {
          const n = parseFloat(val);
          if (!isNaN(n)) parsed.y = n;
          break;
        }
      }
    }

    if (!parsed.number || parsed.number.length === 0) {
      errors.push({
        rowIndex,
        rowNumber,
        type: "error",
        field: "number",
        message: "灯具编号为空",
        suggestion: "请在「灯具编号」列填入有效的编号（如 FOH-01）",
      });
      rowValid = false;
    } else {
      if (!numberToRows[parsed.number]) numberToRows[parsed.number] = [];
      numberToRows[parsed.number].push(rowNumber);
    }

    if (!parsed.channel || parsed.channel.length === 0) {
      errors.push({
        rowIndex,
        rowNumber,
        type: "error",
        field: "channel",
        message: "通道号为空",
        suggestion: "通道号格式应为 CH001 或 1",
      });
      rowValid = false;
    } else {
      CHANNEL_PATTERN.lastIndex = 0;
      if (!CHANNEL_PATTERN.test(parsed.channel)) {
        errors.push({
          rowIndex,
          rowNumber,
          type: "error",
          field: "channel",
          message: `通道号「${parsed.channel}」格式不正确`,
          suggestion: "通道号格式应为 CH001 或 纯数字1-999，例如 CH001、CH12、256",
        });
        rowValid = false;
      } else {
        if (!channelToRows[parsed.channel]) channelToRows[parsed.channel] = [];
        channelToRows[parsed.channel].push(rowNumber);
      }
    }

    if (!parsed.type) {
      errors.push({
        rowIndex,
        rowNumber,
        type: "warning",
        field: "type",
        message: "未识别的灯区类型，将默认为「面光」",
        suggestion: "灯区类型应为：面光、侧光、逆光、效果光",
      });
      parsed.type = "面光";
    }

    if (parsed.brightness === undefined) parsed.brightness = 0;

    fixtureRows.push({ rowIndex, rawRow, parsed, valid: rowValid });
  }

  const duplicateNumbers = Object.entries(numberToRows)
    .filter(([, rows]) => rows.length > 1)
    .map(([number, rows]) => ({ number, rows }));

  const duplicateChannels = Object.entries(channelToRows)
    .filter(([, rows]) => rows.length > 1)
    .map(([channel, rows]) => ({ channel, rows }));

  for (const { number, rows } of duplicateNumbers) {
    errors.push({
      rowIndex: rows[0] - 2,
      rowNumber: rows[0],
      type: "error",
      field: "number",
      message: `灯具编号「${number}」在导入数据中重复出现 ${rows.length} 次（行 ${rows.join("、")}）`,
      suggestion: "请在原始表格中修正重复的灯具编号",
    });
  }

  for (const { channel, rows } of duplicateChannels) {
    errors.push({
      rowIndex: rows[0] - 2,
      rowNumber: rows[0],
      type: "error",
      field: "channel",
      message: `通道号「${channel}」在导入数据中重复出现 ${rows.length} 次（行 ${rows.join("、")}）`,
      suggestion: "请在原始表格中修正重复的通道号",
    });
  }

  const existingNumbers = new Set(existingFixtures.map((f) => f.number));
  const existingChannels = new Set(existingFixtures.map((f) => f.channel));

  const numberConflictsWithExisting: { number: string; rows: number[] }[] = [];
  const channelConflictsWithExisting: { channel: string; rows: number[] }[] = [];

  for (const row of fixtureRows) {
    const n = row.parsed.number;
    if (n && existingNumbers.has(n)) {
      const existing = numberConflictsWithExisting.find((c) => c.number === n);
      if (existing) existing.rows.push(row.rowNumber);
      else numberConflictsWithExisting.push({ number: n, rows: [row.rowNumber] });
    }
    const ch = row.parsed.channel;
    if (ch && existingChannels.has(ch)) {
      const existing = channelConflictsWithExisting.find((c) => c.channel === ch);
      if (existing) existing.rows.push(row.rowNumber);
      else channelConflictsWithExisting.push({ channel: ch, rows: [row.rowNumber] });
    }
  }

  for (const { number, rows } of numberConflictsWithExisting) {
    errors.push({
      rowIndex: rows[0] - 2,
      rowNumber: rows[0],
      type: "warning",
      field: "number",
      message: `灯具编号「${number}」已存在于当前工作台`,
      suggestion: "导入后将覆盖现有灯具，或修改编号后重新导入",
    });
  }

  for (const { channel, rows } of channelConflictsWithExisting) {
    errors.push({
      rowIndex: rows[0] - 2,
      rowNumber: rows[0],
      type: "warning",
      field: "channel",
      message: `通道号「${channel}」已存在于当前工作台`,
      suggestion: "导入后将覆盖现有灯具，或修改通道号后重新导入",
    });
  }

  const validRows = fixtureRows.filter((r) => r.valid);
  const errorRows = fixtureRows.filter((r) => !r.valid);

  return {
    type: "fixtures",
    fieldMap,
    rows: fixtureRows,
    validRows,
    errorRows,
    emptyRows,
    errors,
    conflicts: {
      duplicateNumbers,
      duplicateChannels,
      numberConflictsWithExisting,
      channelConflictsWithExisting,
    },
  };
}

export function parseAndValidateCues(
  csvText: string,
  existingFixtures: LightFixture[],
  existingCues: Cue[]
): CueImportResult {
  const rawRows = splitCSV(csvText);
  const emptyResult: CueImportResult = {
    type: "cues",
    fieldMap: { detectedHeaders: [], mappedFields: {}, extraColumns: [] },
    rows: [],
    validRows: [],
    errorRows: [],
    emptyRows: [],
    errors: [],
    conflicts: {
      duplicateCueNumbers: [],
      missingFixtures: [],
      cueNumberConflictsWithExisting: [],
    },
  };

  if (rawRows.length === 0) return emptyResult;

  const headerRow = rawRows[0];
  const fieldMap = mapFields(headerRow, CUE_FIELD_ALIASES);

  const dataRows = rawRows.slice(1);
  const cueRows: CueRow[] = [];
  const errors: ImportError[] = [];
  const emptyRows: number[] = [];

  const cueNumberToRows: Record<string, number[]> = {};
  const missingFixtureRefs: Record<string, number[]> = {};
  const validFixtureNumbers = new Set(existingFixtures.map((f) => f.number.toUpperCase()));
  const validChannels = new Set(existingFixtures.map((f) => f.channel.toUpperCase()));

  for (let i = 0; i < dataRows.length; i++) {
    const rawRow = dataRows[i];
    const rowNumber = i + 2;
    const rowIndex = i + 1;

    if (isRowEmpty(rawRow)) {
      emptyRows.push(rowNumber);
      continue;
    }

    const parsed: Partial<Cue> = {};
    let rowValid = true;

    for (const [colIdx, fieldName] of Object.entries(fieldMap.mappedFields)) {
      const rawVal = rawRow[parseInt(colIdx, 10)] ?? "";

      switch (fieldName) {
        case "number":
          parsed.number = rawVal.trim();
          break;
        case "sceneName":
          parsed.sceneName = rawVal.trim();
          break;
        case "fixtures":
          parsed.fixtures = rawVal.trim();
          break;
        case "brightnessChange":
          parsed.brightnessChange = rawVal.trim();
          break;
        case "triggerNote":
          parsed.triggerNote = rawVal.trim();
          break;
        case "versionNote":
          parsed.versionNote = rawVal.trim();
          break;
      }
    }

    if (!parsed.number || parsed.number.length === 0) {
      errors.push({
        rowIndex,
        rowNumber,
        type: "error",
        field: "number",
        message: "Cue编号为空",
        suggestion: "请在「Cue编号」列填入有效的编号（如 Cue 12）",
      });
      rowValid = false;
    } else {
      if (!cueNumberToRows[parsed.number]) cueNumberToRows[parsed.number] = [];
      cueNumberToRows[parsed.number].push(rowNumber);
    }

    if (!parsed.sceneName || parsed.sceneName.length === 0) {
      errors.push({
        rowIndex,
        rowNumber,
        type: "warning",
        field: "sceneName",
        message: "场景名称为空",
        suggestion: "建议填写场景名称，方便辨识场景",
      });
      parsed.sceneName = "(未命名场景)";
    }

    if (!parsed.fixtures || parsed.fixtures.length === 0) {
      errors.push({
        rowIndex,
        rowNumber,
        type: "warning",
        field: "fixtures",
        message: "灯具范围为空",
        suggestion: "请填写引用的灯具编号或通道号",
      });
    } else {
      const fixtureText = parsed.fixtures;
      const fixtureRefs = extractFixtureReferences(fixtureText);

      for (const ref of fixtureRefs) {
        const refUpper = ref.toUpperCase();
        if (
          !validFixtureNumbers.has(refUpper) &&
          !validChannels.has(refUpper) &&
          !/全台/.test(fixtureText) &&
          !/面光|侧光|逆光|效果光/.test(fixtureText)
        ) {
          if (!missingFixtureRefs[ref]) missingFixtureRefs[ref] = [];
          if (!missingFixtureRefs[ref].includes(rowNumber)) {
            missingFixtureRefs[ref].push(rowNumber);
          }
        }
      }
    }

    cueRows.push({ rowIndex, rawRow, parsed, valid: rowValid });
  }

  const duplicateCueNumbers = Object.entries(cueNumberToRows)
    .filter(([, rows]) => rows.length > 1)
    .map(([number, rows]) => ({ number, rows }));

  for (const { number, rows } of duplicateCueNumbers) {
    errors.push({
      rowIndex: rows[0] - 2,
      rowNumber: rows[0],
      type: "error",
      field: "number",
      message: `Cue编号「${number}」在导入数据中重复出现 ${rows.length} 次（行 ${rows.join("、")}）`,
      suggestion: "请在原始表格中修正重复的Cue编号",
    });
  }

  const missingFixtures = Object.entries(missingFixtureRefs)
    .map(([fixtureRef, rows]) => ({ fixtureRef, rows }));

  for (const { fixtureRef, rows } of missingFixtures) {
    errors.push({
      rowIndex: rows[0] - 2,
      rowNumber: rows[0],
      type: "warning",
      field: "fixtures",
      message: `引用的灯具「${fixtureRef}」在当前工作台中未找到对应灯具（行 ${rows.join("、")}）`,
      suggestion: "请先导入灯具或检查灯具编号/通道号是否正确",
    });
  }

  const existingCueNumbers = new Set(existingCues.map((c) => c.number));
  const cueNumberConflictsWithExisting: { number: string; rows: number[] }[] = [];

  for (const row of cueRows) {
    const n = row.parsed.number;
    if (n && existingCueNumbers.has(n)) {
      const existing = cueNumberConflictsWithExisting.find((c) => c.number === n);
      if (existing) existing.rows.push(row.rowNumber);
      else cueNumberConflictsWithExisting.push({ number: n, rows: [row.rowNumber] });
    }
  }

  for (const { number, rows } of cueNumberConflictsWithExisting) {
    errors.push({
      rowIndex: rows[0] - 2,
      rowNumber: rows[0],
      type: "warning",
      field: "number",
      message: `Cue编号「${number}」已存在于当前工作台`,
      suggestion: "导入后将覆盖现有Cue，或修改编号后重新导入",
    });
  }

  const validRows = cueRows.filter((r) => r.valid);
  const errorRows = cueRows.filter((r) => !r.valid);

  return {
    type: "cues",
    fieldMap,
    rows: cueRows,
    validRows,
    errorRows,
    emptyRows,
    errors,
    conflicts: {
      duplicateCueNumbers,
      missingFixtures,
      cueNumberConflictsWithExisting,
    },
  };
}

function extractFixtureReferences(text: string): string[] {
  const refs: string[] = [];
  const patterns = [
    /FOH-\d+/gi,
    /SL-\d+/gi,
    /SR-\d+/gi,
    /BL-\d+/gi,
    /FX-\d+/gi,
    /CH\s*\d+/gi,
  ];
  for (const pat of patterns) {
    const matches = text.match(pat);
    if (matches) {
      refs.push(...matches.map((m) => m.toUpperCase().replace(/\s+/g, "")));
    }
  }
  return Array.from(new Set(refs));
}

export function buildFixturesFromImport(
  validRows: FixtureRow[],
  existingFixtures: LightFixture[]
): LightFixture[] {
  const result: LightFixture[] = [];
  const byNumber: Record<string, number> = {};
  existingFixtures.forEach((f, i) => {
    byNumber[f.number] = i;
  });

  let nextIdNum = existingFixtures.length + 1;

  for (const row of validRows) {
    const p = row.parsed;
    const existingIdx = p.number !== undefined ? byNumber[p.number] : undefined;
    const base = existingIdx !== undefined ? { ...existingFixtures[existingIdx] } : null;

    const id = base?.id || `f${nextIdNum++}`;
    result.push({
      id,
      number: p.number || base?.number || "",
      channel: p.channel || base?.channel || "",
      brightness: p.brightness !== undefined ? p.brightness : (base?.brightness !== undefined ? base.brightness : 0),
      color: p.color !== undefined ? p.color : (base?.color !== undefined ? base.color : ""),
      focus: p.focus !== undefined ? p.focus : (base?.focus || ""),
      notes: p.notes !== undefined ? p.notes : (base?.notes !== undefined ? base.notes : ""),
      type: (p.type as LightType) || base?.type || "面光",
      x: p.x !== undefined ? p.x : (base?.x !== undefined ? base.x : 450),
      y: p.y !== undefined ? p.y : (base?.y !== undefined ? base.y : 300),
    });
  }

  return result;
}

export function buildCuesFromImport(
  validRows: CueRow[],
  existingCues: Cue[]
): Cue[] {
  const result: Cue[] = [];
  const byNumber: Record<string, number> = {};
  existingCues.forEach((c, i) => {
    byNumber[c.number] = i;
  });

  let nextIdNum = existingCues.length + 1;

  for (const row of validRows) {
    const p = row.parsed;
    const existingIdx = p.number ? byNumber[p.number] : undefined;
    const base = existingIdx !== undefined ? { ...existingCues[existingIdx] } : null;

    const id = base?.id || `cue-${nextIdNum++}`;
    result.push({
      id,
      number: p.number || base?.number || "",
      sceneName: p.sceneName || base?.sceneName || "",
      fixtures: p.fixtures || base?.fixtures || "",
      brightnessChange: p.brightnessChange || base?.brightnessChange || "",
      triggerNote: p.triggerNote || base?.triggerNote || "",
      versionNote: p.versionNote || base?.versionNote || "",
    });
  }

  return result;
}

export function mergeFixturesWithExisting(
  existingFixtures: LightFixture[],
  newFixtures: LightFixture[]
): LightFixture[] {
  const byNumber: Record<string, number> = {};
  const next = [...existingFixtures];
  next.forEach((f, i) => {
    byNumber[f.number] = i;
  });

  for (const nf of newFixtures) {
    const idx = byNumber[nf.number];
    if (idx !== undefined) {
      next[idx] = { ...next[idx], ...nf, id: next[idx].id };
    } else {
      next.push(nf);
    }
  }
  return next;
}

export function mergeCuesWithExisting(
  existingCues: Cue[],
  newCues: Cue[]
): Cue[] {
  const byNumber: Record<string, number> = {};
  const next = [...existingCues];
  next.forEach((c, i) => {
    byNumber[c.number] = i;
  });

  for (const nc of newCues) {
    const idx = byNumber[nc.number];
    if (idx !== undefined) {
      next[idx] = { ...next[idx], ...nc, id: next[idx].id };
    } else {
      next.push(nc);
    }
  }
  return next;
}
