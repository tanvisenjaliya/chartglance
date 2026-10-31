"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PatientQueueItem, FacilityMetadata } from "@/lib/records";
import KpiBar, { FilterType } from "./KpiBar";
import DoctorSidebar from "./DoctorSidebar";
import QueueStatusBadge from "./QueueStatusBadge";
import DemoModeBanner from "./DemoModeBanner";

interface OpdDashboardProps {
  initialPatients: PatientQueueItem[];
  facility?: FacilityMetadata;
}

export default function OpdDashboard({
  initialPatients,
  facility = {
    facilityName: "PHC Navli (demo)",
    district: "Anand",
    state: "Gujarat",
  },
}: OpdDashboardProps) {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientQueueItem[]>(initialPatients);
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

  // Next patient: first Waiting patient
  const nextWaiting = patients.find((p) => p.queueStatus === "Waiting");

  // Counts for sidebar display
  const waitingCount = patients.filter((p) => p.queueStatus === "Waiting").length;
  const inConsultCount = patients.filter((p) => p.queueStatus === "In consultation").length;
  const doneCount = patients.filter((p) => p.queueStatus === "Done").length;

  const handleNextPatient = () => {
    if (nextWaiting) {
      router.push(`/patient/${nextWaiting.id}`);
    }
  };

  const handleStatusChange = async (
    patientId: string,
    newStatus: "Waiting" | "In consultation" | "Done"
  ) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId ? { ...p, queueStatus: newStatus } : p
      )
    );
    try {
      await fetch(`/api/patients/${patientId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      const res = await fetch("/api/patients");
      if (res.ok) setPatients(await res.json());
    }
  };

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
                  {facility.facilityName.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate">
                Primary Health Centre &bull; {facility.district} District, {facility.state} &bull; Today&apos;s OPD Queue
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

      {/* Demo Mode Banner */}
      <DemoModeBanner />

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
                    TODAY&apos;S QUEUE ({filteredPatients.length} OF {patients.length})
                  </span>
                  {activeFilter !== "all" && (
                    <span className="font-mono text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue text-white">
                      FILTERED
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate">
                    <span>{waitingCount} waiting</span>
                    <span>&bull;</span>
                    <span>{inConsultCount} in consult</span>
                    <span>&bull;</span>
                    <span>{doneCount} done</span>
                  </div>

                  {nextWaiting && (
                    <button
                      type="button"
                      onClick={handleNextPatient}
                      className="px-3 py-1.5 rounded-lg bg-blue text-white text-xs font-mono uppercase tracking-wider font-semibold hover:bg-blue/90 transition-colors"
                    >
                      Next Patient &rarr;
                    </button>
                  )}

                  <Link
                    href="/register"
                    className="px-3 py-1.5 rounded-lg border border-border bg-panel text-navy-muted text-xs font-mono uppercase tracking-wider font-semibold hover:bg-border/60 transition-colors"
                  >
                    + Register
                  </Link>
                </div>
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
                    const isDone = patient.queueStatus === "Done";
                    return (
                      <div
                        key={patient.id}
                        className={`p-6 transition-all group ${
                          isDone ? "opacity-60" : "hover:bg-panel/40"
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          {/* Token & Patient Demographics */}
                          <Link
                            href={`/patient/${patient.id}`}
                            className="flex items-start gap-4 flex-1 min-w-0"
                          >
                            {/* Token Badge */}
                            <div className="shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl border bg-panel border-border text-navy group-hover:border-blue/50 transition-colors">
                              <span className="font-mono text-xs uppercase tracking-wider text-slate">
                                TOKEN
                              </span>
                              <span className="text-sm font-bold text-navy">
                                {patient.tokenNumber.replace("OPD-", "")}
                              </span>
                            </div>

                            {/* Details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-bold text-navy tracking-tight group-hover:text-blue transition-colors">
                                  {patient.name}
                                </h3>
                                <span className="text-sm text-navy-muted">
                                  {patient.age} yrs &bull; {patient.gender}
                                </span>
                                {patient.village && (
                                  <span className="font-mono text-xs text-slate">
                                    &bull; {patient.village}
                                  </span>
                                )}
                                <QueueStatusBadge
                                  status={patient.queueStatus ?? "Waiting"}
                                  compact
                                />
                              </div>

                              {/* Chief Complaint */}
                              {(patient.chiefComplaint || patient.complaint) && (
                                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-navy">
                                  <span className="font-mono text-xs uppercase tracking-wider text-slate">
                                    COMPLAINT:
                                  </span>
                                  <span className="font-medium">
                                    {patient.chiefComplaint || patient.complaint}
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
                          </Link>

                          {/* Right side: data status badge + status controls */}
                          <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
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
                                  RECORDS AVAILABLE ({patient.recordCount})
                                </span>
                              </div>
                            ) : (
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
                            )}

                            {patient.queueStatus === "Waiting" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusChange(patient.id, "In consultation")
                                }
                                className="text-[11px] font-mono uppercase tracking-wider text-blue hover:underline"
                              >
                                Start consultation
                              </button>
                            )}
                            {patient.queueStatus === "In consultation" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusChange(patient.id, "Done")
                                }
                                className="text-[11px] font-mono uppercase tracking-wider text-navy-muted hover:text-navy hover:underline"
                              >
                                Mark done
                              </button>
                            )}

                            <Link
                              href={`/patient/${patient.id}`}
                              className="text-xs text-blue font-medium hidden sm:inline-block"
                            >
                              Consultation &rarr;
                            </Link>
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
            <DoctorSidebar
              totalPatients={patients.length}
              waitingCount={waitingCount}
              inConsultCount={inConsultCount}
              doneCount={doneCount}
              facility={facility}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-border bg-surface py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate">
          <div>
            <p>
              ChartGlance &bull; {facility.facilityName}, {facility.district} ({facility.state})
            </p>
            <p className="mt-0.5 text-[11px] text-navy-muted">
              Synthetic data only &bull; Relative dates dynamically resolved at load time
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/register"
              className="text-xs text-blue hover:underline font-medium flex items-center gap-1"
            >
              Register Patient &rarr;
            </Link>
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