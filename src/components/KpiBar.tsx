"use client";

import { PatientQueueItem } from "@/lib/records";

export type FilterType =
  | "all"
  | "Records available"
  | "ABHA, no records"
  | "No ABHA";

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
  const total = patients.length;
  const recordsAvailableCount = patients.filter(
    (p) => p.dataStatus === "Records available"
  ).length;
  const abhaNoRecordsCount = patients.filter(
    (p) => p.dataStatus === "ABHA, no records"
  ).length;
  const noAbhaCount = patients.filter(
    (p) => p.dataStatus === "No ABHA"
  ).length;

  return (
    <div className="space-y-4">
      {/* KPI & Records Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total in Queue Card */}
        <button
          type="button"
          onClick={() => onFilterChange("all")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === "all"
              ? "bg-surface border-blue shadow-sm ring-1 ring-blue"
              : "bg-surface border-border hover:border-slate/50 hover:bg-panel/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-slate">
              TOTAL IN QUEUE
            </span>
            <span className="w-2 h-2 rounded-full bg-blue" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-navy">
              {total}
            </span>
            <span className="text-xs text-navy-muted">Patients</span>
          </div>
          <span className="mt-1 text-xs text-blue block">
            {activeFilter === "all" ? "Showing all patients" : "Click to view all"}
          </span>
        </button>

        {/* Filter 1: Records Available */}
        <button
          type="button"
          onClick={() =>
            onFilterChange(
              activeFilter === "Records available" ? "all" : "Records available"
            )
          }
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === "Records available"
              ? "bg-surface border-blue shadow-sm ring-1 ring-blue"
              : "bg-surface border-border hover:border-slate/50 hover:bg-panel/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-navy">
              RECORDS AVAILABLE
            </span>
            <span className="w-2 h-2 rounded-full bg-blue" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-navy">
              {recordsAvailableCount}
            </span>
            <span className="text-xs text-navy-muted">Patients</span>
          </div>
          <span className="mt-1 text-xs text-blue block">
            {activeFilter === "Records available"
              ? "Filter active · Click to reset"
              : "Click to filter"}
          </span>
        </button>

        {/* Filter 2: ABHA, no records */}
        <button
          type="button"
          onClick={() =>
            onFilterChange(
              activeFilter === "ABHA, no records" ? "all" : "ABHA, no records"
            )
          }
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === "ABHA, no records"
              ? "bg-surface border-blue shadow-sm ring-1 ring-blue"
              : "bg-surface border-border hover:border-slate/50 hover:bg-panel/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-slate">
              ABHA, NO RECORDS
            </span>
            <span className="w-2 h-2 rounded-full bg-slate" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-navy">
              {abhaNoRecordsCount}
            </span>
            <span className="text-xs text-navy-muted">Patients</span>
          </div>
          <span className="mt-1 text-xs text-blue block">
            {activeFilter === "ABHA, no records"
              ? "Filter active · Click to reset"
              : "Click to filter"}
          </span>
        </button>

        {/* Filter 3: No ABHA */}
        <button
          type="button"
          onClick={() =>
            onFilterChange(
              activeFilter === "No ABHA" ? "all" : "No ABHA"
            )
          }
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === "No ABHA"
              ? "bg-surface border-blue shadow-sm ring-1 ring-blue"
              : "bg-surface border-border hover:border-slate/50 hover:bg-panel/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-slate">
              NO ABHA
            </span>
            <span className="w-2 h-2 rounded-full bg-slate/40" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-navy">
              {noAbhaCount}
            </span>
            <span className="text-xs text-navy-muted">Patients</span>
          </div>
          <span className="mt-1 text-xs text-blue block">
            {activeFilter === "No ABHA"
              ? "Filter active · Click to reset"
              : "Click to filter"}
          </span>
        </button>
      </div>

      {/* Active filter notification bar */}
      {activeFilter !== "all" && (
        <div className="bg-panel rounded-xl border border-border px-4 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-slate">
              STATUS FILTER:
            </span>
            <span className="font-semibold text-navy">
              {activeFilter}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onFilterChange("all")}
            className="text-xs font-semibold text-blue hover:underline"
          >
            Clear Filter ✕
          </button>
        </div>
      )}
    </div>
  );
}
