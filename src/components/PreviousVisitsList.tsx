"use client";

import { useState } from "react";
import { ConsultationNote } from "@/lib/notes-store";

interface PreviousVisitsListProps {
  notes: ConsultationNote[];
  onAddendumAdded?: () => void;
}

export default function PreviousVisitsList({
  notes,
  onAddendumAdded,
}: PreviousVisitsListProps) {
  const [activeAddendumNoteId, setActiveAddendumNoteId] = useState<string | null>(null);
  const [addendumText, setAddendumText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleOpenAddendum = (noteId: string) => {
    setActiveAddendumNoteId(noteId);
    setAddendumText("");
  };

  const handleCancelAddendum = () => {
    setActiveAddendumNoteId(null);
    setAddendumText("");
  };

  const handleSubmitAddendum = async (noteId: string) => {
    if (!addendumText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/notes/${noteId}/addendum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: addendumText.trim() }),
      });
      if (res.ok) {
        setActiveAddendumNoteId(null);
        setAddendumText("");
        if (onAddendumAdded) onAddendumAdded();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden space-y-0">
      {/* Section Header */}
      <div className="px-6 py-4 border-b border-border bg-panel/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold text-blue">
              LOCAL FACILITY RECORDS
            </span>
            <span className="text-slate text-xs">&bull;</span>
            <span className="text-xs text-navy-muted">
              Direct facility history &bull; No ABDM consent required
            </span>
          </div>
          <h3 className="text-lg font-bold text-navy mt-0.5">
            Previous Visits at this PHC
          </h3>
        </div>

        <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-border bg-surface text-slate self-start sm:self-center">
          {notes.length} Recorded Visit{notes.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Note Rows */}
      {notes.length === 0 ? (
        <div className="p-8 text-center">
          <div className="max-w-md mx-auto p-6 rounded-2xl border border-dashed border-border-dashed bg-panel/20">
            <span className="w-8 h-8 rounded-full bg-panel text-slate flex items-center justify-center font-bold text-sm mx-auto mb-2">
              i
            </span>
            <p className="text-sm font-semibold text-navy">
              No previous recorded visits
            </p>
            <p className="text-xs text-navy-muted mt-1 leading-relaxed">
              No prior consultation notes have been recorded for this patient at this facility yet. Local notes saved here will remain permanently visible without needing ABDM consent.
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {notes.map((note) => (
            <div key={note.id} className="p-6 space-y-4 hover:bg-panel/10 transition-colors">
              {/* Note Metadata Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue/10 border border-blue/30 text-blue flex items-center justify-center font-mono font-bold text-xs shrink-0">
                    OPD
                  </div>
                  <div>
                    <p className="text-sm font-bold text-navy">
                      {note.doctorName}
                    </p>
                    <p className="text-[11px] text-navy-muted">
                      {note.facilityName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-5 text-xs text-navy-muted sm:text-right shrink-0">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-slate block">
                      VISIT DATE &amp; TIME
                    </span>
                    <span className="font-medium text-navy">
                      {note.date} &bull; {note.time}
                    </span>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-slate block">
                      FOLLOW-UP
                    </span>
                    <span
                      className={`font-semibold ${
                        note.followUp !== "none" ? "text-amber-800" : "text-slate"
                      }`}
                    >
                      {note.followUp === "none"
                        ? "None scheduled"
                        : `In ${note.followUp}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Saved Note Text (Read-Only) */}
              <div className="p-4 rounded-xl bg-panel/40 border border-border/80 text-xs">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate block mb-1">
                  CONSULTATION NOTE (READ-ONLY)
                </span>
                <p className="text-navy font-normal whitespace-pre-wrap leading-relaxed text-sm">
                  {note.noteText}
                </p>
              </div>

              {/* Addendums List */}
              {note.addendums && note.addendums.length > 0 && (
                <div className="space-y-2.5 pt-1 pl-4 border-l-2 border-blue/40">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-blue font-bold block">
                    RECORD ADDENDUMS ({note.addendums.length})
                  </span>
                  {note.addendums.map((addendum) => (
                    <div
                      key={addendum.id}
                      className="p-3.5 rounded-xl border border-border bg-surface text-xs space-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                        <span className="font-mono font-semibold text-navy">
                          {addendum.doctorName} &bull; {addendum.facilityName}
                        </span>
                        <span className="font-mono text-slate">
                          {new Date(addendum.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          {new Date(addendum.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </span>
                      </div>
                      <p className="text-navy-muted leading-relaxed whitespace-pre-wrap pt-1">
                        {addendum.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Addendum Box / Trigger */}
              <div className="pt-2">
                {activeAddendumNoteId === note.id ? (
                  <div className="p-4 rounded-xl border border-blue/30 bg-panel/50 space-y-3">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-blue block">
                        ADD DATED ADDENDUM
                      </span>
                      <p className="text-[11px] text-navy-muted mt-0.5">
                        Append a dated clinical correction or follow-up note without modifying the original.
                      </p>
                    </div>

                    <textarea
                      rows={2}
                      value={addendumText}
                      onChange={(e) => setAddendumText(e.target.value)}
                      placeholder="Enter addendum text or correction…"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-navy text-xs placeholder:text-slate/60 focus:outline-none focus:ring-2 focus:ring-blue/40 focus:border-blue"
                    />

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleCancelAddendum}
                        disabled={submitting}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs font-mono uppercase tracking-wider text-slate hover:bg-surface transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSubmitAddendum(note.id)}
                        disabled={submitting || !addendumText.trim()}
                        className="px-4 py-1.5 rounded-lg bg-blue hover:bg-blue/90 text-white text-xs font-mono uppercase tracking-wider font-semibold transition-colors disabled:opacity-50"
                      >
                        {submitting ? "Saving Addendum…" : "Save Addendum"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenAddendum(note.id)}
                    className="text-xs font-mono text-blue hover:underline uppercase tracking-wider flex items-center gap-1 font-semibold"
                  >
                    <span>+ Add Addendum</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

