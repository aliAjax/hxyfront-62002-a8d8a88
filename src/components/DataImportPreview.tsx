import { useState, useMemo } from "react";
import {
  analyzeImportData,
  checkCueFixtureReferences,
  generateFixtureIds,
  generateCueIds,
  type ImportPreviewResult,
  type ImportError,
  type ImportConflict,
  type ParsedFixtureRow,
  type ParsedCueRow,
} from "../utils/csvImport";
import type { LightFixture } from "../data/fixtures";
import type { Cue } from "../data/cues";
import { LIGHT_TYPE_COLORS } from "../data/fixtures";

interface Props {
  open: boolean;
  existingFixtures: LightFixture[];
  onClose: () => void;
  onConfirm: (data: { fixtures: LightFixture[]; cues: Cue[] }) => void;
}

type TabType = "input" | "preview" | "errors" | "conflicts";

export function DataImportPreview({ open, existingFixtures, onClose, onConfirm }: Props) {
  const [csvText, setCsvText] = useState("");
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("input");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const cueConflicts = useMemo(() => {
    if (!previewResult || previewResult.cueRows.length === 0) return [];

    const allFixtures = [
      ...existingFixtures,
      ...generateFixtureIds(previewResult.fixtureRows),
    ];

    return checkCueFixtureReferences(previewResult.cueRows, allFixtures);
  }, [previewResult, existingFixtures]);

  const allConflicts = useMemo(() => {
    if (!previewResult) return [];
    return [...previewResult.conflicts, ...cueConflicts];
  }, [previewResult, cueConflicts]);

  const canImport = useMemo(() => {
    if (!previewResult) return false;
    if (previewResult.validRows === 0) return false;
    const hasErrors = previewResult.errors.some((e) => e.type === "error");
    return !hasErrors;
  }, [previewResult]);

  const handleAnalyze = () => {
    if (!csvText.trim()) return;
    const result = analyzeImportData(csvText, existingFixtures);
    setPreviewResult(result);
    setActiveTab("preview");
  };

  const handleConfirm = () => {
    if (!previewResult) return;
    const fixtures = generateFixtureIds(previewResult.fixtureRows);
    const cues = generateCueIds(previewResult.cueRows);
    onConfirm({ fixtures, cues });
    setShowConfirmDialog(false);
    setCsvText("");
    setPreviewResult(null);
    setActiveTab("input");
  };

  const handleClose = () => {
    setCsvText("");
    setPreviewResult(null);
    setActiveTab("input");
    onClose();
  };

  const getDataTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      fixtures: "灯具数据",
      cues: "Cue数据",
      mixed: "混合数据",
      unknown: "未知类型",
    };
    return labels[type] || type;
  };

  const getErrorIcon = (type: string) => {
    if (type === "error") return "✕";
    if (type === "warning") return "⚠";
    return "ℹ";
  };

  const getErrorColor = (type: string) => {
    if (type === "error") return "#ef4444";
    if (type === "warning") return "#f59e0b";
    return "#06b6d4";
  };

  const getConflictIcon = (type: string) => {
    if (type === "duplicate_number") return "🔢";
    if (type === "duplicate_channel") return "📡";
    if (type === "missing_fixture") return "❓";
    return "⚠";
  };

  if (!open) return null;

  return (
    <div className="import-overlay" onClick={handleClose}>
      <div className="import-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="import-header">
          <div>
            <p className="import-label">数据导入</p>
            <h2>演出数据导入预览</h2>
          </div>
          <button className="import-close-btn" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="import-tabs">
          <button
            className={`import-tab ${activeTab === "input" ? "active" : ""}`}
            onClick={() => setActiveTab("input")}
          >
            粘贴数据
          </button>
          <button
            className={`import-tab ${activeTab === "preview" ? "active" : ""}`}
            onClick={() => previewResult && setActiveTab("preview")}
            disabled={!previewResult}
          >
            字段识别
            {previewResult && (
              <span className="import-tab-badge">{previewResult.validRows}</span>
            )}
          </button>
          <button
            className={`import-tab ${activeTab === "errors" ? "active" : ""}`}
            onClick={() => previewResult && setActiveTab("errors")}
            disabled={!previewResult || previewResult.errors.length === 0}
          >
            错误行
            {previewResult && previewResult.errors.some((e) => e.type === "error") && (
              <span className="import-tab-badge error">
                {previewResult.errors.filter((e) => e.type === "error").length}
              </span>
            )}
          </button>
          <button
            className={`import-tab ${activeTab === "conflicts" ? "active" : ""}`}
            onClick={() => previewResult && setActiveTab("conflicts")}
            disabled={!previewResult || allConflicts.length === 0}
          >
            冲突提示
            {allConflicts.length > 0 && (
              <span className="import-tab-badge warning">{allConflicts.length}</span>
            )}
          </button>
        </div>

        <div className="import-body">
          {activeTab === "input" && (
            <div className="import-input-section">
              <div className="import-input-hint">
                <h3>粘贴CSV数据</h3>
                <p>
                  支持粘贴灯具数据或Cue数据的CSV内容。第一行为表头，支持中英文列名。
                </p>
                <div className="import-format-hints">
                  <div className="import-format-hint">
                    <strong>灯具数据支持列：</strong>
                    <span>灯具编号、通道号、灯区类型、亮度、色片、焦点位置、备注</span>
                  </div>
                  <div className="import-format-hint">
                    <strong>Cue数据支持列：</strong>
                    <span>Cue编号、场景名称、灯具、亮度变化、触发时机、版本备注</span>
                  </div>
                </div>
              </div>

              <textarea
                className="import-textarea"
                placeholder={`灯具编号,通道号,灯区类型,亮度,色片,焦点位置,备注
FOH-01,CH001,面光,80,R02 曙红,舞台中心偏左,主面光
FOH-02,CH002,面光,75,R02 曙红,舞台中心偏右,主面光
SL-01,CH011,侧光,65,HT201 冷蓝,二幕左区,冷蓝侧光`}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={12}
              />

              <div className="import-input-actions">
                <button className="import-btn import-btn-secondary" onClick={handleClose}>
                  取消
                </button>
                <button
                  className="import-btn import-btn-primary"
                  onClick={handleAnalyze}
                  disabled={!csvText.trim()}
                >
                  分析数据
                </button>
              </div>
            </div>
          )}

          {activeTab === "preview" && previewResult && (
            <div className="import-preview-section">
              <div className="import-summary-cards">
                <div className="import-summary-card">
                  <span className="import-summary-label">数据类型</span>
                  <strong className="import-summary-value">
                    {getDataTypeLabel(previewResult.dataType)}
                  </strong>
                </div>
                <div className="import-summary-card success">
                  <span className="import-summary-label">有效行</span>
                  <strong className="import-summary-value">{previewResult.validRows}</strong>
                </div>
                <div className="import-summary-card error">
                  <span className="import-summary-label">错误行</span>
                  <strong className="import-summary-value">{previewResult.errorRows}</strong>
                </div>
                <div className="import-summary-card info">
                  <span className="import-summary-label">空行</span>
                  <strong className="import-summary-value">{previewResult.emptyRows}</strong>
                </div>
              </div>

              {previewResult.warnings.length > 0 && (
                <div className="import-warnings">
                  {previewResult.warnings.map((warning, idx) => (
                    <div key={idx} className="import-warning-item">
                      <span className="import-warning-icon">⚠</span>
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="import-field-mapping">
                <h3>字段识别结果</h3>
                <div className="import-field-grid">
                  {previewResult.fieldMappings.map((mapping, idx) => (
                    <div
                      key={idx}
                      className={`import-field-item ${
                        mapping.recognized ? "recognized" : "unrecognized"
                      }`}
                    >
                      <span className="import-field-source">{mapping.sourceField}</span>
                      <span className="import-field-arrow">→</span>
                      <span className="import-field-target">
                        {mapping.recognized ? mapping.targetField : "未识别"}
                      </span>
                      {mapping.recognized && (
                        <span className="import-field-status ok">✓</span>
                      )}
                      {!mapping.recognized && (
                        <span className="import-field-status skip">⊘</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {previewResult.fixtureRows.length > 0 && (
                <div className="import-data-preview">
                  <h3>
                    灯具数据预览 ({previewResult.fixtureRows.filter((r) => r.isValid).length} 条有效)
                  </h3>
                  <div className="import-table-wrapper">
                    <table className="import-table">
                      <thead>
                        <tr>
                          <th>行号</th>
                          <th>灯具编号</th>
                          <th>通道号</th>
                          <th>灯区类型</th>
                          <th>亮度</th>
                          <th>色片</th>
                          <th>焦点</th>
                          <th>状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewResult.fixtureRows.slice(0, 10).map((row) => (
                          <FixtureRow key={row.rowNumber} row={row} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewResult.fixtureRows.length > 10 && (
                    <p className="import-preview-more">
                      还有 {previewResult.fixtureRows.length - 10} 条数据未显示...
                    </p>
                  )}
                </div>
              )}

              {previewResult.cueRows.length > 0 && (
                <div className="import-data-preview">
                  <h3>
                    Cue数据预览 ({previewResult.cueRows.filter((r) => r.isValid).length} 条有效)
                  </h3>
                  <div className="import-table-wrapper">
                    <table className="import-table">
                      <thead>
                        <tr>
                          <th>行号</th>
                          <th>Cue编号</th>
                          <th>场景名称</th>
                          <th>灯具</th>
                          <th>亮度变化</th>
                          <th>状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewResult.cueRows.slice(0, 10).map((row) => (
                          <CueRow key={row.rowNumber} row={row} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewResult.cueRows.length > 10 && (
                    <p className="import-preview-more">
                      还有 {previewResult.cueRows.length - 10} 条数据未显示...
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "errors" && previewResult && (
            <div className="import-errors-section">
              <h3>错误详情</h3>
              <p className="import-errors-subtitle">
                共 {previewResult.errors.length} 条问题，其中错误{" "}
                {previewResult.errors.filter((e) => e.type === "error").length} 条，警告{" "}
                {previewResult.errors.filter((e) => e.type === "warning").length} 条
              </p>
              <div className="import-errors-list">
                {previewResult.errors.map((error, idx) => (
                  <ErrorItem key={idx} error={error} />
                ))}
              </div>
            </div>
          )}

          {activeTab === "conflicts" && (
            <div className="import-conflicts-section">
              <h3>冲突提示</h3>
              <p className="import-conflicts-subtitle">
                共 {allConflicts.length} 个冲突需要注意
              </p>
              <div className="import-conflicts-list">
                {allConflicts.map((conflict, idx) => (
                  <ConflictItem key={idx} conflict={conflict} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="import-footer">
          <button className="import-btn import-btn-secondary" onClick={handleClose}>
            取消
          </button>
          <button
            className="import-btn import-btn-primary"
            onClick={() => setShowConfirmDialog(true)}
            disabled={!canImport}
          >
            确认导入
          </button>
        </div>

        {showConfirmDialog && (
          <div className="import-confirm-overlay" onClick={() => setShowConfirmDialog(false)}>
            <div
              className="import-confirm-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <h3>确认导入数据？</h3>
              <p>
                即将导入以下数据到当前工作台：
              </p>
              <ul className="import-confirm-list">
                {previewResult?.fixtureRows.filter((r) => r.isValid).length! > 0 && (
                  <li>
                    {previewResult?.fixtureRows.filter((r) => r.isValid).length} 台灯具
                  </li>
                )}
                {previewResult?.cueRows.filter((r) => r.isValid).length! > 0 && (
                  <li>
                    {previewResult?.cueRows.filter((r) => r.isValid).length} 个Cue
                  </li>
                )}
              </ul>
              {allConflicts.length > 0 && (
                <p className="import-confirm-warning">
                  ⚠ 仍有 {allConflicts.length} 个冲突提示未解决，导入后可能需要手动调整。
                </p>
              )}
              <p className="import-confirm-note">
                导入的数据将追加到现有数据中，不会覆盖已有内容。
              </p>
              <div className="import-confirm-actions">
                <button
                  className="import-btn import-btn-secondary"
                  onClick={() => setShowConfirmDialog(false)}
                >
                  再看看
                </button>
                <button className="import-btn import-btn-primary" onClick={handleConfirm}>
                  确认导入
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FixtureRow({ row }: { row: ParsedFixtureRow }) {
  const typeColor = row.data.type
    ? LIGHT_TYPE_COLORS[row.data.type as keyof typeof LIGHT_TYPE_COLORS] || "#94a3b8"
    : "#94a3b8";

  return (
    <tr className={row.isValid ? "" : "import-row-error"}>
      <td className="import-row-number">{row.rowNumber}</td>
      <td className="import-fixture-number">{row.data.number || "-"}</td>
      <td className="import-fixture-channel">{row.data.channel || "-"}</td>
      <td>
        {row.data.type && (
          <span
            className="import-type-badge"
            style={{ background: typeColor }}
          >
            {row.data.type}
          </span>
        )}
      </td>
      <td className="import-brightness">
        {row.data.brightness !== undefined ? `${row.data.brightness}%` : "-"}
      </td>
      <td className="import-color">{row.data.color || "-"}</td>
      <td className="import-focus">{row.data.focus || "-"}</td>
      <td>
        {row.isValid ? (
          <span className="import-status-badge ok">有效</span>
        ) : (
          <span className="import-status-badge error">错误</span>
        )}
      </td>
    </tr>
  );
}

function CueRow({ row }: { row: ParsedCueRow }) {
  return (
    <tr className={row.isValid ? "" : "import-row-error"}>
      <td className="import-row-number">{row.rowNumber}</td>
      <td className="import-cue-number">{row.data.number || "-"}</td>
      <td className="import-cue-scene">{row.data.sceneName || "-"}</td>
      <td className="import-cue-fixtures">{row.data.fixtures || "-"}</td>
      <td className="import-brightness">{row.data.brightnessChange || "-"}</td>
      <td>
        {row.isValid ? (
          <span className="import-status-badge ok">有效</span>
        ) : (
          <span className="import-status-badge error">错误</span>
        )}
      </td>
    </tr>
  );
}

function ErrorItem({ error }: { error: ImportError }) {
  const color = getErrorColor(error.type);
  const icon = getErrorIcon(error.type);

  return (
    <div className={`import-error-item import-error-${error.type}`}>
      <div className="import-error-icon" style={{ color, borderColor: color }}>
        {icon}
      </div>
      <div className="import-error-content">
        <div className="import-error-header">
          <span className="import-error-row">第 {error.rowNumber} 行</span>
          {error.field && (
            <span className="import-error-field">字段：{error.field}</span>
          )}
          {error.value !== undefined && (
            <span className="import-error-value">值："{error.value}"</span>
          )}
        </div>
        <p className="import-error-message">{error.message}</p>
        {error.suggestion && (
          <p className="import-error-suggestion">💡 {error.suggestion}</p>
        )}
      </div>
    </div>
  );
}

function ConflictItem({ conflict }: { conflict: ImportConflict }) {
  const icon = getConflictIcon(conflict.type);

  return (
    <div className="import-conflict-item">
      <div className="import-conflict-icon">{icon}</div>
      <div className="import-conflict-content">
        <h4>{conflict.description}</h4>
        <p className="import-conflict-rows">
          涉及行：{conflict.affectedRows.map((r) => `第${r}行`).join("、")}
        </p>
        <p className="import-conflict-suggestion">💡 {conflict.suggestion}</p>
      </div>
    </div>
  );
}
