import { useState, useEffect } from "react";
import { type VersionNote } from "../data/versionNotes";

interface Props {
  open: boolean;
  note: VersionNote | null;
  onClose: () => void;
  onSave: (note: VersionNote) => void;
}

interface FormErrors {
  versionName?: string;
  relatedCues?: string;
  adjustmentReason?: string;
}

const EMPTY_NOTE: VersionNote = {
  id: "",
  versionName: "",
  relatedCues: "",
  adjustmentReason: "",
  pendingItems: "",
  confirmed: false,
  updatedAt: "",
};

function formatNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function VersionNoteEditDrawer({ open, note, onClose, onSave }: Props) {
  const isEditing = !!note;
  const [form, setForm] = useState<VersionNote>(EMPTY_NOTE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      if (note) {
        setForm({ ...note });
      } else {
        setForm({ ...EMPTY_NOTE, id: `note-${Date.now()}`, updatedAt: formatNow() });
      }
      setErrors({});
      setTouched({});
    }
  }, [open, note]);

  const validateField = (name: keyof VersionNote, value: string): string | undefined => {
    const requiredFields: (keyof VersionNote)[] = ["versionName", "relatedCues", "adjustmentReason"];

    if (requiredFields.includes(name) && !value.trim()) {
      return "此项为必填";
    }

    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const fieldsToValidate: (keyof VersionNote)[] = ["versionName", "relatedCues", "adjustmentReason"];

    fieldsToValidate.forEach((field) => {
      const error = validateField(field, form[field] as string);
      if (error) {
        newErrors[field as keyof FormErrors] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof VersionNote, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));

    if (typeof value === "string" && touched[field]) {
      const error = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  };

  const handleBlur = (field: keyof VersionNote) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, form[field] as string);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleSave = () => {
    const allTouched: Record<string, boolean> = {};
    ["versionName", "relatedCues", "adjustmentReason"].forEach((f) => {
      allTouched[f] = true;
    });
    setTouched(allTouched);

    if (validateForm()) {
      onSave({ ...form, updatedAt: formatNow() });
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
            <p className="drawer-label">版本备注</p>
            <h2>{isEditing ? "修改备注" : "新增备注"}</h2>
          </div>
          <button className="drawer-close" onClick={handleCancel} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          <div className="form-group">
            <label>
              <span>
                版本名 <em className="required">*</em>
              </span>
              <input
                type="text"
                value={form.versionName}
                onChange={(e) => handleChange("versionName", e.target.value)}
                onBlur={() => handleBlur("versionName")}
                placeholder="例如：版本A - 首演版"
                className={errors.versionName ? "input-error" : ""}
              />
              {errors.versionName && touched.versionName && (
                <span className="error-text">{errors.versionName}</span>
              )}
            </label>
          </div>

          <div className="form-group">
            <label>
              <span>
                关联Cue <em className="required">*</em>
              </span>
              <input
                type="text"
                value={form.relatedCues}
                onChange={(e) => handleChange("relatedCues", e.target.value)}
                onBlur={() => handleBlur("relatedCues")}
                placeholder="例如：Cue 12, Cue 18"
                className={errors.relatedCues ? "input-error" : ""}
              />
              {errors.relatedCues && touched.relatedCues && (
                <span className="error-text">{errors.relatedCues}</span>
              )}
            </label>
          </div>

          <div className="form-group">
            <label>
              <span>
                调整原因 <em className="required">*</em>
              </span>
              <textarea
                value={form.adjustmentReason}
                onChange={(e) => handleChange("adjustmentReason", e.target.value)}
                onBlur={() => handleBlur("adjustmentReason")}
                placeholder="请详细描述灯光调整的原因和内容"
                rows={4}
                className={errors.adjustmentReason ? "input-error" : ""}
              />
              {errors.adjustmentReason && touched.adjustmentReason && (
                <span className="error-text">{errors.adjustmentReason}</span>
              )}
            </label>
          </div>

          <div className="form-group">
            <label>
              <span>待确认事项</span>
              <textarea
                value={form.pendingItems}
                onChange={(e) => handleChange("pendingItems", e.target.value)}
                placeholder="需要后续跟进确认的事项，选填"
                rows={3}
              />
            </label>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.confirmed}
                onChange={(e) => handleChange("confirmed", e.target.checked)}
              />
              <span>标记为已确认</span>
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
