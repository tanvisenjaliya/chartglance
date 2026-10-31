"use client";

import { PatientQueueItem } from "@/lib/queue-utils";

export type FilterType =
  | "all"
  | "emergency"
  | "infants-seniors"
  | "infants"
  | "seniors"
  | "male"
  | "female"
  | "other-gender";

interface KpiBarProps {
  patients: PatientQueueItem[];
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export function isInfant(age: string | number): boolean {
  if (typeof age === "number") return age < 1;
  const str = String(age).toLowerCase().trim();
  if (
    str.includes("m") ||
    str.includes("mo") ||
    str.includes("month") ||
    str.includes("d") ||
    str.includes("day")
  ) {
    return true;
  }
  const parsed = parseFloat(str);
  return !isNaN(parsed) && parsed < 1;
}

export function isSenior(age: string | number): boolean {
  if (typeof age === "number") return age >= 60;
  const str = String(age).toLowerCase().trim();
  if (
    str.includes("m") ||
    str.includes("mo") ||
    str.includes("month") ||
    str.includes("d") ||
    str.includes("day")
  ) {
    return false;
  }
  const parsed = parseFloat(str);
  return !isNaN(parsed) && parsed >= 60;
}

export default function KpiBar({
  patients,
  activeFilter,
  onFilterChange,
}: KpiBarProps) {
  const total = patients.length;

  const waitingCount = patients.filter((p) => p.queueStatus === "Waiting").length;
  const inConsultCount = patients.filter(
    (p) => p.queueStatus === "In consultation"
  ).length;
  const doneCount = patients.filter((p) => p.queueStatus === "Done").length;

  // Gender counts
  const mCount = patients.filter(
    (p) => p.gender === "Male" || p.gender === "M"
  ).length;
  const fCount = patients.filter(
    (p) => p.gender === "Female" || p.gender === "F"
  ).length;
  const oCount = patients.filter(
    (p) => p.gender === "Other" || p.gender === "O"
  ).length;

  // Infants (< 1 yr) & Seniors (>= 60 yrs)
  const infantCount = patients.filter((p) => isInfant(p.age)).length;
  const seniorCount = patients.filter((p) => isSenior(p.age)).length;

  // Emergency cases
  const emergencyCount = patients.filter(
    (p) =>
      Boolean(p.isEmergency) ||
      p.visitType === "Emergency" ||
      (p.tokenNumber && p.tokenNumber.startsWith("E"))
  ).length;

  const isTotalFilter = activeFilter === "all";
  const isGenderFilter =
    activeFilter === "male" ||
    activeFilter === "female" ||
    activeFilter === "other-gender";
  const isAgeFilter =
    activeFilter === "infants-seniors" ||
    activeFilter === "infants" ||
    activeFilter === "seniors";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Today */}
        <button
          type="button"
          onClick={() => onFilterChange("all")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            isTotalFilter
              ? "bg-surface border-blue shadow-sm ring-2 ring-blue/20"
              : "bg-surface border-border hover:border-slate/50 hover:bg-panel/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-slate">
              TOTAL TODAY
            </span>
            <span className="w-2 h-2 rounded-full bg-blue" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-navy">{total}</span>
            <span className="text-xs text-navy-muted">patients</span>
          </div>
          <div className="mt-1.5 text-xs text-navy-muted font-mono">
            {waitingCount} waiting &bull; {inConsultCount} in consult &bull; {doneCount} done
          </div>
          <span className="mt-1 text-[11px] text-blue block">
            {isTotalFilter ? "Showing all" : "Click to show all"}
          </span>
        </button>

        {/* Card 2: M : F Ratio */}
        <button
          type="button"
          onClick={() => {
            if (activeFilter === "male") onFilterChange("female");
            else if (activeFilter === "female") onFilterChange("all");
            else onFilterChange("male");
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            isGenderFilter
              ? "bg-surface border-blue shadow-sm ring-2 ring-blue/20"
              : "bg-surface border-border hover:border-slate/50 hover:bg-panel/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-slate">
              M : F RATIO
            </span>
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-2xl font-bold text-navy">
              {mCount}M : {fCount}F
            </span>
            {oCount > 0 && (
              <span className="text-xs font-semibold text-slate bg-panel px-1.5 py-0.5 rounded border border-border">
                + {oCount} Other
              </span>
            )}
          </div>
          <div className="mt-1.5 text-xs text-navy-muted">
            {mCount} male &bull; {fCount} female
          </div>
          <span className="mt-1 text-[11px] text-blue block">
            {activeFilter === "male"
              ? "Filtered: Males (click for Females)"
              : activeFilter === "female"
              ? "Filtered: Females (click to clear)"
              : "Click to filter by sex"}
          </span>
        </button>

        {/* Card 3: Infants & Seniors */}
        <button
          type="button"
          onClick={() =>
            onFilterChange(
              activeFilter === "infants-seniors" ? "all" : "infants-seniors"
            )
          }
          className={`p-4 rounded-2xl border text-left transition-all ${
            isAgeFilter
              ? "bg-surface border-blue shadow-sm ring-2 ring-blue/20"
              : "bg-surface border-border hover:border-slate/50 hover:bg-panel/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-slate">
              INFANTS &amp; SENIORS
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-navy">
              {infantCount} infants &bull; {seniorCount} seniors
            </span>
          </div>
          <div className="mt-1.5 text-xs text-navy-muted">
            &lt; 1 yr &amp; &ge; 60 yrs priority groups
          </div>
          <span className="mt-1 text-[11px] text-blue block">
            {isAgeFilter ? "Filter active (click to reset)" : "Click to filter priority age"}
          </span>
        </button>

        {/* Card 4: Emergency Cases */}
        <button
          type="button"
          onClick={() =>
            onFilterChange(activeFilter === "emergency" ? "all" : "emergency")
          }
          className={`p-4 rounded-2xl border text-left transition-all ${
            emergencyCount > 0
              ? activeFilter === "emergency"
                ? "bg-red-50 border-red-500 shadow-sm ring-2 ring-red-400"
                : "bg-red-50/70 border-red-300 hover:bg-red-50 hover:border-red-500"
              : activeFilter === "emergency"
              ? "bg-surface border-blue shadow-sm ring-2 ring-blue/20"
              : "bg-surface border-border hover:border-slate/50 hover:bg-panel/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`font-mono text-xs uppercase tracking-wider font-semibold ${
                emergencyCount > 0 ? "text-red-700" : "text-slate"
              }`}
            >
              EMERGENCY CASES
            </span>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                emergencyCount > 0 ? "bg-red-600 animate-pulse" : "bg-slate/40"
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-3xl font-bold ${
                emergencyCount > 0 ? "text-red-600" : "text-navy"
              }`}
            >
              {emergencyCount}
            </span>
            <span
              className={`text-xs font-semibold ${
                emergencyCount > 0 ? "text-red-700" : "text-navy-muted"
              }`}
            >
              {emergencyCount === 1 ? "emergency" : "emergencies"}
            </span>
          </div>
          <div
            className={`mt-1.5 text-xs ${
              emergencyCount > 0 ? "text-red-800" : "text-navy-muted"
            }`}
          >
            {emergencyCount > 0 ? "Immediate clinical priority" : "None admitted today"}
          </div>
          <span
            className={`mt-1 text-[11px] block ${
              emergencyCount > 0 ? "text-red-700 font-semibold" : "text-blue"
            }`}
          >
            {activeFilter === "emergency"
              ? "Filter active (click to reset)"
              : "Click to filter emergency cases"}
          </span>
        </button>
      </div>

      {/* Filter Active pill if filtered */}
      {activeFilter !== "all" && (
        <div className="flex items-center justify-between bg-blue/10 border border-blue/20 rounded-xl px-4 py-2 text-xs">
          <div className="flex items-center gap-2 text-blue font-semibold">
            <span className="w-2 h-2 rounded-full bg-blue" />
            <span>
              Queue filtered by:{" "}
              <strong className="uppercase font-mono">
                {activeFilter === "emergency"
                  ? "Emergency Cases"
                  : activeFilter === "infants-seniors"
                  ? "Infants & Seniors"
                  : activeFilter === "male"
                  ? "Male Patients"
                  : activeFilter === "female"
                  ? "Female Patients"
                  : activeFilter}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onFilterChange("all")}
            className="text-xs text-blue hover:text-navy font-semibold hover:underline"
          >
            Clear filter (show all {total} patients)
          </button>
        </div>
      )}
    </div>
  );
}
