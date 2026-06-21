import type { LightFixture, LightType } from "../data/fixtures";
import type { Cue } from "../data/cues";

export type ImportDataType = "fixtures" | "cues" | "mixed" | "unknown";

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  recognized: boolean;
}

export interface ImportError {
  rowNumber: number;
  type: "error" | "warning" | "info";
  field?: string;
  value?: string;
  message: string;
  suggestion?: string;
}

export interface ImportConflict {
  type: "duplicate_number" | "duplicate_channel" | "missing_fixture" | "existing_number_conflict" | "existing_channel_conflict";
  description: string;
  affectedRows: number[];
  suggestion: string;
  existingItems?: string[];
}

export interface ParsedFixtureRow {
  rowNumber: number;
  raw: Record<string, string>;
  data: Partial<LightFixture>;
  isValid: boolean;
  errors: ImportError[];
}

export interface ParsedCueRow {
  rowNumber: number;
  raw: Record<string, string>;
  data: Partial<Cue>;
  isValid: boolean;
  errors: ImportError[];
}

export interface ImportPreviewResult {
  dataType: ImportDataType;
  headers: string[];
  fieldMappings: FieldMapping[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  emptyRows: number;
  extraColumns: string[];
  fixtureRows: ParsedFixtureRow[];
  cueRows: ParsedCueRow[];
  errors: ImportError[];
  conflicts: ImportConflict[];
  warnings: string[];
}

const FIXTURE_FIELD_ALIASES: Record<string, string> = {
  "灯具编号": "number",
  "编号": "number",
  "灯号": "number",
  "number": "number",
  "fixture": "number",
  "fixture number": "number",
  "通道号": "channel",
  "通道": "channel",
  "channel": "channel",
  "ch": "channel",
  "灯区类型": "type",
  "类型": "type",
  "灯区": "type",
  "type": "type",
  "light type": "type",
  "亮度": "brightness",
  "亮度预设": "brightness",
  "brightness": "brightness",
  "色片": "color",
  "颜色": "color",
  "color": "color",
  "gel": "color",
  "焦点位置": "focus",
  "焦点": "focus",
  "focus": "focus",
  "备注": "notes",
  "说明": "notes",
  "notes": "notes",
  "x坐标": "x",
  "x": "x",
  "x位置": "x",
  "y坐标": "y",
  "y": "y",
  "y位置": "y",
};

const CUE_FIELD_ALIASES: Record<string, string> = {
  "cue编号": "number",
  "cue号": "number",
  "cue": "number",
  "编号": "number",
  "number": "number",
  "场景名称": "sceneName",
  "场景": "sceneName",
  "scene": "sceneName",
  "scene name": "sceneName",
  "灯具": "fixtures",
  "涉及灯具": "fixtures",
  "fixtures": "fixtures",
  "亮度变化": "brightnessChange",
  "亮度": "brightnessChange",
  "brightness": "brightnessChange",
  "brightness change": "brightnessChange",
  "触发时机": "triggerNote",
  "触发": "triggerNote",
  "trigger": "triggerNote",
  "trigger note": "triggerNote",
  "版本备注": "versionNote",
  "版本": "versionNote",
  "version": "versionNote",
  "version note": "versionNote",
};

const LIGHT_TYPE_MAP: Record<string, LightType> = {
  "面光": "面光",
  "front": "面光",
  "front light": "面光",
  "侧光": "侧光",
  "side": "侧光",
  "side light": "侧光",
  "逆光": "逆光",
  "back": "逆光",
  "back light": "逆光",
  "效果光": "效果光",
  "效果": "效果光",
  "effect": "效果光",
  "fx": "效果光",
};

const CHANNEL_PATTERN = /^CH\s*\d{1,4}$/i;
const FIXTURE_NUMBER_PATTERNS = [
  /^FOH-\d+$/i,
  /^SL-\d+$/i,
  /^SR-\d+$/i,
  /^BL-\d+$/i,
  /^FX-\d+$/i,
  /^B-\d+$/i,
  /^S-\d+$/i,
  /^F-\d+$/i,
];

export function parseCSV(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/);
  const result: string[][] = [];

  for (const line of lines) {
    const row: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === "," || char === "\t") {
          row.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
    }

    row.push(current.trim());
    result.push(row);
  }

  return result;
}

export function detectDataType(headers: string[]): ImportDataType {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  let fixtureScore = 0;
  let cueScore = 0;

  const fixtureKeywords = [
    "灯具编号", "灯号", "灯具", "通道号", "通道", "灯区类型", "灯区",
    "色片", "颜色", "焦点位置", "焦点", "亮度预设",
    "fixture", "channel", "light type", "color", "gel", "focus",
  ];

  const cueKeywords = [
    "cue编号", "cue号", "cue", "场景名称", "场景",
    "涉及灯具", "亮度变化", "触发时机", "触发", "版本备注", "版本",
    "scene name", "scene", "trigger note", "trigger", "version note", "version",
    "brightness change",
  ];

  for (const h of lowerHeaders) {
    for (const kw of fixtureKeywords) {
      if (h.includes(kw)) {
        fixtureScore++;
        break;
      }
    }
    if (h === "number" || h === "编号") fixtureScore++;
    if (h === "type" || h === "类型") fixtureScore++;
    if (h === "brightness" || h === "亮度") fixtureScore++;
    if (h === "notes" || h === "备注") fixtureScore++;
  }

  for (const h of lowerHeaders) {
    for (const kw of cueKeywords) {
      if (h.includes(kw)) {
        cueScore++;
        break;
      }
    }
    if (h === "scenename") cueScore += 2;
    if (h === "triggernote") cueScore++;
    if (h === "versionnote") cueScore++;
    if (h === "brightnesschange") cueScore++;
    if (h === "fixtures" && cueScore > 0) cueScore++;
  }

  if (fixtureScore > 0 && cueScore > 0) return "mixed";
  if (fixtureScore > 0) return "fixtures";
  if (cueScore > 0) return "cues";
  return "unknown";
}

export function mapFields(
  headers: string[],
  dataType: ImportDataType
): FieldMapping[] {
  const aliases =
    dataType === "fixtures"
      ? FIXTURE_FIELD_ALIASES
      : dataType === "cues"
      ? CUE_FIELD_ALIASES
      : { ...FIXTURE_FIELD_ALIASES, ...CUE_FIELD_ALIASES };

  return headers.map((header) => {
    const lowerHeader = header.toLowerCase().trim();
    const targetField = aliases[lowerHeader] || aliases[header.trim()] || "";
    return {
      sourceField: header,
      targetField,
      recognized: !!targetField,
    };
  });
}

function isEmptyRow(row: string[]): boolean {
  return row.every((cell) => !cell || cell.trim() === "");
}

function validateChannel(channel: string): { valid: boolean; normalized?: string; error?: string } {
  if (!channel || !channel.trim()) {
    return { valid: false, error: "通道号不能为空" };
  }

  const trimmed = channel.trim().toUpperCase();

  if (!CHANNEL_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: "通道号格式不正确",
    };
  }

  const numMatch = trimmed.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    return { valid: true, normalized: `CH${String(num).padStart(3, "0")}` };
  }

  return { valid: true, normalized: trimmed };
}

function validateFixtureNumber(number: string): { valid: boolean; error?: string } {
  if (!number || !number.trim()) {
    return { valid: false, error: "灯具编号不能为空" };
  }

  const trimmed = number.trim().toUpperCase();
  const matchesPattern = FIXTURE_NUMBER_PATTERNS.some((p) => p.test(trimmed));

  if (!matchesPattern) {
    return {
      valid: false,
      error: "灯具编号格式不规范，建议使用 FOH-XX / SL-XX / SR-XX / BL-XX / FX-XX 格式",
    };
  }

  return { valid: true };
}

function validateLightType(type: string): { valid: boolean; normalized?: LightType; error?: string } {
  if (!type || !type.trim()) {
    return { valid: false, error: "灯区类型不能为空" };
  }

  const trimmed = type.trim().toLowerCase();
  const normalized = LIGHT_TYPE_MAP[trimmed] || LIGHT_TYPE_MAP[type.trim()];

  if (!normalized) {
    return {
      valid: false,
      error: "灯区类型不正确，应为：面光、侧光、逆光、效果光",
    };
  }

  return { valid: true, normalized };
}

function validateBrightness(value: string): { valid: boolean; normalized?: number; error?: string } {
  if (!value || !value.trim()) {
    return { valid: true, normalized: 0 };
  }

  const numMatch = value.match(/\d+(?:\.\d+)?/);
  if (!numMatch) {
    return { valid: false, error: "亮度值格式不正确" };
  }

  const num = parseFloat(numMatch[0]);
  if (isNaN(num) || num < 0 || num > 100) {
    return { valid: false, error: "亮度值应在 0-100 之间" };
  }

  return { valid: true, normalized: Math.round(num) };
}

function parseFixtureRow(
  row: string[],
  headers: string[],
  fieldMappings: FieldMapping[],
  rowNumber: number
): ParsedFixtureRow {
  const raw: Record<string, string> = {};
  const data: Partial<LightFixture> = {};
  const errors: ImportError[] = [];

  headers.forEach((header, idx) => {
    raw[header] = row[idx] || "";
  });

  fieldMappings.forEach((mapping) => {
    if (!mapping.recognized) return;
    const value = raw[mapping.sourceField] || "";

    switch (mapping.targetField) {
      case "number":
        data.number = value.trim();
        break;
      case "channel":
        data.channel = value.trim();
        break;
      case "type":
        data.type = value.trim() as LightType;
        break;
      case "brightness":
        if (value.trim()) {
          const num = parseFloat(value.trim());
          if (!isNaN(num)) {
            data.brightness = Math.max(0, Math.min(100, Math.round(num)));
          }
        }
        break;
      case "color":
        data.color = value.trim();
        break;
      case "focus":
        data.focus = value.trim();
        break;
      case "notes":
        data.notes = value.trim();
        break;
      case "x":
        if (value.trim()) {
          const num = parseFloat(value.trim());
          if (!isNaN(num)) data.x = num;
        }
        break;
      case "y":
        if (value.trim()) {
          const num = parseFloat(value.trim());
          if (!isNaN(num)) data.y = num;
        }
        break;
    }
  });

  if (!data.number && !data.channel && !data.type) {
    return {
      rowNumber,
      raw,
      data: {},
      isValid: false,
      errors: [
        {
          rowNumber,
          type: "info",
          message: "空行或无法识别的数据行",
        },
      ],
    };
  }

  if (data.number) {
    const numCheck = validateFixtureNumber(data.number);
    if (!numCheck.valid && numCheck.error) {
      errors.push({
        rowNumber,
        type: "warning",
        field: "number",
        value: data.number,
        message: numCheck.error,
        suggestion: "请检查灯具编号格式",
      });
    } else {
      data.number = data.number.toUpperCase();
    }
  } else {
    errors.push({
      rowNumber,
      type: "error",
      field: "number",
      message: "缺少灯具编号",
      suggestion: "请添加灯具编号列",
    });
  }

  if (data.channel) {
    const chCheck = validateChannel(data.channel);
    if (!chCheck.valid && chCheck.error) {
      errors.push({
        rowNumber,
        type: "error",
        field: "channel",
        value: data.channel,
        message: chCheck.error,
        suggestion: "正确格式示例：CH001、CH012、CH100",
      });
    } else if (chCheck.normalized) {
      data.channel = chCheck.normalized;
    }
  } else {
    errors.push({
      rowNumber,
      type: "error",
      field: "channel",
      message: "缺少通道号",
      suggestion: "请添加通道号列",
    });
  }

  if (data.type) {
    const typeCheck = validateLightType(data.type);
    if (!typeCheck.valid && typeCheck.error) {
      errors.push({
        rowNumber,
        type: "error",
        field: "type",
        value: data.type,
        message: typeCheck.error,
        suggestion: "请从：面光、侧光、逆光、效果光 中选择",
      });
    } else if (typeCheck.normalized) {
      data.type = typeCheck.normalized;
    }
  } else {
    errors.push({
      rowNumber,
      type: "warning",
      field: "type",
      message: "缺少灯区类型，将默认为面光",
      suggestion: "建议添加灯区类型列",
    });
    data.type = "面光";
  }

  if (data.brightness === undefined) {
    data.brightness = 0;
  }

  if (!data.color) data.color = "";
  if (!data.focus) data.focus = "";
  if (!data.notes) data.notes = "";

  const hasErrors = errors.some((e) => e.type === "error");

  return {
    rowNumber,
    raw,
    data: data as Partial<LightFixture>,
    isValid: !hasErrors,
    errors,
  };
}

function parseCueRow(
  row: string[],
  headers: string[],
  fieldMappings: FieldMapping[],
  rowNumber: number
): ParsedCueRow {
  const raw: Record<string, string> = {};
  const data: Partial<Cue> = {};
  const errors: ImportError[] = [];

  headers.forEach((header, idx) => {
    raw[header] = row[idx] || "";
  });

  fieldMappings.forEach((mapping) => {
    if (!mapping.recognized) return;
    const value = raw[mapping.sourceField] || "";

    switch (mapping.targetField) {
      case "number":
        data.number = value.trim();
        break;
      case "sceneName":
        data.sceneName = value.trim();
        break;
      case "fixtures":
        data.fixtures = value.trim();
        break;
      case "brightnessChange":
        data.brightnessChange = value.trim();
        break;
      case "triggerNote":
        data.triggerNote = value.trim();
        break;
      case "versionNote":
        data.versionNote = value.trim();
        break;
    }
  });

  if (!data.number && !data.sceneName && !data.fixtures) {
    return {
      rowNumber,
      raw,
      data: {},
      isValid: false,
      errors: [
        {
          rowNumber,
          type: "info",
          message: "空行或无法识别的数据行",
        },
      ],
    };
  }

  if (!data.number) {
    errors.push({
      rowNumber,
      type: "warning",
      field: "number",
      message: "缺少Cue编号",
      suggestion: "建议添加Cue编号列，如 Cue 12",
    });
  }

  if (!data.sceneName) {
    errors.push({
      rowNumber,
      type: "warning",
      field: "sceneName",
      message: "缺少场景名称",
      suggestion: "建议添加场景名称列",
    });
  }

  if (!data.fixtures) {
    errors.push({
      rowNumber,
      type: "error",
      field: "fixtures",
      message: "缺少涉及灯具信息",
      suggestion: "请添加灯具列，可填写通道范围或灯具编号",
    });
  }

  if (!data.brightnessChange) data.brightnessChange = "";
  if (!data.triggerNote) data.triggerNote = "";
  if (!data.versionNote) data.versionNote = "";

  const hasErrors = errors.some((e) => e.type === "error");

  return {
    rowNumber,
    raw,
    data: data as Partial<Cue>,
    isValid: !hasErrors,
    errors,
  };
}

export function analyzeImportData(
  csvText: string,
  existingFixtures: LightFixture[] = []
): ImportPreviewResult {
  const rows = parseCSV(csvText);

  if (rows.length === 0) {
    return {
      dataType: "unknown",
      headers: [],
      fieldMappings: [],
      totalRows: 0,
      validRows: 0,
      errorRows: 0,
      emptyRows: 0,
      extraColumns: [],
      fixtureRows: [],
      cueRows: [],
      errors: [],
      conflicts: [],
      warnings: ["CSV文件为空"],
    };
  }

  const headers = rows[0].filter((h) => h && h.trim() !== "");
  const dataRows = rows.slice(1);

  const dataType = detectDataType(headers);
  const fieldMappings = mapFields(headers, dataType);

  const recognizedFields = fieldMappings.filter((m) => m.recognized);
  const unrecognizedFields = fieldMappings.filter((m) => !m.recognized);
  const extraColumns = unrecognizedFields.map((f) => f.sourceField);

  const fixtureRows: ParsedFixtureRow[] = [];
  const cueRows: ParsedCueRow[] = [];
  let emptyRows = 0;
  const allErrors: ImportError[] = [];

  dataRows.forEach((row, idx) => {
    const rowNumber = idx + 2;

    if (isEmptyRow(row)) {
      emptyRows++;
      return;
    }

    if (dataType === "fixtures" || dataType === "mixed" || dataType === "unknown") {
      const parsed = parseFixtureRow(row, headers, fieldMappings, rowNumber);
      if (parsed.data.number || parsed.data.channel || parsed.data.type) {
        fixtureRows.push(parsed);
        allErrors.push(...parsed.errors);
      }
    }

    if (dataType === "cues" || dataType === "mixed" || dataType === "unknown") {
      const parsed = parseCueRow(row, headers, fieldMappings, rowNumber);
      const hasCueData = parsed.data.number || parsed.data.sceneName || parsed.data.fixtures || parsed.data.triggerNote || parsed.data.versionNote;
      if (hasCueData && parsed.errors.some(e => e.type !== "info" || !e.message.includes("空行"))) {
        cueRows.push(parsed);
        allErrors.push(...parsed.errors);
      }
    }
  });

  const validFixtureRows = fixtureRows.filter((r) => r.isValid);
  const validCueRows = cueRows.filter((r) => r.isValid);
  const errorFixtureRows = fixtureRows.filter((r) => !r.isValid);
  const errorCueRows = cueRows.filter((r) => !r.isValid);

  const conflicts: ImportConflict[] = [];

  const numberMap = new Map<string, number[]>();
  validFixtureRows.forEach((row) => {
    if (row.data.number) {
      const num = row.data.number.toUpperCase();
      if (!numberMap.has(num)) {
        numberMap.set(num, []);
      }
      numberMap.get(num)!.push(row.rowNumber);
    }
  });

  for (const [number, rowNums] of numberMap.entries()) {
    if (rowNums.length > 1) {
      conflicts.push({
        type: "duplicate_number",
        description: `灯具编号 "${number}" 重复出现 ${rowNums.length} 次`,
        affectedRows: rowNums,
        suggestion: "请修改重复的灯具编号，确保每个编号唯一",
      });
    }
  }

  const channelMap = new Map<string, number[]>();
  validFixtureRows.forEach((row) => {
    if (row.data.channel) {
      const ch = row.data.channel.toUpperCase();
      if (!channelMap.has(ch)) {
        channelMap.set(ch, []);
      }
      channelMap.get(ch)!.push(row.rowNumber);
    }
  });

  for (const [channel, rowNums] of channelMap.entries()) {
    if (rowNums.length > 1) {
      conflicts.push({
        type: "duplicate_channel",
        description: `通道号 "${channel}" 重复出现 ${rowNums.length} 次`,
        affectedRows: rowNums,
        suggestion: "请修改重复的通道号，确保每个通道号唯一",
      });
    }
  }

  if (existingFixtures.length > 0 && validFixtureRows.length > 0) {
    const existingNumberMap = new Map<string, string>();
    const existingChannelMap = new Map<string, string>();

    existingFixtures.forEach((f) => {
      existingNumberMap.set(f.number.toUpperCase(), f.number);
      existingChannelMap.set(f.channel.toUpperCase(), f.channel);
    });

    const numberConflictRows: number[] = [];
    const numberConflictValues: string[] = [];
    const channelConflictRows: number[] = [];
    const channelConflictValues: string[] = [];

    validFixtureRows.forEach((row) => {
      if (row.data.number) {
        const num = row.data.number.toUpperCase();
        if (existingNumberMap.has(num)) {
          numberConflictRows.push(row.rowNumber);
          if (!numberConflictValues.includes(row.data.number!)) {
            numberConflictValues.push(row.data.number!);
          }
        }
      }
      if (row.data.channel) {
        const ch = row.data.channel.toUpperCase();
        if (existingChannelMap.has(ch)) {
          channelConflictRows.push(row.rowNumber);
          if (!channelConflictValues.includes(row.data.channel!)) {
            channelConflictValues.push(row.data.channel!);
          }
        }
      }
    });

    if (numberConflictRows.length > 0) {
      conflicts.push({
        type: "existing_number_conflict",
        description: `导入数据中有 ${numberConflictValues.length} 个灯具编号与工作台现有灯具重复：${numberConflictValues.join("、")}`,
        affectedRows: numberConflictRows,
        suggestion: "导入后将跳过重复编号的灯具，或修改导入数据中的编号后重新导入",
        existingItems: numberConflictValues,
      });
    }

    if (channelConflictRows.length > 0) {
      conflicts.push({
        type: "existing_channel_conflict",
        description: `导入数据中有 ${channelConflictValues.length} 个通道号与工作台现有灯具冲突：${channelConflictValues.join("、")}`,
        affectedRows: channelConflictRows,
        suggestion: "通道号冲突可能导致调光异常，建议检查并修正后再导入",
        existingItems: channelConflictValues,
      });
    }
  }

  const warnings: string[] = [];

  if (extraColumns.length > 0) {
    warnings.push(
      `检测到 ${extraColumns.length} 个未识别的列：${extraColumns.join("、")}，这些列将被忽略`
    );
  }

  if (emptyRows > 0) {
    warnings.push(`检测到 ${emptyRows} 个空行，已自动跳过`);
  }

  if (dataType === "unknown") {
    warnings.push("无法识别数据类型，请检查CSV表头是否正确");
  }

  if (dataType === "mixed") {
    warnings.push("检测到混合数据类型，建议分开导入灯具和Cue数据");
  }

  const validRows = validFixtureRows.length + validCueRows.length;
  const errorRows = errorFixtureRows.length + errorCueRows.length;

  return {
    dataType,
    headers,
    fieldMappings,
    totalRows: dataRows.length,
    validRows,
    errorRows,
    emptyRows,
    extraColumns,
    fixtureRows,
    cueRows,
    errors: allErrors,
    conflicts,
    warnings,
  };
}

export function checkCueFixtureReferences(
  cueRows: ParsedCueRow[],
  fixtures: LightFixture[]
): ImportConflict[] {
  const conflicts: ImportConflict[] = [];
  const fixtureNumbers = new Set(fixtures.map((f) => f.number.toUpperCase()));
  const fixtureChannels = new Set(fixtures.map((f) => f.channel.toUpperCase()));

  cueRows.forEach((cueRow) => {
    if (!cueRow.isValid || !cueRow.data.fixtures) return;

    const fixturesText = cueRow.data.fixtures;
    const referencedNumbers: string[] = [];
    const patterns = [/FOH-\d+/gi, /SL-\d+/gi, /SR-\d+/gi, /BL-\d+/gi, /FX-\d+/gi];

    for (const pat of patterns) {
      const matches = fixturesText.match(pat);
      if (matches) {
        referencedNumbers.push(...matches.map((m) => m.toUpperCase()));
      }
    }

    const missingNumbers = referencedNumbers.filter((n) => !fixtureNumbers.has(n));

    if (missingNumbers.length > 0) {
      conflicts.push({
        type: "missing_fixture",
        description: `Cue "${cueRow.data.number || cueRow.data.sceneName}" 引用了不存在的灯具：${missingNumbers.join("、")}`,
        affectedRows: [cueRow.rowNumber],
        suggestion: "请先导入这些灯具，或检查灯具编号是否正确",
      });
    }
  });

  return conflicts;
}

export function generateFixtureIds(fixtureRows: ParsedFixtureRow[]): LightFixture[] {
  return fixtureRows
    .filter((r) => r.isValid)
    .map((row, idx) => ({
      id: `imported-${Date.now()}-${idx}`,
      number: row.data.number || "",
      channel: row.data.channel || "",
      type: (row.data.type as LightType) || "面光",
      brightness: row.data.brightness ?? 0,
      color: row.data.color || "",
      focus: row.data.focus || "",
      notes: row.data.notes || "",
      x: row.data.x ?? 450,
      y: row.data.y ?? 300,
    }));
}

export function generateCueIds(cueRows: ParsedCueRow[]): Cue[] {
  return cueRows
    .filter((r) => r.isValid)
    .map((row, idx) => ({
      id: `cue-imported-${Date.now()}-${idx}`,
      number: row.data.number || `Cue ${idx + 1}`,
      sceneName: row.data.sceneName || "",
      fixtures: row.data.fixtures || "",
      brightnessChange: row.data.brightnessChange || "",
      triggerNote: row.data.triggerNote || "",
      versionNote: row.data.versionNote || "",
    }));
}
