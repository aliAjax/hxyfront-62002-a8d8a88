import { useState, useEffect, useMemo } from "react";
import { type Cue, EMPTY_CUE, parseCueFixtures, parseCueBrightness, hasBrightnessField, getCueFixtureDiffs, syncCueBrightnessFromFixtures, buildFixturesString } from "../data/cues";
import { LIGHT_TYPE_COLORS, type LightFixture, type LightType } from "../data/fixtures";

const ALL_TYPES: LightType[] = ["面光", "侧光", "逆光", "效果光"];

interface Props {
  open: boolean;
  cue: Cue | null;
  allCues: Cue[];
  fixtures: LightFixture[];
  onClose: () => void;
  onSave: (cue: Cue) => void;
}

interface FormErrors {
  number?: string;
  sceneName?: string;
  fixtures?: string;
  brightnessChange?: string;
}

export function CueEditDrawer({ open, cue, allCues, fixtures, onClose, onSave }: Props) {
  const isEditing = !!cue;
  const [form, setForm] = useState<Cue>(EMPTY_CUE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorSelectedIds, setSelectorSelectedIds] = useState<Set<string>>(new Set());
  const [selectorTypeFilter, setSelectorTypeFilter] = useState<LightType | null>(null);
  const [selectorSearch, setSelectorSearch] = useState("");

  useEffect(() => {
    if (open) {
      if (cue) {
        setForm({ ...cue });
      } else {
        setForm({ ...EMPTY_CUE, id: `cue-${Date.now()}` });
      }
      setErrors({});
      setTouched({});
    }
  }, [open, cue]);

  const validateField = (name: keyof Cue, value: string): string | undefined => {
    const requiredFields: (keyof Cue)[] = ["number", "sceneName", "fixtures", "brightnessChange"];

    if (requiredFields.includes(name) && !value.trim()) {
      return "此项为必填";
    }

    if (name === "number" && value.trim()) {
      const isDuplicate = allCues.some(
        (c) => c.number.trim() === value.trim() && c.id !== form.id
      );
      if (isDuplicate) {
        return "Cue编号已存在";
      }
    }

    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const fieldsToValidate: (keyof Cue)[] = ["number", "sceneName", "fixtures", "brightnessChange"];

    fieldsToValidate.forEach((field) => {
      const error = validateField(field, form[field]);
      if (error) {
        newErrors[field as keyof FormErrors] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof Cue, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));

    if (touched[field]) {
      const error = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  };

  const handleBlur = (field: keyof Cue) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, form[field]);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleSave = () => {
    const allTouched: Record<string, boolean> = {};
    ["number", "sceneName", "fixtures", "brightnessChange"].forEach((f) => {
      allTouched[f] = true;
    });
    setTouched(allTouched);

    if (validateForm()) {
      onSave(form);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const matchedFixtures = useMemo(() => {
    if (!form.fixtures || !form.fixtures.trim()) return [];
    const tempCue: Cue = { ...form };
    return parseCueFixtures(tempCue, fixtures);
  }, [form, fixtures]);

  const fixtureDiffs = useMemo(() => {
    if (!form.fixtures || !form.fixtures.trim()) return [];
    const tempCue: Cue = { ...form };
    return getCueFixtureDiffs(tempCue, fixtures);
  }, [form, fixtures]);

  const cueBrightnessValue = useMemo(() => {
    return parseCueBrightness(form);
  }, [form]);

  const hasDivergence = useMemo(() => {
    return fixtureDiffs.some((d) => d.brightnessDiffers);
  }, [fixtureDiffs]);

  const groupedMatchedFixtures = useMemo(() => {
    const groups: Record<LightType, LightFixture[]> = {
      面光: [],
      侧光: [],
      逆光: [],
      效果光: [],
    };
    for (const f of matchedFixtures) {
      groups[f.type].push(f);
    }
    return groups;
  }, [matchedFixtures]);

  const handleSyncBrightness = () => {
    const tempCue: Cue = { ...form };
    const synced = syncCueBrightnessFromFixtures(tempCue, fixtures);
    setForm((prev) => ({ ...prev, brightnessChange: synced.brightnessChange }));
  };

  const handleOpenSelector = () => {
    const matched = parseCueFixtures(form, fixtures);
    const ids = new Set(matched.map((f) => f.id));
    setSelectorSelectedIds(ids);
    setSelectorTypeFilter(null);
    setSelectorSearch("");
    setSelectorOpen(true);
  };

  const handleCloseSelector = () => {
    setSelectorOpen(false);
  };

  const handleToggleSelectorFixture = (id: string) => {
    setSelectorSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectorSelectAll = () => {
    const filtered = selectorFilteredFixtures;
    const allFilteredSelected = filtered.every((f) => selectorSelectedIds.has(f.id));
    setSelectorSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const f of filtered) {
          next.delete(f.id);
        }
      } else {
        for (const f of filtered) {
          next.add(f.id);
        }
      }
      return next;
    });
  };

  const handleSelectorSelectType = (type: LightType) => {
    const typeFixtures = fixtures.filter((f) => f.type === type);
    const allTypeSelected = typeFixtures.every((f) => selectorSelectedIds.has(f.id));
    setSelectorSelectedIds((prev) => {
      const next = new Set(prev);
      if (allTypeSelected) {
        for (const f of typeFixtures) {
          next.delete(f.id);
        }
      } else {
        for (const f of typeFixtures) {
          next.add(f.id);
        }
      }
      return next;
    });
  };

  const handleConfirmSelector = () => {
    const ids = Array.from(selectorSelectedIds);
    const fixturesStr = buildFixturesString(ids, fixtures);
    handleChange("fixtures", fixturesStr);
    handleBlur("fixtures");
    setSelectorOpen(false);
  };

  const selectorFilteredFixtures = useMemo(() => {
    return fixtures.filter((f) => {
      if (selectorTypeFilter && f.type !== selectorTypeFilter) return false;
      if (selectorSearch.trim()) {
        const q = selectorSearch.trim().toLowerCase();
        if (
          !f.number.toLowerCase().includes(q) &&
          !f.channel.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [fixtures, selectorTypeFilter, selectorSearch]);

  const selectorGroupedFixtures = useMemo(() => {
    const groups: Record<LightType, LightFixture[]> = {
      面光: [],
      侧光: [],
      逆光: [],
      效果光: [],
    };
    for (const f of selectorFilteredFixtures) {
      groups[f.type].push(f);
    }
    return groups;
  }, [selectorFilteredFixtures]);

  if (!open) return null;

  return (
    <div className="drawer-overlay" onClick={handleCancel}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <p className="drawer-label">Cue编辑</p>
            <h2>{isEditing ? "修改Cue" : "新增Cue"}</h2>
          </div>
          <button className="drawer-close" onClick={handleCancel} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          <div className="form-group">
            <label>
              <span>
                Cue编号 <em className="required">*</em>
              </span>
              <input
                type="text"
                value={form.number}
                onChange={(e) => handleChange("number", e.target.value)}
                onBlur={() => handleBlur("number")}
                placeholder="例如：Cue 12"
                className={errors.number ? "input-error" : ""}
              />
              {errors.number && touched.number && (
                <span className="error-text">{errors.number}</span>
              )}
            </label>
          </div>

          <div className="form-group">
            <label>
              <span>
                场景名称 <em className="required">*</em>
              </span>
              <input
                type="text"
                value={form.sceneName}
                onChange={(e) => handleChange("sceneName", e.target.value)}
                onBlur={() => handleBlur("sceneName")}
                placeholder="例如：冷蓝侧光"
                className={errors.sceneName ? "input-error" : ""}
              />
              {errors.sceneName && touched.sceneName && (
                <span className="error-text">{errors.sceneName}</span>
              )}
            </label>
          </div>

          <div className="form-group">
            <label>
              <span>
                关联灯具 <em className="required">*</em>
              </span>
              <div className="cue-fixtures-input-wrap">
                <input
                  type="text"
                  value={form.fixtures}
                  onChange={(e) => handleChange("fixtures", e.target.value)}
                  onBlur={() => handleBlur("fixtures")}
                  placeholder="例如：CH 021-028"
                  className={`cue-fixtures-input${errors.fixtures ? " input-error" : ""}`}
                />
                <button
                  type="button"
                  className="cue-fixtures-select-btn"
                  onClick={handleOpenSelector}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  选择灯具
                </button>
              </div>
              {errors.fixtures && touched.fixtures && (
                <span className="error-text">{errors.fixtures}</span>
              )}
            </label>
          </div>

          <div className="form-group">
            <label>
              <span>
                亮度变化 <em className="required">*</em>
              </span>
              <input
                type="text"
                value={form.brightnessChange}
                onChange={(e) => handleChange("brightnessChange", e.target.value)}
                onBlur={() => handleBlur("brightnessChange")}
                placeholder="例如：亮度65%"
                className={errors.brightnessChange ? "input-error" : ""}
              />
              {errors.brightnessChange && touched.brightnessChange && (
                <span className="error-text">{errors.brightnessChange}</span>
              )}
            </label>
          </div>

          <div className="form-group">
            <label>
              <span>触发说明</span>
              <input
                type="text"
                value={form.triggerNote}
                onChange={(e) => handleChange("triggerNote", e.target.value)}
                placeholder="例如：二幕开场"
              />
            </label>
          </div>

          <div className="form-group">
            <label>
              <span>版本备注</span>
              <input
                type="text"
                value={form.versionNote}
                onChange={(e) => handleChange("versionNote", e.target.value)}
                placeholder="例如：版本A"
              />
            </label>
          </div>

          {matchedFixtures.length > 0 && (
            <div className="form-group">
              <div className="drawer-fixtures-preview-header">
                <span className="drawer-fixtures-preview-title">关联灯具实时状态</span>
                <span className="drawer-fixtures-preview-count">{matchedFixtures.length}台</span>
                {hasDivergence && (
                  <button
                    className="drawer-sync-btn"
                    onClick={handleSyncBrightness}
                  >
                    同步灯具当前亮度
                  </button>
                )}
              </div>
              {hasDivergence && (
                <div className="drawer-divergence-hint">
                  部分灯具当前亮度与Cue指令「{form.brightnessChange}」不一致
                </div>
              )}
              <div className="drawer-fixtures-preview-list">
                {ALL_TYPES.map((type) => {
                  const group = groupedMatchedFixtures[type];
                  if (group.length === 0) return null;
                  const typeColor = LIGHT_TYPE_COLORS[type];
                  return (
                    <div key={type} className="drawer-fixtures-group">
                      <div className="drawer-fixtures-group-header">
                        <span className="drawer-fixtures-group-dot" style={{ background: typeColor }} />
                        <span className="drawer-fixtures-group-label">{type}</span>
                      </div>
                      {group.map((f) => {
                        const diff = fixtureDiffs.find((d) => d.fixtureId === f.id);
                        return (
                          <div
                            key={f.id}
                            className={`drawer-fixture-row${diff?.brightnessDiffers ? " drawer-fixture-row-diverged" : ""}`}
                          >
                            <span className="drawer-fixture-number">{f.number}</span>
                            <span className="drawer-fixture-channel">{f.channel}</span>
                            <span
                              className="drawer-fixture-brightness"
                              style={{ color: f.brightness === 0 ? "#94a3b8" : typeColor }}
                            >
                              {f.brightness}%
                            </span>
                            {diff?.brightnessDiffers && cueBrightnessValue !== null && (
                              <span className="drawer-fixture-delta">
                                Cue {cueBrightnessValue}%→{f.brightness}%
                              </span>
                            )}
                            <span className="drawer-fixture-focus">{f.focus}</span>
                            {f.notes && (
                              <span className="drawer-fixture-note">备注：{f.notes}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {form.fixtures && form.fixtures.trim() && matchedFixtures.length === 0 && (
            <div className="drawer-no-match-hint">
              未匹配到灯具，请检查关联灯具描述
            </div>
          )}
        </div>

        <div className="drawer-footer">
          <button className="btn-secondary" onClick={handleCancel}>
            取消
          </button>
          <button className="btn-primary" onClick={handleSave}>
            保存
          </button>
        </div>
      </aside>

      {selectorOpen && (
        <div className="fixture-selector-overlay" onClick={handleCloseSelector}>
          <div className="fixture-selector-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fixture-selector-header">
              <div>
                <p className="fixture-selector-label">选择灯具</p>
                <h3>从现有灯具中勾选关联</h3>
              </div>
              <button className="fixture-selector-close" onClick={handleCloseSelector} aria-label="关闭">
                ✕
              </button>
            </div>

            <div className="fixture-selector-toolbar">
              <div className="fixture-selector-filters">
                <div className="fixture-selector-filter-label">灯区：</div>
                <div className="fixture-selector-chips">
                  <button
                    className={!selectorTypeFilter ? "chip active" : "chip"}
                    onClick={() => setSelectorTypeFilter(null)}
                  >
                    全部
                  </button>
                  {ALL_TYPES.map((t) => (
                    <button
                      key={t}
                      className={selectorTypeFilter === t ? "chip active" : "chip"}
                      style={
                        selectorTypeFilter === t
                          ? { background: LIGHT_TYPE_COLORS[t], borderColor: LIGHT_TYPE_COLORS[t], color: "#fff" }
                          : {}
                      }
                      onClick={() => setSelectorTypeFilter(selectorTypeFilter === t ? null : t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                className="fixture-selector-search"
                placeholder="搜索灯具编号或通道号..."
                value={selectorSearch}
                onChange={(e) => setSelectorSearch(e.target.value)}
              />
            </div>

            <div className="fixture-selector-actions-bar">
              <span className="fixture-selector-count">
                已选 {selectorSelectedIds.size} / {fixtures.length} 台
              </span>
              <div className="fixture-selector-batch-actions">
                <button
                  type="button"
                  className="fixture-selector-batch-btn"
                  onClick={handleSelectorSelectAll}
                >
                  {selectorFilteredFixtures.length > 0 &&
                  selectorFilteredFixtures.every((f) => selectorSelectedIds.has(f.id))
                    ? "取消筛选内全选"
                    : "筛选内全选"}
                </button>
                {!selectorTypeFilter && ALL_TYPES.map((t) => {
                  const typeFixtures = fixtures.filter((f) => f.type === t);
                  const allSelected = typeFixtures.every((f) => selectorSelectedIds.has(f.id));
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`fixture-selector-batch-btn${allSelected ? " fixture-selector-batch-btn-active" : ""}`}
                      onClick={() => handleSelectorSelectType(t)}
                    >
                      {allSelected ? `取消${t}` : `全选${t}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="fixture-selector-list">
              {selectorFilteredFixtures.length === 0 ? (
                <div className="fixture-selector-empty">
                  未找到匹配的灯具
                </div>
              ) : (
                ALL_TYPES.map((type) => {
                  const group = selectorGroupedFixtures[type];
                  if (group.length === 0) return null;
                  const typeColor = LIGHT_TYPE_COLORS[type];
                  return (
                    <div key={type} className="fixture-selector-group">
                      <div className="fixture-selector-group-header">
                        <span className="fixture-selector-group-dot" style={{ background: typeColor }} />
                        <span className="fixture-selector-group-label">{type}</span>
                        <span className="fixture-selector-group-count">
                          {group.filter((f) => selectorSelectedIds.has(f.id)).length}/{group.length}
                        </span>
                      </div>
                      <div className="fixture-selector-items">
                        {group.map((f) => {
                          const isChecked = selectorSelectedIds.has(f.id);
                          return (
                            <label
                              key={f.id}
                              className={`fixture-selector-item${isChecked ? " fixture-selector-item-checked" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSelectorFixture(f.id)}
                              />
                              <div className="fixture-selector-item-info">
                                <div className="fixture-selector-item-main">
                                  <strong className="fixture-selector-item-number">{f.number}</strong>
                                  <span className="fixture-selector-item-channel">{f.channel}</span>
                                  <span
                                    className="fixture-selector-item-brightness"
                                    style={{ color: f.brightness === 0 ? "#94a3b8" : typeColor }}
                                  >
                                    {f.brightness}%
                                  </span>
                                </div>
                                {f.notes && (
                                  <div className="fixture-selector-item-note">{f.notes}</div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="fixture-selector-footer">
              <button className="btn-secondary" onClick={handleCloseSelector}>
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmSelector}
                disabled={selectorSelectedIds.size === 0}
              >
                确认选择（{selectorSelectedIds.size}）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
