"use client";

import { PatientQueueItem } from "@/lib/records";

export type FilterType =
  | "all"
  | "male"
  | "female"
  | "vulnerable"
  | "abha_linked"
  | "abha_unlinked"
  | "follow_up"
  | "new_visit"
  | "emergency";

interface KpiBarProps {
  patients: PatientQueueItem[];
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export default function KpiBar({
  patients,
  activeFilter,
  onFilterChange,
}: KpiBarProps) {
  // Purely computed metrics from live queue data
  const total = patients.length;
  const maleCount = patients.filter((p) => p.gender === "Male").length;
  const femaleCount = patients.filter((p) => p.gender === "Female").length;
  const otherGenderCount = patients.filter(
    (p) => p.gender !== "Male" && p.gender !== "Female"
  ).length;

  const childCount = patients.filter((p) => p.age < 18).length;
  const seniorCount = patients.filter((p) => p.age >= 60).length;
  const vulnerableCount = childCount + seniorCount;

  const abhaLinkedCount = patients.filter(
    (p) => p.abhaStatus === "LINKED"
  ).length;
  const abhaUnlinkedCount = patients.filter(
    (p) => p.abhaStatus === "UNLINKED" || !p.abhaStatus
  ).length;

  const followUpCount = patients.filter((p) => p.visitType === "Follow-up").length;
  const newVisitCount = patients.filter((p) => p.visitType === "New Visit").length;
  const emergencyCount = patients.filter((p) => p.isEmergency).length;

  return (
    <div className="space-y-4">
      {/* 4 Interactive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Total Patients in Queue */}
        <button
          type="button"
          onClick={() => onFilterChange("all")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === "all"
              ? "bg-surface border-blue shadow-md ring-2 ring-blue/20"
              : "bg-surface border-border hover:border-slate/50 hover:bg-panel/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold text-slate uppercase tracking-wider">
              TOTAL IN QUEUE
            </span>
            <span className="w-2 h-2 rounded-full bg-blue" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-navy">
              {total}
            </span>
            <span className="text-xs text-navy-muted">Patients</span>
          </div>
          <span className="mt-1 text-[11px] text-blue font-mono block">
            {activeFilter === "all" ? "✓ Viewing all" : "Click to view all"}
          </span>
        </button>

        {/* KPI 2: Male : Female Ratio */}
        <button
          type="button"
          onClick={() => {
            if (activeFilter === "male") onFilterChange("female");
            else if (activeFilter === "female") onFilterChange("all");
            else onFilterChange("male");
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === "male" || activeFilter === "female"
              ? "bg-surface border-blue shadow-md ring-2 ring-blue/20"
              : "bg-surface border-border hover:border-slate/50 hover:bg-panel/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold text-slate uppercase tracking-wider">
              SEX RATIO (M : F)
            </span>
            <span className="font-mono text-[10px] text-navy-muted px-1.5 py-0.5 rounded bg-panel">
              {maleCount}M : {femaleCount}F
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-navy">
              {maleCount}:{femaleCount}
            </span>
            {otherGenderCount > 0 && (
              <span className="text-xs text-slate font-mono">
                (+{otherGenderCount} other)
              </span>
            )}
          </div>
          <span className="mt-1 text-[11px] text-blue font-mono block">
            {activeFilter === "male"
              ? "✓ Showing Male (click for F)"
              : activeFilter === "female"
              ? "✓ Showing Female (click to reset)"
              : "Click to filter gender"}
          </span>
        </button>

        {/* KPI 3: Vulnerable Groups (Child / Senior) */}
        <button
          type="button"
          onClick={() =>
            onFilterChange(activeFilter === "vulnerable" ? "all" : "vulnerable")
          }
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === "vulnerable"
              ? "bg-surface border-blue shadow-md ring-2 ring-blue/20"
              : "bg-surface border-border hover:border-slate/50 hover:bg-panel/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold text-slate uppercase tracking-wider">
              CHILD &amp; SENIOR
            </span>
            <span className="font-mono text-[10px] text-navy-muted px-1.5 py-0.5 rounded bg-panel">
              Age &lt;18 / &ge;60
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-navy">
              {vulnerableCount}
            </span>
            <span className="text-xs text-navy-muted">
              ({seniorCount} sr, {childCount} ch)
            </span>
          </div>
          <span className="mt-1 text-[11px] text-blue font-mono block">
            {activeFilter === "vulnerable"
              ? "✓ Filter active"
              : "Click to filter vulnerable"}
          </span>
        </button>

        {/* KPI 4: ABHA Registration Status */}
        <button
          type="button"
          onClick={() => {
            if (activeFilter === "abha_linked") onFilterChange("abha_unlinked");
            else if (activeFilter === "abha_unlinked") onFilterChange("all");
            else onFilterChange("abha_linked");
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === "abha_linked" || activeFilter === "abha_unlinked"
              ? "bg-surface border-blue shadow-md ring-2 ring-blue/20"
              : "bg-surface border-border hover:border-slate/50 hover:bg-panel/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold text-slate uppercase tracking-wider">
              ABHA STATUS
            </span>
            <span className="font-mono text-[10px] text-navy-muted px-1.5 py-0.5 rounded bg-panel">
              {abhaLinkedCount}L / {abhaUnlinkedCount}U
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-navy">
              {abhaLinkedCount}
            </span>
            <span className="text-xs text-navy-muted">
              Linked · {abhaUnlinkedCount} Unlinked
            </span>
          </div>
          <span className="mt-1 text-[11px] text-blue font-mono block">
            {activeFilter === "abha_linked"
              ? "✓ Showing Linked (click for Unlinked)"
              : activeFilter === "abha_unlinked"
              ? "✓ Showing Unlinked (click to reset)"
              : "Click to filter ABHA status"}
          </span>
        </button>
      </div>

      {/* Clinical Consultation Triage / Summary Strip */}
      <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-slate font-semibold mr-1">
            CONSULTATION NATURE:
          </span>

          {/* Follow-up button */}
          <button
            type="button"
            onClick={() =>
              onFilterChange(activeFilter === "follow_up" ? "all" : "follow_up")
            }
            className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-colors flex items-center gap-1.5 ${
              activeFilter === "follow_up"
                ? "bg-blue text-surface border-blue shadow-sm"
                : "bg-panel hover:bg-border/60 text-navy border-border"
            }`}
          >
            <span>Follow-up Reviews</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeFilter === "follow_up"
                  ? "bg-surface/20 text-surface"
                  : "bg-surface text-navy font-bold"
              }`}
            >
              {followUpCount}
            </span>
          </button>

          {/* New visit button */}
          <button
            type="button"
            onClick={() =>
              onFilterChange(activeFilter === "new_visit" ? "all" : "new_visit")
            }
            className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-colors flex items-center gap-1.5 ${
              activeFilter === "new_visit"
                ? "bg-blue text-surface border-blue shadow-sm"
                : "bg-panel hover:bg-border/60 text-navy border-border"
            }`}
          >
            <span>New Consultations</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeFilter === "new_visit"
                  ? "bg-surface/20 text-surface"
                  : "bg-surface text-navy font-bold"
              }`}
            >
              {newVisitCount}
            </span>
          </button>

          {/* Emergency filter button (if present) */}
          {emergencyCount > 0 && (
            <button
              type="button"
              onClick={() =>
                onFilterChange(
                  activeFilter === "emergency" ? "all" : "emergency"
                )
              }
              className={`px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-colors flex items-center gap-1.5 ${
                activeFilter === "emergency"
                  ? "bg-brand-red text-surface border-brand-red shadow-sm"
                  : "bg-severity-critical-bg text-severity-critical-label border-severity-critical-border"
              }`}
            >
              <span>Urgent Triage</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-brand-red text-white">
                {emergencyCount}
              </span>
            </button>
          )}
        </div>

        {/* Filter Reset Indicator */}
        {activeFilter !== "all" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-navy-muted font-mono">
              Filtered:{" "}
              <strong className="text-navy uppercase">
                {activeFilter.replace("_", " ")}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => onFilterChange("all")}
              className="text-xs font-mono text-blue hover:underline font-semibold"
            >
              Clear Filter ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
