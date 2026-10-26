"use client";

import { useState, useEffect } from "react";

interface DoctorSidebarProps {
  totalPatients: number;
  emergencyCount: number;
}

export default function DoctorSidebar({ totalPatients, emergencyCount }: DoctorSidebarProps) {
  const [notes, setNotes] = useState<string>("");
  const [savedTime, setSavedTime] = useState<string | null>(null);

  // Load saved notes from localStorage on mount
  useEffect(() => {
    try {
      const savedNotes = localStorage.getItem("chartglance_doctor_notes");
      if (savedNotes !== null) {
        setNotes(savedNotes);
      } else {
        setNotes(
          "• Check HbA1c lab reagents inventory before 12 PM.\n• Ramesh Patel (OPD-01) needs review for rising sugars.\n• ANC camp scheduled for Thursday."
        );
      }
      const savedTimestamp = localStorage.getItem("chartglance_doctor_notes_time");
      if (savedTimestamp) {
        setSavedTime(savedTimestamp);
      }
    } catch {
      // Ignore localStorage availability issues
    }
  }, []);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNotes(value);
    const now = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setSavedTime(now);
    try {
      localStorage.setItem("chartglance_doctor_notes", value);
      localStorage.setItem("chartglance_doctor_notes_time", now);
    } catch {
      // Storage unavailable
    }
  };

  const addQuickTag = (tag: string) => {
    const updated = notes ? `${notes}\n• ${tag}` : `• ${tag}`;
    setNotes(updated);
    const now = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setSavedTime(now);
    try {
      localStorage.setItem("chartglance_doctor_notes", updated);
      localStorage.setItem("chartglance_doctor_notes_time", now);
    } catch {
      // Storage unavailable
    }
  };

  const clearNotes = () => {
    if (confirm("Clear doctor's session notes?")) {
      setNotes("");
      setSavedTime(null);
      try {
        localStorage.removeItem("chartglance_doctor_notes");
        localStorage.removeItem("chartglance_doctor_notes_time");
      } catch {
        // Storage unavailable
      }
    }
  };

  return (
    <aside className="space-y-6">
      {/* Doctor Profile Card */}
      <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-navy text-surface flex items-center justify-center font-bold text-xl shrink-0 shadow-inner">
            AS
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-semibold text-blue bg-panel px-2 py-0.5 rounded border border-border uppercase tracking-wider">
                MEDICAL OFFICER
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h3 className="text-lg font-extrabold text-navy mt-1 tracking-tight truncate">
              Dr. Aditi Sharma
            </h3>
            <p className="text-xs text-navy-muted font-medium">
              MBBS, DNB (Family Medicine)
            </p>
            <p className="text-[11px] text-slate font-mono mt-0.5">
              Reg: MMC / 2021 / 08 / 4512
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-panel border border-border">
            <span className="font-mono text-[10px] uppercase text-slate block tracking-wider">
              FACILITY
            </span>
            <span className="font-semibold text-navy mt-0.5 block truncate">
              PHC Mandavgan
            </span>
            <span className="text-[10px] text-navy-muted">Shirur Block</span>
          </div>

          <div className="p-2.5 rounded-xl bg-panel border border-border">
            <span className="font-mono text-[10px] uppercase text-slate block tracking-wider">
              SESSION
            </span>
            <span className="font-semibold text-navy mt-0.5 block">
              Morning OPD
            </span>
            <span className="text-[10px] text-navy-muted">09:00 - 13:30</span>
          </div>
        </div>

        {/* Live OPD Stats */}
        <div className="mt-3 p-3 rounded-xl bg-navy text-surface flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] uppercase text-slate tracking-wider block">
              ACTIVE QUEUE
            </span>
            <span className="text-lg font-mono font-bold text-surface">
              {totalPatients} Patients
            </span>
          </div>
          {emergencyCount > 0 && (
            <div className="text-right">
              <span className="font-mono text-[10px] uppercase text-brand-red tracking-wider block font-bold">
                EMERGENCY
              </span>
              <span className="text-xs font-mono font-bold text-surface bg-brand-red px-2 py-0.5 rounded-full">
                {emergencyCount} Urgent
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Doctor's Daily OPD Notes / Scratchpad */}
      <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-blue"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <h4 className="text-sm font-bold uppercase tracking-wider font-mono text-navy">
              Doctor&apos;s Daily Notes
            </h4>
          </div>
          {savedTime && (
            <span className="text-[10px] font-mono text-slate">
              Autosaved {savedTime}
            </span>
          )}
        </div>

        <p className="text-xs text-navy-muted mt-2">
          Private session scratchpad for clinical memos, drug stock alerts, and referral tracking.
        </p>

        {/* Quick Tag Pills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            "Lab Reagents Low",
            "NCD Camp Due",
            "108 Ambulance On-Call",
            "Pediatric Syrups Needed",
          ].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addQuickTag(tag)}
              className="text-[10px] font-mono font-medium px-2 py-1 rounded-md bg-panel hover:bg-border/60 text-navy-muted border border-border transition-colors text-left"
            >
              + {tag}
            </button>
          ))}
        </div>

        {/* Text Area */}
        <div className="mt-3">
          <textarea
            value={notes}
            onChange={handleNotesChange}
            rows={7}
            placeholder="Write clinical observations, reminders, or supply notes..."
            className="w-full text-xs font-sans p-3 rounded-xl border border-border bg-panel/30 text-navy placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue transition-all resize-y"
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-slate font-mono">
            {notes.length} characters
          </span>
          {notes && (
            <button
              type="button"
              onClick={clearNotes}
              className="text-slate hover:text-brand-red font-mono transition-colors"
            >
              Clear notes
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
