"use client";

import { useState } from "react";
import Link from "next/link";
import { PatientQueueItem } from "@/lib/records";
import KpiBar, { FilterType } from "./KpiBar";
import DoctorSidebar from "./DoctorSidebar";

interface OpdDashboardProps {
  initialPatients: PatientQueueItem[];
}

export default function OpdDashboard({ initialPatients }: OpdDashboardProps) {
  const [patients] = useState<PatientQueueItem[]>(initialPatients);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  // Filter logic
  const filteredPatients = patients.filter((patient) => {
    if (activeFilter === "all") return true;
    return patient.dataStatus === activeFilter;
  });

  const currentDateFormatted = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-panel text-navy font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-navy text-surface border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue flex items-center justify-center font-bold text-lg text-white shadow-sm">
              CG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-surface">
                  ChartGlance
                </h1>
                <span className="font-mono text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-blue/30 text-blue-200 border border-blue/40">
                  PHC MANDAVGAN
                </span>
              </div>
              <p className="text-xs text-slate">
                Primary Health Centre &bull; OPD Queue
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-xs uppercase tracking-wider px-3 py-1.5 rounded-full border border-slate/40 text-slate bg-navy/60">
              SIMULATED ABDM FLOW
            </span>
            <span className="text-xs text-slate hidden sm:inline-block">
              {currentDateFormatted}
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: OPD Queue & KPIs (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* KPI Metrics & Records Status Filter */}
            <KpiBar
              patients={patients}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />

            {/* OPD Queue List */}
            <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
              {/* Queue Header */}
              <div className="px-6 py-4 border-b border-border bg-panel/50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase tracking-wider font-semibold text-navy">
                    QUEUE ENTRIES ({filteredPatients.length} OF {patients.length})
                  </span>
                  {activeFilter !== "all" && (
                    <span className="font-mono text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue text-white">
                      FILTERED
                    </span>
                  )}
                </div>
                <span className="font-mono text-xs uppercase tracking-wider text-slate">
                  ORDER: ARRIVAL SEQUENCE
                </span>
              </div>

              {/* Patient Rows */}
              <div className="divide-y divide-border">
                {filteredPatients.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-sm font-semibold text-navy">
                      No patients found with status &quot;{activeFilter}&quot;
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveFilter("all")}
                      className="mt-2 text-xs font-semibold text-blue hover:underline"
                    >
                      Reset filter to view all patients
                    </button>
                  </div>
                ) : (
                  filteredPatients.map((patient) => {
                    return (
                      <div
                        key={patient.id}
                        className="p-6 hover:bg-panel/20 transition-colors"
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          {/* Token & Patient Demographics */}
                          <div className="flex items-start gap-4">
                            {/* Token Badge */}
                            <div className="shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl border bg-panel border-border text-navy">
                              <span className="font-mono text-xs uppercase tracking-wider text-slate">
                                TOKEN
                              </span>
                              <span className="text-sm font-bold text-navy">
                                {patient.tokenNumber.replace("OPD-", "")}
                              </span>
                            </div>

                            {/* Details */}
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-bold text-navy tracking-tight">
                                  {patient.name}
                                </h3>
                                <span className="text-sm text-navy-muted">
                                  {patient.age} yrs &bull; {patient.gender}
                                </span>
                              </div>

                              {/* Chief Complaint */}
                              {patient.chiefComplaint && (
                                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-navy">
                                  <span className="font-mono text-xs uppercase tracking-wider text-slate">
                                    COMPLAINT:
                                  </span>
                                  <span className="font-medium">
                                    {patient.chiefComplaint}
                                  </span>
                                </div>
                              )}

                              {/* ABHA Details */}
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs uppercase tracking-wider text-slate">
                                    ABHA NO:
                                  </span>
                                  <span className="text-navy font-medium">
                                    {patient.abhaNumber}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs uppercase tracking-wider text-slate">
                                    ABHA ID:
                                  </span>
                                  <span className="text-navy-muted">
                                    {patient.abhaAddress}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 text-slate">
                                  <span className="font-mono text-xs uppercase tracking-wider">
                                    ARRIVED:
                                  </span>
                                  <span>{patient.arrivalTime}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Data Status Badge */}
                          <div className="flex items-center gap-3 self-start md:self-center shrink-0">
                            {patient.dataStatus === "Records available" ? (
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-panel text-navy text-xs font-semibold">
                                <svg
                                  className="w-3.5 h-3.5 text-blue"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                <span className="font-mono text-xs uppercase tracking-wider">
                                  RECORDS AVAILABLE
                                </span>
                              </div>
                            ) : patient.dataStatus === "ABHA, no records" ? (
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface text-slate text-xs font-medium">
                                <svg
                                  className="w-3.5 h-3.5 text-slate"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                <span className="font-mono text-xs uppercase tracking-wider text-slate">
                                  ABHA, NO RECORDS
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-dashed border-border-dashed bg-surface text-slate text-xs font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate/50" />
                                <span className="font-mono text-xs uppercase tracking-wider text-slate">
                                  NO ABHA
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Doctor Profile (4 cols) */}
          <div className="lg:col-span-4">
            <DoctorSidebar totalPatients={patients.length} />
          </div>
        </div>
      </main>

      {/* Footer with Dev Inspector Link */}
      <footer className="mt-12 border-t border-border bg-surface py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate">
          <div>
            <p>ChartGlance &bull; Ayushman Bharat Digital Mission (ABDM) Clinical Queue Prototype</p>
            <p className="mt-0.5 text-[11px] text-navy-muted">
              Synthetic data only &bull; Dates stored as dynamic offsets relative to runtime
            </p>
          </div>

          <div>
            <Link
              href="/dev"
              className="text-xs text-blue hover:underline font-medium flex items-center gap-1"
            >
              Developer / FHIR Inspector &rarr;
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
