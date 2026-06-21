import { useState, useEffect, useMemo } from "react";
import { type Cue, EMPTY_CUE, parseCueFixtures, parseCueBrightness, hasBrightnessField, getCueFixtureDiffs, syncCueBrightnessFromFixtures } from "../data/cues";
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
              <input
                type="text"
                value={form.fixtures}
                onChange={(e) => handleChange("fixtures", e.target.value)}
                onBlur={() => handleBlur("fixtures")}
                placeholder="例如：CH 021-028"
                className={errors.fixtures ? "input-error" : ""}
              />
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
    </div>
  );
}
