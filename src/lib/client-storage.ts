import { PatientQueueItem } from "./queue-utils";
import { ConsentRecord } from "./abdm-mock";
import { ConsultationNote, FollowUpPeriod } from "./notes-store";
import type { AIAnalysisResult } from "./ai/gemini-analysis";

export const DAILY_ANALYSIS_LIMIT = 20;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getTodayKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Generic safe localStorage wrapper
// ---------------------------------------------------------------------------

function safeGetItem(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    console.warn(`[ClientStorage] getItem failed for "${key}":`, err);
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`[ClientStorage] setItem failed for "${key}":`, err);
  }
}

export function safeRemoveItem(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[ClientStorage] removeItem failed for "${key}":`, err);
  }
}

// ---------------------------------------------------------------------------
// 1. Queue Storage (keyed by date)
// ---------------------------------------------------------------------------

export function getStoredQueue(dateStr = getTodayKey()): PatientQueueItem[] | null {
  const raw = safeGetItem(`chartglance_queue_${dateStr}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PatientQueueItem[];
  } catch {
    return null;
  }
}

export function saveStoredQueue(queue: PatientQueueItem[], dateStr = getTodayKey()): void {
  safeSetItem(`chartglance_queue_${dateStr}`, JSON.stringify(queue));
}

// ---------------------------------------------------------------------------
// 2. Consents Storage
// ---------------------------------------------------------------------------

export function getStoredConsents(): Record<string, ConsentRecord> {
  const raw = safeGetItem("chartglance_consents");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, ConsentRecord>;
  } catch {
    return {};
  }
}

export function getStoredConsent(patientId: string): ConsentRecord | null {
  const map = getStoredConsents();
  return map[patientId] || null;
}

export function saveStoredConsent(patientId: string, consent: ConsentRecord): void {
  const map = getStoredConsents();
  map[patientId] = consent;
  safeSetItem("chartglance_consents", JSON.stringify(map));
}

// ---------------------------------------------------------------------------
// 3. Consultation Notes & Drafts
// ---------------------------------------------------------------------------

export function getStoredNotes(patientId?: string): ConsultationNote[] {
  const raw = safeGetItem("chartglance_notes");
  let all: ConsultationNote[] = [];
  if (raw) {
    try {
      all = JSON.parse(raw) as ConsultationNote[];
    } catch {
      all = [];
    }
  }
  if (patientId) {
    return all.filter((n) => n.patientId === patientId);
  }
  return all;
}

export function saveStoredNote(note: ConsultationNote): void {
  const existing = getStoredNotes();
  const index = existing.findIndex((n) => n.id === note.id);
  if (index >= 0) {
    existing[index] = note;
  } else {
    existing.unshift(note);
  }
  safeSetItem("chartglance_notes", JSON.stringify(existing));
}

export interface StoredDraft {
  text: string;
  followUp: FollowUpPeriod;
  savedAt?: string;
}

export function getStoredDraft(patientId: string): StoredDraft | null {
  const raw = safeGetItem("chartglance_drafts");
  if (!raw) return null;
  try {
    const drafts = JSON.parse(raw) as Record<string, StoredDraft>;
    return drafts[patientId] || null;
  } catch {
    return null;
  }
}

export function saveStoredDraft(patientId: string, draft: StoredDraft): void {
  const raw = safeGetItem("chartglance_drafts");
  let drafts: Record<string, StoredDraft> = {};
  if (raw) {
    try {
      drafts = JSON.parse(raw);
    } catch {
      drafts = {};
    }
  }
  drafts[patientId] = draft;
  safeSetItem("chartglance_drafts", JSON.stringify(drafts));
}

export function clearStoredDraft(patientId: string): void {
  const raw = safeGetItem("chartglance_drafts");
  if (!raw) return;
  try {
    const drafts = JSON.parse(raw) as Record<string, StoredDraft>;
    delete drafts[patientId];
    safeSetItem("chartglance_drafts", JSON.stringify(drafts));
  } catch {
    // Ignore
  }
}

// ---------------------------------------------------------------------------
// 4. AI Analysis Cache & Daily Quota Limit (20 analyses/day)
// ---------------------------------------------------------------------------

export function getStoredAnalysis(
  patientId: string,
  dateStr = getTodayKey()
): AIAnalysisResult | null {
  const raw = safeGetItem(`chartglance_ai_cache_${dateStr}_${patientId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AIAnalysisResult;
  } catch {
    return null;
  }
}

export function saveStoredAnalysis(
  patientId: string,
  analysis: AIAnalysisResult,
  dateStr = getTodayKey()
): void {
  safeSetItem(`chartglance_ai_cache_${dateStr}_${patientId}`, JSON.stringify(analysis));
}

export function getDailyAnalysisCount(dateStr = getTodayKey()): number {
  const raw = safeGetItem(`chartglance_ai_quota_${dateStr}`);
  if (!raw) return 0;
  const num = parseInt(raw, 10);
  return Number.isFinite(num) ? num : 0;
}

export function incrementDailyAnalysisCount(dateStr = getTodayKey()): number {
  const current = getDailyAnalysisCount(dateStr);
  const next = current + 1;
  safeSetItem(`chartglance_ai_quota_${dateStr}`, String(next));
  return next;
}

export function isDailyQuotaExceeded(dateStr = getTodayKey()): boolean {
  return getDailyAnalysisCount(dateStr) >= DAILY_ANALYSIS_LIMIT;
}

// ---------------------------------------------------------------------------
// 5. Reset Demo (Clears all chartglance_* state)
// ---------------------------------------------------------------------------

export function resetDemoStorage(): void {
  if (!isBrowser()) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("chartglance_")) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn("[ClientStorage] Failed to clear demo storage:", err);
  }
}
