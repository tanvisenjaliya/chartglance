"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FollowUpPeriod } from "@/lib/notes-store";
import {
  getStoredDraft,
  saveStoredDraft,
  clearStoredDraft,
  saveStoredNote,
  getStoredQueue,
  saveStoredQueue,
} from "@/lib/client-storage";

interface ConsultationNoteBoxProps {
  patientId: string;
  onNoteSaved?: () => void;
}

export default function ConsultationNoteBox({
  patientId,
  onNoteSaved,
}: ConsultationNoteBoxProps) {
  const router = useRouter();
  const [noteText, setNoteText] = useState("");
  const [followUp, setFollowUp] = useState<FollowUpPeriod>("none");
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showConfirmEmptyModal, setShowConfirmEmptyModal] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDoneRef = useRef(false);

  // 1. Load initial draft on mount
  useEffect(() => {
    async function loadDraft() {
      const localDraft = getStoredDraft(patientId);
      if (localDraft) {
        setNoteText(localDraft.text || "");
        setFollowUp(localDraft.followUp || "none");
      }
      try {
        const res = await fetch(`/api/notes?patientId=${patientId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.draft && !localDraft) {
            setNoteText(data.draft.noteText || "");
            setFollowUp(data.draft.followUp || "none");
          }
        }
      } catch {
        // Ignore load error
      } finally {
        initialLoadDoneRef.current = true;
      }
    }
    loadDraft();
  }, [patientId]);

  // 2. Debounced Autosave function
  const triggerAutosave = useCallback(
    (text: string, period: FollowUpPeriod) => {
      if (!initialLoadDoneRef.current) return;
      saveStoredDraft(patientId, { text, followUp: period, savedAt: new Date().toISOString() });
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      setAutosaveStatus("saving");
      debounceTimerRef.current = setTimeout(async () => {
        try {
          await fetch("/api/notes/draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patientId,
              noteText: text,
              followUp: period,
            }),
          });
          setAutosaveStatus("saved");
          setTimeout(() => setAutosaveStatus("idle"), 2500);
        } catch {
          setAutosaveStatus("idle");
        }
      }, 2000);
    },
    [patientId]
  );

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = e.target.value;
    setNoteText(nextText);
    triggerAutosave(nextText, followUp);
  };

  const handleFollowUpChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextPeriod = e.target.value as FollowUpPeriod;
    setFollowUp(nextPeriod);
    triggerAutosave(noteText, nextPeriod);
  };

  // 3. Final Save & Mark Done execution
  const executeSaveAndDone = async (allowEmpty: boolean = false) => {
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          noteText: noteText.trim() || (allowEmpty ? "" : ""),
          followUp,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.note) {
          saveStoredNote(data.note);
        }
        clearStoredDraft(patientId);
        const q = getStoredQueue() || [];
        const updatedQ = q.map((p) =>
          p.id === patientId ? { ...p, queueStatus: "Done" as const, completedTimestamp: Date.now() } : p
        );
        saveStoredQueue(updatedQ);
        if (onNoteSaved) onNoteSaved();
        router.push("/");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
      setShowConfirmEmptyModal(false);
    }
  };

  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) {
      setShowConfirmEmptyModal(true);
      return;
    }
    executeSaveAndDone(false);
  };

  return (
    <>
      <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-blue font-semibold">
                ACTIVE CONSULTATION
              </span>
              <span className="text-slate text-xs">&bull;</span>
              <span className="text-xs text-navy-muted">Clinical Record Form</span>
            </div>
            <h3 className="text-lg font-bold text-navy mt-0.5">
              Consultation Note
            </h3>
          </div>

          {/* Autosave status indicator */}
          <div className="text-[11px] font-mono text-slate flex items-center gap-1.5">
            {autosaveStatus === "saving" && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Saving draft…</span>
              </>
            )}
            {autosaveStatus === "saved" && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-700">Draft autosaved</span>
              </>
            )}
            {autosaveStatus === "idle" && (
              <span>Autosaves while typing</span>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveClick} className="space-y-4">
          <div>
            <label
              htmlFor="consultation-note-text"
              className="block font-mono text-[11px] uppercase tracking-wider text-slate mb-1.5"
            >
              Doctor&apos;s Clinical Notes <span className="text-brand-red">*</span>
            </label>
            <textarea
              id="consultation-note-text"
              rows={4}
              value={noteText}
              onChange={handleTextChange}
              placeholder="Record presenting symptoms, clinical findings, diagnosis, and treatment plan…"
              className="w-full px-4 py-3 rounded-xl border border-border bg-panel text-navy text-sm placeholder:text-slate/60 focus:outline-none focus:ring-2 focus:ring-blue/40 focus:border-blue font-sans leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label
                htmlFor="follow-up-period"
                className="block font-mono text-[11px] uppercase tracking-wider text-slate mb-1.5"
              >
                Follow-Up Scheduled
              </label>
              <select
                id="follow-up-period"
                value={followUp}
                onChange={handleFollowUpChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-panel text-navy text-xs font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-blue/40 focus:border-blue"
              >
                <option value="none">None (No scheduled follow-up)</option>
                <option value="1 week">In 1 week</option>
                <option value="2 weeks">In 2 weeks</option>
                <option value="1 month">In 1 month</option>
                <option value="3 months">In 3 months</option>
              </select>
            </div>

            <div className="flex sm:justify-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue hover:bg-blue/90 text-white font-mono text-xs uppercase tracking-wider font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  "Saving Note…"
                ) : (
                  <>
                    <span>Save &amp; Mark Done</span>
                    <span>&rarr;</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Confirmation Modal if Note is Empty */}
      {showConfirmEmptyModal && (
        <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider font-semibold text-brand-red">
                CONFIRMATION
              </span>
              <h4 className="text-base font-bold text-navy mt-1">
                Close visit without a note?
              </h4>
              <p className="text-xs text-navy-muted mt-2 leading-relaxed">
                The consultation notes field is empty. Would you like to mark this visit complete anyway? You can always add an addendum later.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/80">
              <button
                type="button"
                onClick={() => setShowConfirmEmptyModal(false)}
                className="px-4 py-2 rounded-xl border border-border bg-surface text-xs font-mono uppercase tracking-wider text-slate hover:bg-panel transition-colors"
              >
                Cancel &amp; Continue Writing
              </button>
              <button
                type="button"
                onClick={() => executeSaveAndDone(true)}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-brand-red text-white text-xs font-mono uppercase tracking-wider font-semibold hover:bg-brand-red/90 transition-colors shadow-sm"
              >
                {saving ? "Closing…" : "Close Without Note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

