import { type LightFixture } from "../data/fixtures";
import { type Cue } from "../data/cues";
import { type VersionNote } from "../data/versionNotes";

const DRAFT_KEY = "hxyfront-62002-draft";
const DRAFT_META_KEY = "hxyfront-62002-draft-meta";
const DRAFT_VERSION = 1;

export interface DraftData {
  fixtures: LightFixture[];
  cues: Cue[];
  versionNotes: VersionNote[];
}

export interface DraftMeta {
  version: number;
  savedAt: string;
  snapshotHash: string;
}

function computeHash(data: DraftData): string {
  const payload = JSON.stringify(data);
  let h = 0;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h = ((h << 5) - h + ch) | 0;
  }
  return h.toString(36);
}

function safeJsonParse<T>(text: string | null, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export function saveDraft(data: DraftData): boolean {
  try {
    const meta: DraftMeta = {
      version: DRAFT_VERSION,
      savedAt: new Date().toISOString(),
      snapshotHash: computeHash(data),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    localStorage.setItem(DRAFT_META_KEY, JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

export function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const metaRaw = localStorage.getItem(DRAFT_META_KEY);
    const meta = safeJsonParse<DraftMeta | null>(metaRaw, null);
    if (!meta || meta.version !== DRAFT_VERSION) {
      clearDraft();
      return null;
    }
    return safeJsonParse<DraftData | null>(raw, null);
  } catch {
    return null;
  }
}

export function loadDraftMeta(): DraftMeta | null {
  try {
    const raw = localStorage.getItem(DRAFT_META_KEY);
    return safeJsonParse<DraftMeta | null>(raw, null);
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_META_KEY);
  } catch {}
}

export function draftExists(): boolean {
  try {
    return localStorage.getItem(DRAFT_KEY) !== null;
  } catch {
    return false;
  }
}

export function hasDraftChangedSince(currentData: DraftData): boolean {
  const meta = loadDraftMeta();
  if (!meta) return false;
  return meta.snapshotHash !== computeHash(currentData);
}

export function dataDiffersFromInitial(
  current: DraftData,
  initial: DraftData
): boolean {
  return computeHash(current) !== computeHash(initial);
}

export function exportDraftAsJson(data: DraftData, meta: DraftMeta | null): void {
  const exportObj = {
    exportedAt: new Date().toISOString(),
    draftSavedAt: meta?.savedAt ?? null,
    fixtures: data.fixtures,
    cues: data.cues,
    versionNotes: data.versionNotes,
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.download = `lighting-draft-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { computeHash };
