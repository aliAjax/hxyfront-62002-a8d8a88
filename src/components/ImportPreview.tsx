import { useState, useMemo, useEffect } from "react";
import { LIGHT_TYPE_COLORS, type LightFixture, type LightType } from "../data/fixtures";
import { type Cue } from "../data/cues";
import {
  type ImportDataType,
  type ImportResult,
  type FixtureImportResult,
  type CueImportResult,
  type ImportError,
  type FixtureRow,
  type CueRow,
  parseAndValidateFixtures,
  parseAndValidateCues,
  buildFixturesFromImport,
  buildCuesFromImport,
  mergeFixturesWithExisting,
  mergeCuesWithExisting,
  FIXTURE_FIELD_ALIASES,
  CUE_FIELD_ALIASES,
} from "../data/importUtils";

interface Props {
  open: boolean;
  existingFixtures: LightFixture[];
  existingCues: Cue[];
  onClose: () => void;
  onImportFixtures: (mergedFixtures: LightFixture[], importedFixtures: LightFixture[]) => void;
  onImportCues: (mergedCues: Cue[], importedCues: Cue[]) => void;
}

const FIXTURE_FIELD_LABELS: Record<string, string> = {
  number: "灯具编号",
  channel: "通道号",
  type: "灯区类型",
  color: "色片",
  focus: "焦点位置",
  notes: "备注",
  brightness: "亮度预设",
  x: "X坐标",
  y: "Y坐标",
};

const CUE_FIELD_LABELS: Record<string, string> = {
  number: "Cue编号",
  sceneName: "场景名称",
  fixtures: "灯具范围",
  brightnessChange: "亮度变化",
  triggerNote: "触发备注",
  versionNote: "版本备注",
};

const FIXTURE_SAMPLE = `灯具编号,通道号,灯区类型,色片,焦点位置,备注,亮度预设
FOH-06,CH006,面光,R02 曙红,舞台中心偏左,新增面光灯,80
SL-04,CH014,侧光,HT201 冷蓝,二幕左区,新增侧光灯,65
FX-05,CH045,效果光,R326 紫色,舞台中心,新增效果灯,40`;

const CUE_SAMPLE = `Cue编号,场景名称,灯具范围,亮度变化,触发备注,版本备注
Cue 01,开场白场,全台面光,亮度70%,大幕拉开,版本A
Cue 06,主角入场,FOH-03,亮度100%,演员从上场门出,版本A
Cue 15,高潮效果,FX-01,FX-02,FX-03,亮度50%,音乐第32小节,版本B`;

type ViewTab = "fields" | "errors" | "preview";

export function ImportPreview({
  open,
  existingFixtures,
  existingCues,
  onClose,
  onImportFixtures,
  onImportCues,
}: Props) {
  const [dataType, setDataType] = useState<ImportDataType>("fixtures");
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>("fields");
  const [errorFilter, setErrorFilter] = useState<"all" | "error" | "warning">("all");

  useEffect(() => {
    if (!open) {
      setCsvText("");
      setResult(null);
      setActiveTab("fields");
      setErrorFilter("all");
    }
  }, [open]);

  const fieldLabels = dataType === "fixtures" ? FIXTURE_FIELD_LABELS : CUE_FIELD_LABELS;
  const requiredFields = dataType === "fixtures" ? ["number", "channel"] : ["number"];

  const parsedResult = useMemo(() => {
    if (!csvText.trim()) return null;
    if (dataType === "fixtures") {
      return parseAndValidateFixtures(csvText, existingFixtures);
    } else {
      return parseAndValidateCues(csvText, existingFixtures, existingCues);
    }
  }, [csvText, dataType, existingFixtures, existingCues]);

  useEffect(() => {
    setResult(parsedResult);
  }, [parsedResult]);

  const errorCount = result?.errors.filter((e) => e.type === "error").length ?? 0;
  const warningCount = result?.errors.filter((e) => e.type === "warning").length ?? 0;
  const hasBlockingErrors = errorCount > 0;

  const filteredErrors = useMemo(() => {
    if (!result) return [] as ImportError[];
    if (errorFilter === "all") return result.errors;
    return result.errors.filter((e) => e.type === errorFilter);
  }, [result, errorFilter]);

  const handleConfirm = () => {
    if (!result || hasBlockingErrors) return;

    if (result.type === "fixtures") {
      const imported = buildFixturesFromImport(result.validRows, existingFixtures);
      const merged = mergeFixturesWithExisting(existingFixtures, imported);
      onImportFixtures(merged, imported);
    } else {
      const imported = buildCuesFromImport(result.validRows, existingCues);
      const merged = mergeCuesWithExisting(existingCues, imported);
      onImportCues(merged, imported);
    }
    onClose();
  };

  const loadSample = () => {
    setCsvText(dataType === "fixtures" ? FIXTURE_SAMPLE : CUE_SAMPLE);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted.includes("\t") && !pasted.includes(",")) {
      e.preventDefault();
      const converted = pasted
        .split("\n")
        .map((line) =>
          line
            .split("\t")
            .map((cell) => {
              if (cell.includes(",") || cell.includes('"')) {
                return `"${cell.replace(/"/g, '""')}"`;
              }
              return cell;
            })
            .join(",")
        )
        .join("\n");
      setCsvText(converted);
    }
  };

  if (!open) return null;

  return (
    <div className="import-overlay" onClick={onClose}>
      <div className="import-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="import-header">
          <div>
            <p className="import-label">演出数据导入</p>
            <h2>粘贴 CSV 数据 · 预览后写入</h2>
          </div>
          <button className="import-close-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <line x1="6" y1="6" x2="18" y2="18" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
              <line x1="18" y1="6" x2="6" y2="18" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="import-body">
          <div className="import-input-section">
            <div className="import-type-selector">
              <label>导入数据类型</label>
              <div className="import-type-chips">
                <button
                  className={dataType === "fixtures" ? "import-chip active" : "import-chip"}
                  onClick={() => { setDataType("fixtures"); setCsvText(""); }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="4" fill={LIGHT_TYPE_COLORS["面光"]} />
                    <circle cx="12" cy="12" r="8" fill="none" stroke={LIGHT_TYPE_COLORS["面光"]} strokeWidth="2" opacity="0.4" />
                  </svg>
                  灯具清单
                </button>
                <button
                  className={dataType === "cues" ? "import-chip active" : "import-chip"}
                  onClick={() => { setDataType("cues"); setCsvText(""); }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M3 12h4l3-9 4 18 3-9h4" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  Cue 表
                </button>
              </div>
            </div>

            <div className="import-paste-area">
              <div className="import-paste-header">
                <label>
                  粘贴 CSV 内容
                  <span className="import-paste-hint">
                    （支持直接从 Excel/WPS 复制粘贴，制表符将自动转换为逗号）
                  </span>
                </label>
                <button className="import-sample-btn" onClick={loadSample}>
                  载入示例
                </button>
              </div>
              <textarea
                className="import-textarea"
                placeholder={
                  dataType === "fixtures"
                    ? "示例表头：灯具编号,通道号,灯区类型,色片,焦点位置,备注,亮度预设\n粘贴内容到此...\n\n第一行必须是表头（列名），系统会自动识别字段。"
                    : "示例表头：Cue编号,场景名称,灯具范围,亮度变化,触发备注,版本备注\n粘贴内容到此...\n\n第一行必须是表头（列名），系统会自动识别字段。"
                }
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                onPaste={handlePaste}
                rows={6}
                spellCheck={false}
              />
            </div>

            {result && result.fieldMap.extraColumns.length > 0 && (
              <div className="import-info-note">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#06b6d4" strokeWidth="2" />
                  <line x1="12" y1="8" x2="12" y2="12" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="16" r="1" fill="#06b6d4" />
                </svg>
                <span>
                  发现 {result.fieldMap.extraColumns.length} 个未识别的列将被忽略：
                  <strong>{result.fieldMap.extraColumns.map((i) => result.fieldMap.detectedHeaders[i] || `第${i + 1}列`).join("、")}</strong>
                </span>
              </div>
            )}
          </div>

          {result && (
            <div className="import-preview-section">
              <div className="import-stats-bar">
                <div className="import-stat">
                  <span className="import-stat-label">总行数</span>
                  <strong className="import-stat-value">{result.rows.length + result.emptyRows.length}</strong>
                </div>
                <div className="import-stat import-stat-success">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="import-stat-label">有效行</span>
                  <strong className="import-stat-value">{result.validRows.length}</strong>
                </div>
                {result.errorRows.length > 0 && (
                  <div className="import-stat import-stat-error">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2" />
                      <line x1="15" y1="9" x2="9" y2="15" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                      <line x1="9" y1="9" x2="15" y2="15" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span className="import-stat-label">错误行</span>
                    <strong className="import-stat-value">{result.errorRows.length}</strong>
                  </div>
                )}
                {result.emptyRows.length > 0 && (
                  <div className="import-stat import-stat-info">
                    <span className="import-stat-label">空行跳过</span>
                    <strong className="import-stat-value">{result.emptyRows.length}</strong>
                  </div>
                )}
                {errorCount > 0 && (
                  <div className="import-stat import-stat-error">
                    <span className="import-stat-label">错误</span>
                    <strong className="import-stat-value">{errorCount}</strong>
                  </div>
                )}
                {warningCount > 0 && (
                  <div className="import-stat import-stat-warning">
                    <span className="import-stat-label">警告</span>
                    <strong className="import-stat-value">{warningCount}</strong>
                  </div>
                )}
              </div>

              <div className="import-tabs">
                <button
                  className={activeTab === "fields" ? "import-tab active" : "import-tab"}
                  onClick={() => setActiveTab("fields")}
                >
                  字段识别
                  {result.fieldMap.extraColumns.length > 0 && (
                    <span className="import-tab-badge info">{result.fieldMap.extraColumns.length}</span>
                  )}
                </button>
                <button
                  className={activeTab === "errors" ? "import-tab active" : "import-tab"}
                  onClick={() => setActiveTab("errors")}
                >
                  问题列表
                  {errorCount > 0 && (
                    <span className="import-tab-badge error">{errorCount}</span>
                  )}
                  {errorCount === 0 && warningCount > 0 && (
                    <span className="import-tab-badge warning">{warningCount}</span>
                  )}
                </button>
                <button
                  className={activeTab === "preview" ? "import-tab active" : "import-tab"}
                  onClick={() => setActiveTab("preview")}
                >
                  数据预览
                  <span className="import-tab-badge">{result.validRows.length}</span>
                </button>
              </div>

              <div className="import-tab-content">
                {activeTab === "fields" && (
                  <FieldsPanel
                    result={result}
                    fieldLabels={fieldLabels}
                    requiredFields={requiredFields}
                  />
                )}
                {activeTab === "errors" && (
                  <ErrorsPanel
                    errors={filteredErrors}
                    totalErrors={errorCount}
                    totalWarnings={warningCount}
                    filter={errorFilter}
                    onFilterChange={setErrorFilter}
                    result={result}
                  />
                )}
                {activeTab === "preview" && (
                  <PreviewPanel result={result} fieldLabels={fieldLabels} />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="import-footer">
          <div className="import-footer-left">
            {result && (
              <span className={hasBlockingErrors ? "import-blocking-hint" : "import-ready-hint"}>
                {hasBlockingErrors
                  ? `有 ${errorCount} 个错误必须修复后才能导入`
                  : result.validRows.length > 0
                  ? `确认后将写入 ${result.validRows.length} 条${dataType === "fixtures" ? "灯具" : "Cue"}数据${
                      warningCount > 0 ? `（含 ${warningCount} 条警告）` : ""
                    }`
                  : "暂无有效数据可导入"}
              </span>
            )}
          </div>
          <div className="import-footer-actions">
            <button className="batch-btn batch-btn-ghost" onClick={onClose}>
              取消
            </button>
            <button
              className="batch-btn batch-btn-primary"
              onClick={handleConfirm}
              disabled={!result || result.validRows.length === 0 || hasBlockingErrors}
            >
              确认导入
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldsPanel({
  result,
  fieldLabels,
  requiredFields,
}: {
  result: ImportResult;
  fieldLabels: Record<string, string>;
  requiredFields: string[];
}) {
  const mappedFields = Object.entries(result.fieldMap.mappedFields);
  const unmappedRequired = requiredFields.filter(
    (f) => !mappedFields.some(([, name]) => name === f)
  );

  return (
    <div className="import-fields-panel">
      {unmappedRequired.length > 0 && (
        <div className="import-fields-warning">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L1 21h22L12 2z" stroke="#f59e0b" strokeWidth="2" fill="none" />
            <line x1="12" y1="9" x2="12" y2="14" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="17" r="1" fill="#f59e0b" />
          </svg>
          <span>
            缺少必填字段：<strong>{unmappedRequired.map((f) => fieldLabels[f] || f).join("、")}</strong>
            ，请在 CSV 表头中补充对应的列名。
          </span>
        </div>
      )}

      <table className="import-fields-table">
        <thead>
          <tr>
            <th style={{ width: 60 }}>列序号</th>
            <th>原始表头</th>
            <th style={{ width: 100 }}>状态</th>
            <th>映射到字段</th>
          </tr>
        </thead>
        <tbody>
          {result.fieldMap.detectedHeaders.map((header, idx) => {
            const mappedName = result.fieldMap.mappedFields[idx];
            const isExtra = result.fieldMap.extraColumns.includes(idx);
            const isRequired = mappedName && requiredFields.includes(mappedName);
            return (
              <tr key={idx} className={isExtra ? "import-field-extra" : ""}>
                <td className="import-col-index">第 {idx + 1} 列</td>
                <td className="import-col-header">
                  <code>{header || "(空)"}</code>
                </td>
                <td>
                  {mappedName ? (
                    <span className="import-field-status mapped">
                      ✓ 已识别
                    </span>
                  ) : isExtra ? (
                    <span className="import-field-status extra">忽略</span>
                  ) : (
                    <span className="import-field-status empty">空</span>
                  )}
                </td>
                <td>
                  {mappedName ? (
                    <span className="import-field-name">
                      {fieldLabels[mappedName] || mappedName}
                      {isRequired && <span className="import-required-mark">*</span>}
                    </span>
                  ) : (
                    <span className="import-field-unmapped">
                      {isExtra ? "未匹配到已知字段，将被忽略" : "-"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="import-aliases-hint">
        <p className="import-aliases-title">💡 表头识别规则（支持中英文别名）：</p>
        <div className="import-aliases-grid">
          {Object.entries(fieldLabels).map(([key, label]) => {
            const aliases = result.type === "fixtures"
              ? FIXTURE_FIELD_ALIASES[key]
              : CUE_FIELD_ALIASES[key];
            const aliasArr = Array.isArray(aliases) ? aliases : [aliases];
            return (
              <div key={key} className="import-alias-item">
                <strong>{label}</strong>
                {requiredFields.includes(key) && <span className="import-required-mark">*</span>}
                <small>{aliasArr.join(" / ")}</small>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ErrorsPanel({
  errors,
  totalErrors,
  totalWarnings,
  filter,
  onFilterChange,
  result,
}: {
  errors: ImportError[];
  totalErrors: number;
  totalWarnings: number;
  filter: "all" | "error" | "warning";
  onFilterChange: (f: "all" | "error" | "warning") => void;
  result: ImportResult;
}) {
  if (errors.length === 0 && totalErrors === 0 && totalWarnings === 0) {
    return (
      <div className="import-no-errors">
        <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="28" fill="#d1fae5" />
          <path d="M44 26L30 40l-10-10" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h4>🎉 没有发现问题</h4>
        <p>所有数据格式正确，可以直接导入。</p>
      </div>
    );
  }

  return (
    <div className="import-errors-panel">
      <div className="import-errors-filter">
        <button
          className={filter === "all" ? "import-filter-btn active" : "import-filter-btn"}
          onClick={() => onFilterChange("all")}
        >
          全部 ({totalErrors + totalWarnings})
        </button>
        <button
          className={filter === "error" ? "import-filter-btn active error" : "import-filter-btn error"}
          onClick={() => onFilterChange("error")}
        >
          <span className="import-dot error" />
          错误 ({totalErrors})
        </button>
        <button
          className={filter === "warning" ? "import-filter-btn active warning" : "import-filter-btn warning"}
          onClick={() => onFilterChange("warning")}
        >
          <span className="import-dot warning" />
          警告 ({totalWarnings})
        </button>
      </div>

      {result.type === "fixtures" && (
        <ConflictSummary result={result as FixtureImportResult} />
      )}
      {result.type === "cues" && (
        <CueConflictSummary result={result as CueImportResult} />
      )}

      {errors.length > 0 ? (
        <div className="import-error-list">
          {errors.map((err, idx) => (
            <div key={idx} className={`import-error-item import-error-${err.type}`}>
              <div className="import-error-icon">
                {err.type === "error" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2" />
                    <line x1="15" y1="9" x2="9" y2="15" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                    <line x1="9" y1="9" x2="15" y2="15" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L1 21h22L12 2z" stroke="#f59e0b" strokeWidth="2" fill="none" />
                    <line x1="12" y1="9" x2="12" y2="14" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="17" r="1" fill="#f59e0b" />
                  </svg>
                )}
              </div>
              <div className="import-error-body">
                <div className="import-error-header">
                  <span className={`import-error-tag ${err.type}`}>
                    {err.type === "error" ? "错误" : "警告"}
                  </span>
                  <span className="import-error-row">第 {err.rowNumber} 行</span>
                  {err.field && (
                    <span className="import-error-field">字段：{
                      result.type === "fixtures"
                        ? FIXTURE_FIELD_LABELS[err.field] || err.field
                        : CUE_FIELD_LABELS[err.field] || err.field
                    }</span>
                  )}
                </div>
                <p className="import-error-message">{err.message}</p>
                {err.suggestion && (
                  <p className="import-error-suggestion">
                    <span>💡 建议：</span>{err.suggestion}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="import-no-errors small">
          <p>当前筛选下没有问题，切换其他筛选查看。</p>
        </div>
      )}
    </div>
  );
}

function ConflictSummary({ result }: { result: FixtureImportResult }) {
  const { conflicts } = result;
  const items: { label: string; count: number; detail: string }[] = [];

  if (conflicts.duplicateNumbers.length > 0) {
    items.push({
      label: "灯具编号重复（导入数据内）",
      count: conflicts.duplicateNumbers.length,
      detail: conflicts.duplicateNumbers.map((d) => `「${d.number}」行${d.rows.join("/")}`).join("；"),
    });
  }
  if (conflicts.duplicateChannels.length > 0) {
    items.push({
      label: "通道号重复（导入数据内）",
      count: conflicts.duplicateChannels.length,
      detail: conflicts.duplicateChannels.map((d) => `「${d.channel}」行${d.rows.join("/")}`).join("；"),
    });
  }
  if (conflicts.numberConflictsWithExisting.length > 0) {
    items.push({
      label: "灯具编号与现有冲突",
      count: conflicts.numberConflictsWithExisting.length,
      detail: conflicts.numberConflictsWithExisting.map((d) => `「${d.number}」`).join("、"),
    });
  }
  if (conflicts.channelConflictsWithExisting.length > 0) {
    items.push({
      label: "通道号与现有冲突",
      count: conflicts.channelConflictsWithExisting.length,
      detail: conflicts.channelConflictsWithExisting.map((d) => `「${d.channel}」`).join("、"),
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="import-conflict-summary">
      <h5>冲突汇总</h5>
      {items.map((item, i) => (
        <div key={i} className="import-conflict-item">
          <span className="import-conflict-count">{item.count}</span>
          <div>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function CueConflictSummary({ result }: { result: CueImportResult }) {
  const { conflicts } = result;
  const items: { label: string; count: number; detail: string }[] = [];

  if (conflicts.duplicateCueNumbers.length > 0) {
    items.push({
      label: "Cue编号重复（导入数据内）",
      count: conflicts.duplicateCueNumbers.length,
      detail: conflicts.duplicateCueNumbers.map((d) => `「${d.number}」行${d.rows.join("/")}`).join("；"),
    });
  }
  if (conflicts.missingFixtures.length > 0) {
    items.push({
      label: "Cue引用的灯具不存在",
      count: conflicts.missingFixtures.length,
      detail: conflicts.missingFixtures.map((d) => `「${d.fixtureRef}」行${d.rows.join("/")}`).join("；"),
    });
  }
  if (conflicts.cueNumberConflictsWithExisting.length > 0) {
    items.push({
      label: "Cue编号与现有冲突",
      count: conflicts.cueNumberConflictsWithExisting.length,
      detail: conflicts.cueNumberConflictsWithExisting.map((d) => `「${d.number}」`).join("、"),
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="import-conflict-summary">
      <h5>冲突汇总</h5>
      {items.map((item, i) => (
        <div key={i} className="import-conflict-item">
          <span className="import-conflict-count">{item.count}</span>
          <div>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function PreviewPanel({
  result,
  fieldLabels,
}: {
  result: ImportResult;
  fieldLabels: Record<string, string>;
}) {
  const mappedColumns = Object.entries(result.fieldMap.mappedFields);
  const validRows = result.validRows;

  if (validRows.length === 0) {
    return (
      <div className="import-no-errors small">
        <p>暂无有效数据可供预览。</p>
      </div>
    );
  }

  return (
    <div className="import-preview-panel">
      <div className="import-preview-info">
        预览以下 <strong>{validRows.length}</strong> 条有效数据：
      </div>
      <div className="import-preview-table-wrap">
        <table className="import-preview-table">
          <thead>
            <tr>
              <th style={{ width: 50, position: "sticky", left: 0, zIndex: 2, background: "#f8fafc" }}>
                原行号
              </th>
              {mappedColumns.map(([, fieldName]) => (
                <th key={fieldName}>
                  {fieldLabels[fieldName] || fieldName}
                </th>
              ))}
              <th style={{ width: 60 }}>状态</th>
            </tr>
          </thead>
          <tbody>
            {validRows.map((row) => (
              <PreviewRow
                key={row.rowIndex}
                row={row}
                mappedColumns={mappedColumns}
                resultType={result.type}
              />
            ))}
          </tbody>
        </table>
      </div>

      {result.type === "fixtures" && validRows.length > 0 && (
        <FixtureTypeDistribution rows={validRows as FixtureRow[]} />
      )}
    </div>
  );
}

function PreviewRow({
  row,
  mappedColumns,
  resultType,
}: {
  row: FixtureRow | CueRow;
  mappedColumns: [string, string][];
  resultType: "fixtures" | "cues";
}) {
  const parsed = row.parsed;
  const rowErrors = (row as FixtureRow).rawRow ? null : null;

  return (
    <tr className={!row.valid ? "import-preview-row-error" : ""}>
      <td style={{ position: "sticky", left: 0, zIndex: 1, background: "#fff" }} className="import-preview-row-num">
        {row.rowNumber}
      </td>
      {mappedColumns.map(([, fieldName]) => {
        const val = parsed[fieldName as keyof typeof parsed];
        let display = val !== undefined && val !== null ? String(val) : "-";
        let extra = null;

        if (resultType === "fixtures" && fieldName === "type") {
          const t = val as LightType;
          if (t && LIGHT_TYPE_COLORS[t]) {
            extra = (
              <span
                className="import-type-dot"
                style={{ background: LIGHT_TYPE_COLORS[t] }}
              />
            );
          }
        }
        if (resultType === "fixtures" && fieldName === "brightness") {
          const b = Number(val);
          const color = b === 0 ? "#94a3b8" : b > 70 ? "#ef4444" : b > 30 ? "#f59e0b" : "#06b6d4";
          display = `${b}%`;
          extra = (
            <span className="import-brightness-bar">
              <span
                className="import-brightness-fill"
                style={{ width: `${b}%`, background: color }}
              />
            </span>
          );
        }

        return (
          <td key={fieldName}>
            <div className="import-cell-content">
              {extra}
              <span className={display === "-" ? "import-cell-empty" : ""}>{display}</span>
            </div>
          </td>
        );
      })}
      <td>
        <span className="import-preview-status valid">
          ✓
        </span>
      </td>
    </tr>
  );
}

function FixtureTypeDistribution({ rows }: { rows: FixtureRow[] }) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const t = row.parsed.type || "未分类";
    counts[t] = (counts[t] || 0) + 1;
  }
  const total = rows.length;

  return (
    <div className="import-type-distribution">
      <p className="import-distribution-label">灯区类型分布：</p>
      <div className="import-distribution-bars">
        {Object.entries(counts).map(([type, count]) => {
          const color = LIGHT_TYPE_COLORS[type as LightType] || "#94a3b8";
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={type} className="import-distribution-item">
              <div className="import-distribution-header">
                <span className="import-type-dot" style={{ background: color }} />
                <span className="import-distribution-type">{type}</span>
                <span className="import-distribution-count">{count} 台 ({pct}%)</span>
              </div>
              <div className="import-distribution-bar">
                <span style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
