import { useState, useEffect } from "react";
import { type Cue, EMPTY_CUE } from "../data/cues";

interface Props {
  open: boolean;
  cue: Cue | null;
  allCues: Cue[];
  onClose: () => void;
  onSave: (cue: Cue) => void;
}

interface FormErrors {
  number?: string;
  sceneName?: string;
  fixtures?: string;
  brightnessChange?: string;
}

export function CueEditDrawer({ open, cue, allCues, onClose, onSave }: Props) {
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
