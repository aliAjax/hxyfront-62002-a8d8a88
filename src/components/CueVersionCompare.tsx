import { useState, useMemo, useCallback } from "react";
import {
  type VersionSnapshot,
  type CueVersionDiff,
  type CompareResult,
  type DiffType,
  compareVersions,
  normalizeVersionSnapshot,
  parseCueFixtures,
  createVersionSnapshot,
  type Cue,
  type LightFixture,
} from "../data/cues";
import { LIGHT_TYPE_COLORS } from "../data/fixtures";
import { loadSnapshots, saveSnapshots } from "../data/versionSnapshots";

type DiffFilter = "all" | "added" | "removed" | "modified" | "orderChanged";

interface Props {
  currentCues: Cue[];
  currentFixtures: LightFixture[];
  onLocateCue: (cueId: string) => void;
  onLocateFixtures: (fixtureIds: string[]) => void;
}

const DIFF_TYPE_LABELS: Record<DiffType, string> = {
  added: "新增",
  removed: "删除",
  modified: "修改",
  orderChanged: "顺序变化",
};

const DIFF_TYPE_COLORS: Record<DiffType, string> = {
  added: "#059669",
  removed: "#dc2626",
  modified: "#f59e0b",
  orderChanged: "#8b5cf6",
};

const FIELD_LABELS: Record<string, string> = {
  number: "Cue编号",
  sceneName: "场景名称",
  fixtures: "关联灯具",
  brightnessChange: "亮度变化",
  triggerNote: "触发说明",
  versionNote: "版本备注",
  order: "触发顺序",
  fixtureBrightness: "灯具亮度",
  fixtureColor: "色片",
  fixtureFocus: "焦点位置",
};

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return isoString;
  }
}

function colorToSwatch(colorText: string): string {
  if (colorText.includes("蓝")) return "#3b82f6";
  if (colorText.includes("红")) return "#ef4444";
  if (colorText.includes("紫")) return "#8b5cf6";
  if (colorText.includes("橙")) return "#f97316";
  if (colorText.includes("粉")) return "#ec4899";
  return "#94a3b8";
}

export function CueVersionCompare({
  currentCues,
  currentFixtures,
  onLocateCue,
  onLocateFixtures,
}: Props) {
  const [snapshots, setSnapshots] = useState<VersionSnapshot[]>(() =>
    loadSnapshots()
  );
  const [baseVersionId, setBaseVersionId] = useState<string>(
    snapshots[0]?.id || ""
  );
  const [targetVersionId, setTargetVersionId] = useState<string>(
    snapshots[1]?.id || ""
  );
  const [diffFilter, setDiffFilter] = useState<DiffFilter>("all");
  const [expandedDiffId, setExpandedDiffId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState("");
  const [newSnapshotDesc, setNewSnapshotDesc] = useState("");

  const compareResult = useMemo<CompareResult | null>(() => {
    if (!baseVersionId || !targetVersionId) return null;
    if (baseVersionId === targetVersionId) return null;

    const baseSnapshot = snapshots.find((s) => s.id === baseVersionId);
    const targetSnapshot = snapshots.find((s) => s.id === targetVersionId);

    if (!baseSnapshot || !targetSnapshot) return null;

    const normalizedBase = normalizeVersionSnapshot(baseSnapshot);
    const normalizedTarget = normalizeVersionSnapshot(targetSnapshot);

    return compareVersions(normalizedBase, normalizedTarget);
  }, [baseVersionId, targetVersionId, snapshots]);

  const filteredDiffs = useMemo(() => {
    if (!compareResult) return [];
    if (diffFilter === "all") return compareResult.diffs;
    return compareResult.diffs.filter((d) => d.diffType === diffFilter);
  }, [compareResult, diffFilter]);

  const groupedDiffs = useMemo(() => {
    const groups: Record<DiffType, CueVersionDiff[]> = {
      added: [],
      removed: [],
      modified: [],
      orderChanged: [],
    };
    for (const diff of filteredDiffs) {
      groups[diff.diffType].push(diff);
    }
    return groups;
  }, [filteredDiffs]);

  const handleSwapVersions = useCallback(() => {
    setBaseVersionId(targetVersionId);
    setTargetVersionId(baseVersionId);
  }, [baseVersionId, targetVersionId]);

  const handleCreateSnapshot = useCallback(() => {
    if (!newSnapshotName.trim()) return;

    const newSnapshot = createVersionSnapshot(
      newSnapshotName.trim(),
      newSnapshotDesc.trim(),
      currentCues,
      currentFixtures
    );

    const updatedSnapshots = [...snapshots, newSnapshot];
    setSnapshots(updatedSnapshots);
    saveSnapshots(updatedSnapshots);
    setTargetVersionId(newSnapshot.id);
    setCreateModalOpen(false);
    setNewSnapshotName("");
    setNewSnapshotDesc("");
  }, [newSnapshotName, newSnapshotDesc, currentCues, currentFixtures, snapshots]);

  const handleDiffClick = useCallback(
    (diff: CueVersionDiff) => {
      setExpandedDiffId((prev) => (prev === diff.cueId ? null : diff.cueId));

      const cueId = diff.targetCue?.id || diff.baseCue?.id;
      if (cueId) {
        onLocateCue(cueId);
      }

      const fixtureIds: string[] = [];
      if (diff.targetCue) {
        const fixtures = parseCueFixtures(diff.targetCue, currentFixtures);
        fixtureIds.push(...fixtures.map((f) => f.id));
      }
      if (diff.baseCue && !diff.targetCue) {
        const fixtures = parseCueFixtures(diff.baseCue, currentFixtures);
        fixtureIds.push(...fixtures.map((f) => f.id));
      }
      if (diff.fixtureDiffs) {
        fixtureIds.push(...diff.fixtureDiffs.map((fd) => fd.fixtureId));
      }

      if (fixtureIds.length > 0) {
        onLocateFixtures(Array.from(new Set(fixtureIds)));
      }
    },
    [onLocateCue, onLocateFixtures, currentFixtures]
  );

  const handleFixtureClick = useCallback(
    (fixtureId: string) => {
      onLocateFixtures([fixtureId]);
    },
    [onLocateFixtures]
  );

  const renderFieldDiff = (fieldDiff: any) => {
    const label = FIELD_LABELS[fieldDiff.field] || fieldDiff.field;

    return (
      <div key={fieldDiff.field} className="compare-field-diff">
        <span className="compare-field-label">{label}</span>
        <div className="compare-field-values">
          {fieldDiff.oldValue !== null && (
            <span className="compare-old-value">
              <span className="compare-value-label">基准:</span>
              {String(fieldDiff.oldValue)}
            </span>
          )}
          {fieldDiff.oldValue !== null && fieldDiff.newValue !== null && (
            <span className="compare-arrow">→</span>
          )}
          {fieldDiff.newValue !== null && (
            <span className="compare-new-value">
              <span className="compare-value-label">目标:</span>
              {String(fieldDiff.newValue)}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderFixtureDiff = (fixtureDiff: any) => {
    return (
      <div
        key={fixtureDiff.fixtureId}
        className="compare-fixture-diff"
        onClick={() => handleFixtureClick(fixtureDiff.fixtureId)}
      >
        <div className="compare-fixture-header">
          <span className="compare-fixture-number">{fixtureDiff.fixtureNumber}</span>
          {fixtureDiff.brightnessDiff && (
            <span className="compare-fixture-change">
              亮度: {fixtureDiff.brightnessDiff.old ?? "-"}% →{" "}
              {fixtureDiff.brightnessDiff.new ?? "-"}%
            </span>
          )}
        </div>
        {fixtureDiff.colorDiff && (
          <div className="compare-fixture-sub-diff">
            <span className="compare-sub-label">色片:</span>
            <span className="compare-old-value">
              <span
                className="color-swatch"
                style={{ background: colorToSwatch(fixtureDiff.colorDiff.old) }}
              />
              {fixtureDiff.colorDiff.old}
            </span>
            <span className="compare-arrow">→</span>
            <span className="compare-new-value">
              <span
                className="color-swatch"
                style={{ background: colorToSwatch(fixtureDiff.colorDiff.new) }}
              />
              {fixtureDiff.colorDiff.new}
            </span>
          </div>
        )}
        {fixtureDiff.focusDiff && (
          <div className="compare-fixture-sub-diff">
            <span className="compare-sub-label">焦点:</span>
            <span className="compare-old-value">
              {fixtureDiff.focusDiff.old}
            </span>
            <span className="compare-arrow">→</span>
            <span className="compare-new-value">
              {fixtureDiff.focusDiff.new}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderDiffItem = (diff: CueVersionDiff) => {
    const isExpanded = expandedDiffId === diff.cueId;
    const color = DIFF_TYPE_COLORS[diff.diffType];
    const label = DIFF_TYPE_LABELS[diff.diffType];

    return (
      <article
        key={diff.cueId}
        className={`compare-diff-item compare-${diff.diffType}`}
        onClick={() => handleDiffClick(diff)}
      >
        <div className="compare-diff-header">
          <div className="compare-diff-main">
            <span
              className="compare-diff-badge"
              style={{ background: color, borderColor: color }}
            >
              {label}
            </span>
            <h3 className="compare-diff-cue-number">{diff.cueNumber}</h3>
            {diff.isRenamed && (
              <span className="compare-renamed-badge">已改名</span>
            )}
            {diff.matchedByContent && (
              <span className="compare-content-match-badge">内容匹配</span>
            )}
          </div>
          {diff.orderChanged && (
            <span className="compare-order-change">
              位置 {diff.orderChanged.oldIndex + 1} → {diff.orderChanged.newIndex + 1}
            </span>
          )}
          <span
            className={`compare-expand-icon ${isExpanded ? "expanded" : ""}`}
          >
            ▼
          </span>
        </div>

        {(diff.targetCue?.sceneName || diff.baseCue?.sceneName) && (
          <div className="compare-diff-scene">
            {diff.baseCue?.sceneName && diff.targetCue?.sceneName &&
            diff.baseCue.sceneName !== diff.targetCue.sceneName ? (
              <>
                <span className="compare-old-value">
                  {diff.baseCue.sceneName}
                </span>
                <span className="compare-arrow">→</span>
                <span className="compare-new-value">
                  {diff.targetCue.sceneName}
                </span>
              </>
            ) : (
              <span className="compare-scene-name">
                {diff.targetCue?.sceneName || diff.baseCue?.sceneName}
              </span>
            )}
          </div>
        )}

        {isExpanded && (
          <div className="compare-diff-details">
            {diff.fieldDiffs.length > 0 && (
              <div className="compare-diff-section">
                <h4 className="compare-section-title">Cue属性变化</h4>
                {diff.fieldDiffs.map(renderFieldDiff)}
              </div>
            )}

            {diff.fixtureDiffs && diff.fixtureDiffs.length > 0 && (
              <div className="compare-diff-section">
                <h4 className="compare-section-title">灯具属性变化</h4>
                {diff.fixtureDiffs.map(renderFixtureDiff)}
              </div>
            )}

            {diff.diffType === "added" && diff.targetCue && (
              <div className="compare-diff-section">
                <h4 className="compare-section-title">新增Cue详情</h4>
                <div className="compare-cue-preview">
                  <div className="compare-field-diff">
                    <span className="compare-field-label">关联灯具</span>
                    <span className="compare-new-value">
                      {diff.targetCue.fixtures}
                    </span>
                  </div>
                  <div className="compare-field-diff">
                    <span className="compare-field-label">亮度</span>
                    <span className="compare-new-value">
                      {diff.targetCue.brightnessChange}
                    </span>
                  </div>
                  {diff.targetCue.triggerNote && (
                    <div className="compare-field-diff">
                      <span className="compare-field-label">触发说明</span>
                      <span className="compare-new-value">
                        {diff.targetCue.triggerNote}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {diff.diffType === "removed" && diff.baseCue && (
              <div className="compare-diff-section">
                <h4 className="compare-section-title">已删除Cue详情</h4>
                <div className="compare-cue-preview">
                  <div className="compare-field-diff">
                    <span className="compare-field-label">关联灯具</span>
                    <span className="compare-old-value">
                      {diff.baseCue.fixtures}
                    </span>
                  </div>
                  <div className="compare-field-diff">
                    <span className="compare-field-label">亮度</span>
                    <span className="compare-old-value">
                      {diff.baseCue.brightnessChange}
                    </span>
                  </div>
                  {diff.baseCue.triggerNote && (
                    <div className="compare-field-diff">
                      <span className="compare-field-label">触发说明</span>
                      <span className="compare-old-value">
                        {diff.baseCue.triggerNote}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="compare-diff-actions">
              <button
                className="compare-locate-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  const cueId = diff.targetCue?.id || diff.baseCue?.id;
                  if (cueId) onLocateCue(cueId);
                }}
              >
                定位到Cue详情
              </button>
              <button
                className="compare-locate-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  const fixtureIds: string[] = [];
                  if (diff.targetCue) {
                    const fixtures = parseCueFixtures(
                      diff.targetCue,
                      currentFixtures
                    );
                    fixtureIds.push(...fixtures.map((f) => f.id));
                  }
                  if (diff.baseCue) {
                    const fixtures = parseCueFixtures(
                      diff.baseCue,
                      currentFixtures
                    );
                    fixtureIds.push(...fixtures.map((f) => f.id));
                  }
                  if (fixtureIds.length > 0) {
                    onLocateFixtures(Array.from(new Set(fixtureIds)));
                  }
                }}
              >
                定位到灯位图
              </button>
            </div>
          </div>
        )}
      </article>
    );
  };

  return (
    <section className="panel compare-panel">
      <div className="heading">
        <div>
          <p>版本管理</p>
          <h2>Cue版本对比</h2>
        </div>
        <div className="heading-actions">
          <button
            className="primary"
            onClick={() => setCreateModalOpen(true)}
          >
            保存当前版本
          </button>
        </div>
      </div>

      <div className="compare-version-selector">
        <div className="compare-version-field">
          <label>基准版本</label>
          <select
            value={baseVersionId}
            onChange={(e) => setBaseVersionId(e.target.value)}
            className="compare-select"
          >
            <option value="">选择基准版本...</option>
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({formatDate(s.createdAt)})
              </option>
            ))}
          </select>
          {baseVersionId && (
            <p className="compare-version-desc">
              {snapshots.find((s) => s.id === baseVersionId)?.description}
            </p>
          )}
        </div>

        <button
          className="compare-swap-btn"
          onClick={handleSwapVersions}
          title="交换版本"
        >
          ⇄
        </button>

        <div className="compare-version-field">
          <label>目标版本</label>
          <select
            value={targetVersionId}
            onChange={(e) => setTargetVersionId(e.target.value)}
            className="compare-select"
          >
            <option value="">选择目标版本...</option>
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({formatDate(s.createdAt)})
              </option>
            ))}
          </select>
          {targetVersionId && (
            <p className="compare-version-desc">
              {snapshots.find((s) => s.id === targetVersionId)?.description}
            </p>
          )}
        </div>
      </div>

      {compareResult && (
        <>
          <div className="compare-summary">
            <div className="compare-summary-card">
              <span className="compare-summary-label">新增Cue</span>
              <strong style={{ color: DIFF_TYPE_COLORS.added }}>
                {compareResult.summary.totalAdded}
              </strong>
            </div>
            <div className="compare-summary-card">
              <span className="compare-summary-label">删除Cue</span>
              <strong style={{ color: DIFF_TYPE_COLORS.removed }}>
                {compareResult.summary.totalRemoved}
              </strong>
            </div>
            <div className="compare-summary-card">
              <span className="compare-summary-label">修改Cue</span>
              <strong style={{ color: DIFF_TYPE_COLORS.modified }}>
                {compareResult.summary.totalModified}
              </strong>
            </div>
            <div className="compare-summary-card">
              <span className="compare-summary-label">顺序变化</span>
              <strong style={{ color: DIFF_TYPE_COLORS.orderChanged }}>
                {compareResult.summary.totalOrderChanged}
              </strong>
            </div>
            <div className="compare-summary-card">
              <span className="compare-summary-label">影响灯具</span>
              <strong style={{ color: "#06b6d4" }}>
                {compareResult.summary.fixturesAffected.length}
              </strong>
            </div>
          </div>

          <div className="compare-filter-chips">
            {(["all", "added", "removed", "modified", "orderChanged"] as const).map(
              (filter) => (
                <button
                  key={filter}
                  className={`chip ${diffFilter === filter ? "active" : ""}`}
                  style={
                    diffFilter === filter && filter !== "all"
                      ? {
                          background: DIFF_TYPE_COLORS[filter],
                          borderColor: DIFF_TYPE_COLORS[filter],
                        }
                      : {}
                  }
                  onClick={() => setDiffFilter(filter)}
                >
                  {filter === "all"
                    ? "全部"
                    : `${DIFF_TYPE_LABELS[filter]} (${groupedDiffs[filter].length})`}
                </button>
              )
            )}
          </div>

          <div className="compare-diff-list">
            {filteredDiffs.length === 0 ? (
              <div className="compare-empty">
                <svg
                  width="56"
                  height="56"
                  viewBox="0 0 56 56"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    stroke="#cbd5e1"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                  <path
                    d="M20 28h16M28 20v16"
                    stroke="#cbd5e1"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
                <p className="compare-empty-title">
                  {diffFilter === "all"
                    ? "两个版本完全一致，没有差异"
                    : `当前筛选条件下没有${DIFF_TYPE_LABELS[diffFilter]}的Cue`}
                </p>
                <p className="compare-empty-hint">
                  {diffFilter === "all"
                    ? "选择其他版本进行对比，或修改当前版本后保存新版本"
                    : "切换筛选条件查看其他类型的差异"}
                </p>
              </div>
            ) : (
              filteredDiffs.map(renderDiffItem)
            )}
          </div>
        </>
      )}

      {!compareResult && baseVersionId && targetVersionId && (
        <div className="compare-empty">
          <p className="compare-empty-title">请选择两个不同的版本进行对比</p>
        </div>
      )}

      {(!baseVersionId || !targetVersionId) && (
        <div className="compare-empty">
          <p className="compare-empty-title">请选择基准版本和目标版本</p>
          <p className="compare-empty-hint">
            从上方下拉框中选择要对比的两个演出版本
          </p>
        </div>
      )}

      {createModalOpen && (
        <div
          className="drawer-overlay"
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            className="compare-create-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <p className="drawer-label">版本管理</p>
                <h2>保存当前版本</h2>
              </div>
              <button
                className="drawer-close"
                onClick={() => setCreateModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="drawer-body">
              <div className="form-group">
                <label>
                  <span>
                    版本名称 <em className="required">*</em>
                  </span>
                  <input
                    type="text"
                    value={newSnapshotName}
                    onChange={(e) => setNewSnapshotName(e.target.value)}
                    placeholder="例如：版本C - 导演终审版"
                  />
                </label>
              </div>
              <div className="form-group">
                <label>
                  <span>版本说明</span>
                  <textarea
                    value={newSnapshotDesc}
                    onChange={(e) => setNewSnapshotDesc(e.target.value)}
                    placeholder="记录本次版本的主要调整内容..."
                    rows={4}
                  />
                </label>
              </div>
              <div className="compare-preview-info">
                <p>
                  将保存当前状态：
                  <strong>{currentCues.length}</strong> 个Cue，
                  <strong>{currentFixtures.length}</strong> 台灯具
                </p>
              </div>
            </div>

            <div className="drawer-footer">
              <button
                className="btn-secondary"
                onClick={() => setCreateModalOpen(false)}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateSnapshot}
                disabled={!newSnapshotName.trim()}
              >
                保存版本
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
