import { useState, useMemo, useCallback } from "react";
import { type LightFixture, type LightType, LIGHT_TYPE_COLORS } from "../data/fixtures";

interface Filters {
  type: LightType | "all";
  color: string;
  focus: string;
  brightnessMin: number;
  brightnessMax: number;
}

interface PendingChanges {
  brightness?: number;
  focus?: string;
  notes?: string;
}

interface Props {
  fixtures: LightFixture[];
  selectedFixtureIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSetSelectedFixtures: (ids: Set<string>) => void;
  onClearSelectedFixtures: () => void;
  onUpdateFixtures: (updates: Partial<LightFixture> & { id: string }[]) => void;
}

const ALL_TYPES: (LightType | "all")[] = ["all", "面光", "侧光", "逆光", "效果光"];
const TYPE_LABELS: Record<LightType | "all", string> = {
  all: "全部灯区",
  面光: "面光",
  侧光: "侧光",
  逆光: "逆光",
  效果光: "效果光",
};

const BRIGHTNESS_PRESETS = [
  { label: "熄灭", value: 0 },
  { label: "25%", value: 25 },
  { label: "50%", value: 50 },
  { label: "75%", value: 75 },
  { label: "100%", value: 100 },
];

function colorToSwatch(colorText: string): string {
  if (colorText.includes("蓝")) return "#3b82f6";
  if (colorText.includes("红")) return "#ef4444";
  if (colorText.includes("紫")) return "#8b5cf6";
  if (colorText.includes("橙")) return "#f97316";
  if (colorText.includes("粉")) return "#ec4899";
  return "#94a3b8";
}

export function FixtureBatchWorkspace({
  fixtures,
  selectedFixtureIds,
  onToggleSelection,
  onSetSelectedFixtures,
  onClearSelectedFixtures,
  onUpdateFixtures,
}: Props) {
  const [filters, setFilters] = useState<Filters>({
    type: "all",
    color: "",
    focus: "",
    brightnessMin: 0,
    brightnessMax: 100,
  });
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const uniqueColors = useMemo(() => {
    const colors = new Set(fixtures.map((f) => f.color));
    return Array.from(colors).sort();
  }, [fixtures]);

  const uniqueFocuses = useMemo(() => {
    const focuses = new Set(fixtures.map((f) => f.focus));
    return Array.from(focuses).sort();
  }, [fixtures]);

  const filteredFixtures = useMemo(() => {
    return fixtures.filter((f) => {
      if (filters.type !== "all" && f.type !== filters.type) return false;
      if (filters.color && !f.color.includes(filters.color)) return false;
      if (filters.focus && !f.focus.includes(filters.focus)) return false;
      if (f.brightness < filters.brightnessMin || f.brightness > filters.brightnessMax) return false;
      return true;
    });
  }, [fixtures, filters]);

  const selectedFixtures = useMemo(() => {
    return fixtures.filter((f) => selectedFixtureIds.has(f.id));
  }, [fixtures, selectedFixtureIds]);

  const selectedInFiltered = useMemo(() => {
    return filteredFixtures.filter((f) => selectedFixtureIds.has(f.id));
  }, [filteredFixtures, selectedFixtureIds]);

  const hasUnsavedChanges = Object.keys(pendingChanges).length > 0 && selectedFixtures.length > 0;

  const handleFilterChange = useCallback((key: keyof Filters, value: string | number) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    const allFilteredIds = new Set(filteredFixtures.map((f) => f.id));
    const merged = new Set(selectedFixtureIds);
    allFilteredIds.forEach((id) => merged.add(id));
    onSetSelectedFixtures(merged);
  }, [filteredFixtures, selectedFixtureIds, onSetSelectedFixtures]);

  const handleDeselectAllFiltered = useCallback(() => {
    const next = new Set(selectedFixtureIds);
    filteredFixtures.forEach((f) => next.delete(f.id));
    onSetSelectedFixtures(next);
  }, [filteredFixtures, selectedFixtureIds, onSetSelectedFixtures]);

  const handleSelectOnlyFiltered = useCallback(() => {
    onSetSelectedFixtures(new Set(filteredFixtures.map((f) => f.id)));
  }, [filteredFixtures, onSetSelectedFixtures]);

  const handleClearSelection = useCallback(() => {
    onClearSelectedFixtures();
    setPendingChanges({});
  }, [onClearSelectedFixtures]);

  const handleBrightnessPreset = useCallback((value: number) => {
    setPendingChanges((prev) => ({ ...prev, brightness: value }));
  }, []);

  const handleBrightnessInput = useCallback((value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      const clamped = Math.max(0, Math.min(100, num));
      setPendingChanges((prev) => ({ ...prev, brightness: clamped }));
    } else if (value === "") {
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next.brightness;
        return next;
      });
    }
  }, []);

  const handleFocusChange = useCallback((value: string) => {
    if (value.trim()) {
      setPendingChanges((prev) => ({ ...prev, focus: value.trim() }));
    } else {
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next.focus;
        return next;
      });
    }
  }, []);

  const handleNotesChange = useCallback((value: string) => {
    if (value.trim()) {
      setPendingChanges((prev) => ({ ...prev, notes: value.trim() }));
    } else {
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next.notes;
        return next;
      });
    }
  }, []);

  const handleResetPending = useCallback(() => {
    setPendingChanges({});
  }, []);

  const handleApplyChanges = useCallback(() => {
    if (selectedFixtures.length === 0 || Object.keys(pendingChanges).length === 0) return;
    setShowConfirmDialog(true);
  }, [selectedFixtures.length, pendingChanges]);

  const confirmApplyChanges = useCallback(() => {
    if (selectedFixtures.length === 0) return;

    const updates = selectedFixtures.map((f) => ({
      id: f.id,
      ...pendingChanges,
    }));

    onUpdateFixtures(updates);
    setPendingChanges({});
    setShowConfirmDialog(false);
  }, [selectedFixtures, pendingChanges, onUpdateFixtures]);

  const resetFilters = useCallback(() => {
    setFilters({
      type: "all",
      color: "",
      focus: "",
      brightnessMin: 0,
      brightnessMax: 100,
    });
  }, []);

  return (
    <section className="batch-workspace">
      <div className="batch-workspace-header">
        <div>
          <p className="batch-workspace-label">灯具批量工作区</p>
          <h2>筛选与批量调整</h2>
        </div>
        <div className="batch-workspace-status">
          {selectedFixtureIds.size > 0 && (
            <span className={`batch-selection-badge${hasUnsavedChanges ? " batch-selection-badge-unsaved" : ""}`}>
              {hasUnsavedChanges && <span className="batch-unsaved-dot" />}
              已选 {selectedFixtureIds.size} 台
              {hasUnsavedChanges && " · 有未保存修改"}
            </span>
          )}
        </div>
      </div>

      <div className="batch-workspace-body">
        <div className="batch-filters-section">
          <h3 className="batch-section-title">筛选条件</h3>

          <div className="batch-filter-grid">
            <div className="batch-filter-item">
              <label>灯区类型</label>
              <div className="batch-filter-chips">
                {ALL_TYPES.map((t) => (
                  <button
                    key={t}
                    className={`batch-chip${filters.type === t ? " batch-chip-active" : ""}`}
                    style={
                      filters.type === t && t !== "all"
                        ? { background: LIGHT_TYPE_COLORS[t as LightType], borderColor: LIGHT_TYPE_COLORS[t as LightType], color: "#fff" }
                        : {}
                    }
                    onClick={() => handleFilterChange("type", t)}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div className="batch-filter-item">
              <label>色片</label>
              <select
                className="batch-select"
                value={filters.color}
                onChange={(e) => handleFilterChange("color", e.target.value)}
              >
                <option value="">全部色片</option>
                {uniqueColors.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="batch-filter-item">
              <label>焦点位置</label>
              <select
                className="batch-select"
                value={filters.focus}
                onChange={(e) => handleFilterChange("focus", e.target.value)}
              >
                <option value="">全部焦点</option>
                {uniqueFocuses.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div className="batch-filter-item">
              <label>亮度范围</label>
              <div className="batch-brightness-range">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.brightnessMin}
                  onChange={(e) => handleFilterChange("brightnessMin", parseInt(e.target.value) || 0)}
                  className="batch-number-input"
                />
                <span className="batch-range-separator">—</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.brightnessMax}
                  onChange={(e) => handleFilterChange("brightnessMax", parseInt(e.target.value) || 100)}
                  className="batch-number-input"
                />
                <span className="batch-range-unit">%</span>
              </div>
            </div>
          </div>

          <div className="batch-filter-actions">
            <span className="batch-filter-count">筛选结果：{filteredFixtures.length} 台灯具</span>
            <button className="batch-btn batch-btn-ghost" onClick={resetFilters}>
              重置筛选
            </button>
          </div>
        </div>

        <div className="batch-selection-section">
          <div className="batch-selection-header">
            <h3 className="batch-section-title">灯具列表</h3>
            <div className="batch-selection-actions">
              <button className="batch-btn batch-btn-small" onClick={handleSelectOnlyFiltered}>
                仅选筛选结果
              </button>
              <button className="batch-btn batch-btn-small" onClick={handleSelectAllFiltered}>
                全选筛选结果
              </button>
              <button className="batch-btn batch-btn-small batch-btn-ghost" onClick={handleDeselectAllFiltered}>
                取消筛选结果
              </button>
              <button className="batch-btn batch-btn-small batch-btn-danger" onClick={handleClearSelection}>
                清空选择
              </button>
            </div>
          </div>

          {selectedFixtureIds.size > 0 && selectedInFiltered.length !== selectedFixtureIds.size && (
            <div className="batch-selection-warning">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L1 21h22L12 2z" stroke="#f59e0b" strokeWidth="2" fill="none" />
                <line x1="12" y1="9" x2="12" y2="14" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="17" r="1" fill="#f59e0b" />
              </svg>
              <span>
                已选 {selectedFixtureIds.size} 台中，有 {selectedFixtureIds.size - selectedInFiltered.length} 台不在当前筛选结果中。
                批量修改将作用于<strong>全部已选灯具</strong>，而非仅当前筛选结果。
              </span>
            </div>
          )}

          <div className="batch-fixture-list">
            {filteredFixtures.length === 0 ? (
              <div className="batch-fixture-empty">
                <p>没有符合筛选条件的灯具</p>
              </div>
            ) : (
              filteredFixtures.map((fixture) => {
                const isSelected = selectedFixtureIds.has(fixture.id);
                const typeColor = LIGHT_TYPE_COLORS[fixture.type];
                return (
                  <label
                    key={fixture.id}
                    className={`batch-fixture-item${isSelected ? " batch-fixture-item-selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelection(fixture.id)}
                    />
                    <span className="batch-fixture-type" style={{ background: typeColor }}>
                      {fixture.type}
                    </span>
                    <div className="batch-fixture-info">
                      <div className="batch-fixture-main">
                        <strong>{fixture.number}</strong>
                        <span className="batch-fixture-channel">{fixture.channel}</span>
                      </div>
                      <div className="batch-fixture-meta">
                        <span className="batch-fixture-color">
                          <span className="batch-color-swatch" style={{ background: colorToSwatch(fixture.color) }} />
                          {fixture.color}
                        </span>
                        <span className="batch-fixture-focus">{fixture.focus}</span>
                        <span
                          className="batch-fixture-brightness"
                          style={{ color: fixture.brightness === 0 ? "#94a3b8" : typeColor }}
                        >
                          {fixture.brightness}%
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="batch-edit-section">
          <h3 className="batch-section-title">批量调整</h3>

          {selectedFixtures.length === 0 ? (
            <div className="batch-edit-empty">
              <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 3" />
                <path d="M24 16v8m0 4v2" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p>请先在左侧或灯位图中选择灯具</p>
            </div>
          ) : (
            <>
              <div className="batch-edit-summary">
                将对 <strong>{selectedFixtures.length}</strong> 台灯具进行以下修改：
              </div>

              <div className="batch-edit-field">
                <label>亮度预设</label>
                <div className="batch-brightness-presets">
                  {BRIGHTNESS_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      className={`batch-preset-btn${pendingChanges.brightness === p.value ? " batch-preset-btn-active" : ""}`}
                      onClick={() => handleBrightnessPreset(p.value)}
                    >
                      {p.label}
                    </button>
                  ))}
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="batch-number-input batch-brightness-custom"
                    placeholder="自定义"
                    value={pendingChanges.brightness ?? ""}
                    onChange={(e) => handleBrightnessInput(e.target.value)}
                  />
                  <span className="batch-range-unit">%</span>
                </div>
                {pendingChanges.brightness !== undefined && (
                  <div className="batch-change-preview">
                    → 亮度将设置为 <strong>{pendingChanges.brightness}%</strong>
                  </div>
                )}
              </div>

              <div className="batch-edit-field">
                <label>焦点位置</label>
                <input
                  type="text"
                  className="batch-text-input"
                  placeholder="输入新的焦点位置..."
                  value={pendingChanges.focus ?? ""}
                  onChange={(e) => handleFocusChange(e.target.value)}
                />
                {pendingChanges.focus && (
                  <div className="batch-change-preview">
                    → 焦点将设置为 <strong>{pendingChanges.focus}</strong>
                  </div>
                )}
              </div>

              <div className="batch-edit-field">
                <label>备注（焦点备注）</label>
                <textarea
                  className="batch-textarea"
                  placeholder="输入备注内容..."
                  value={pendingChanges.notes ?? ""}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  rows={3}
                />
                {pendingChanges.notes && (
                  <div className="batch-change-preview">
                    → 备注将设置为 <strong>{pendingChanges.notes}</strong>
                  </div>
                )}
              </div>

              <div className="batch-edit-actions">
                <button
                  className="batch-btn batch-btn-ghost"
                  onClick={handleResetPending}
                  disabled={!hasUnsavedChanges}
                >
                  撤销修改
                </button>
                <button
                  className="batch-btn batch-btn-primary"
                  onClick={handleApplyChanges}
                  disabled={!hasUnsavedChanges}
                >
                  应用到 {selectedFixtures.length} 台灯具
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showConfirmDialog && (
        <div className="batch-confirm-overlay" onClick={() => setShowConfirmDialog(false)}>
          <div className="batch-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>确认批量修改</h3>
            <p>
              即将对 <strong>{selectedFixtures.length}</strong> 台灯具应用以下修改：
            </p>
            <ul className="batch-confirm-list">
              {pendingChanges.brightness !== undefined && (
                <li>亮度设置为 <strong>{pendingChanges.brightness}%</strong></li>
              )}
              {pendingChanges.focus && (
                <li>焦点位置设置为 <strong>{pendingChanges.focus}</strong></li>
              )}
              {pendingChanges.notes && (
                <li>备注设置为 <strong>{pendingChanges.notes}</strong></li>
              )}
            </ul>
            <p className="batch-confirm-warning">
              修改将同步到舞台灯位图和Cue编辑区域。确认继续吗？
            </p>
            <div className="batch-confirm-actions">
              <button className="batch-btn batch-btn-ghost" onClick={() => setShowConfirmDialog(false)}>
                取消
              </button>
              <button className="batch-btn batch-btn-primary" onClick={confirmApplyChanges}>
                确认应用
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
