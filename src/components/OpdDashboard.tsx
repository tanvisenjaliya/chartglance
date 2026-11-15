"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PatientQueueItem, FacilityMetadata, sortQueueLive } from "@/lib/queue-utils";
import { getStoredQueue, saveStoredQueue, resetDemoStorage } from "@/lib/client-storage";
import KpiBar, { FilterType, isInfant, isSenior } from "./KpiBar";
import DoctorSidebar from "./DoctorSidebar";
import QueueStatusBadge from "./QueueStatusBadge";
import DemoModeBanner from "./DemoModeBanner";
import EmergencyPatientModal from "./EmergencyPatientModal";

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
  const [patients, setPatients] = useState<PatientQueueItem[]>(() =>
    sortQueueLive(initialPatients)
  );
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [consultationConflict, setConsultationConflict] = useState<{
    id: string;
    name: string;
    tokenNumber: string;
  } | null>(null);

  useEffect(() => {
    const stored = getStoredQueue();
    if (stored && stored.length > 0) {
      setPatients(sortQueueLive(stored));
    } else {
      saveStoredQueue(sortQueueLive(initialPatients));
    }
  }, [initialPatients]);

  // Filter logic
  const filteredPatients = patients.filter((patient) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "emergency") {
      return (
        Boolean(patient.isEmergency) ||
        patient.visitType === "Emergency" ||
        Boolean(patient.tokenNumber && patient.tokenNumber.startsWith("E"))
      );
    }
    if (activeFilter === "infants-seniors") {
      return isInfant(patient.age) || isSenior(patient.age);
    }
    if (activeFilter === "infants") return isInfant(patient.age);
    if (activeFilter === "seniors") return isSenior(patient.age);
    if (activeFilter === "male") {
      return patient.gender === "Male" || patient.gender === "M";
    }
    if (activeFilter === "female") {
      return patient.gender === "Female" || patient.gender === "F";
    }
    if (activeFilter === "other-gender") {
      return patient.gender === "Other" || patient.gender === "O";
    }
    return true;
  });

  const currentDateFormatted = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Next patient: first emergency waiting, or first regular waiting patient
  const nextWaiting = patients.find((p) => p.queueStatus === "Waiting");

  // Counts for live summary
  const waitingCount = patients.filter((p) => p.queueStatus === "Waiting").length;
  const inConsultCount = patients.filter(
    (p) => p.queueStatus === "In consultation"
  ).length;
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
    // Only one patient can be In consultation at a time
    if (newStatus === "In consultation") {
      const activeOther = patients.find(
        (p) => p.queueStatus === "In consultation" && p.id !== patientId
      );
      if (activeOther) {
        setConsultationConflict({
          id: activeOther.id,
          name: activeOther.name,
          tokenNumber: activeOther.tokenNumber,
        });
        return;
      }
      setConsultationConflict(null);
    }

    const now = Date.now();
    setPatients((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== patientId) return p;
        return {
          ...p,
          queueStatus: newStatus,
          completedTimestamp: newStatus === "Done" ? now : undefined,
        };
      });
      const sorted = sortQueueLive(updated);
      saveStoredQueue(sorted);
      return sorted;
    });

    try {
      const res = await fetch(`/api/patients/${patientId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          completedTimestamp: newStatus === "Done" ? now : undefined,
        }),
      });

      if (res.status === 409) {
        const errData = await res.json();
        if (errData.activePatient) {
          setConsultationConflict(errData.activePatient);
        }
        // Revert local state to match server truth
        const r = await fetch("/api/patients");
        if (r.ok) {
          const data = await r.json();
          setPatients(sortQueueLive(data));
        }
        return;
      }
    } catch {
      const res = await fetch("/api/patients");
      if (res.ok) {
        const data = await res.json();
        setPatients(sortQueueLive(data));
      }
    }
  };

  const handleEmergencyPatientAdded = (newPatient: PatientQueueItem) => {
    setPatients((prev) => {
      const updated = sortQueueLive([newPatient, ...prev]);
      saveStoredQueue(updated);
      return updated;
    });
  };

  const handleResetDemo = async () => {
    resetDemoStorage();
    try {
      await fetch("/api/patients/reset", { method: "POST" });
    } catch {
      // Ignore
    }
    window.location.reload();
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
            {/* KPI Metrics */}
            <KpiBar
              patients={patients}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />

            {/* Consultation Conflict Alert */}
            {consultationConflict && (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-center justify-between text-xs text-amber-900 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-amber-800">
                    Finish the current consultation first:
                  </span>
                  <Link
                    href={`/patient/${consultationConflict.id}`}
                    className="font-semibold text-blue underline hover:text-blue/80"
                  >
                    {consultationConflict.name} ({consultationConflict.tokenNumber}) &rarr;
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => setConsultationConflict(null)}
                  className="text-amber-700 hover:text-amber-900 text-base font-bold p-1 leading-none"
                  title="Dismiss"
                >
                  &times;
                </button>
              </div>
            )}

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

                  {/* Red Emergency Patient button replacing + Register */}
                  <button
                    type="button"
                    onClick={() => setIsEmergencyModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-mono uppercase tracking-wider font-bold hover:bg-red-700 shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    + Emergency patient
                  </button>
                </div>
              </div>

              {/* Patient Rows */}
              <div className="divide-y divide-border">
                {filteredPatients.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-sm font-semibold text-navy">
                      No patients match filter &quot;{activeFilter}&quot;
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveFilter("all")}
                      className="mt-2 text-xs font-semibold text-blue hover:underline"
                    >
                      Reset filter to view all {patients.length} patients
                    </button>
                  </div>
                ) : (
                  filteredPatients.map((patient) => {
                    const isDone = patient.queueStatus === "Done";
                    const isConsult = patient.queueStatus === "In consultation";
                    const isEmergency = Boolean(patient.isEmergency) || patient.tokenNumber.startsWith("E");
                    const hasNoAbha = patient.hasAbha === false || !patient.abhaNumber;

                    return (
                      <div
                        key={patient.id}
                        className={`p-6 transition-all group ${
                          isDone
                            ? "opacity-50 bg-slate-50/50"
                            : isEmergency
                            ? "bg-red-50/30 hover:bg-red-50/60 border-l-4 border-l-red-500"
                            : isConsult
                            ? "bg-blue/5 hover:bg-blue/10 border-l-4 border-l-blue"
                            : "hover:bg-panel/40"
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          {/* Token & Patient Demographics */}
                          <Link
                            href={`/patient/${patient.id}`}
                            className="flex items-start gap-4 flex-1 min-w-0"
                          >
                            {/* Token Badge */}
                            <div
                              className={`shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl border text-navy transition-colors ${
                                isEmergency
                                  ? "bg-red-100/70 border-red-300 text-red-800"
                                  : isConsult
                                  ? "bg-blue/10 border-blue/40 text-blue font-bold"
                                  : "bg-panel border-border group-hover:border-blue/50"
                              }`}
                            >
                              <span className="font-mono text-[10px] uppercase tracking-wider text-slate">
                                TOKEN
                              </span>
                              <span className="text-sm font-bold">
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

                                {/* Emergency Badge showing reason */}
                                {isEmergency && (
                                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                                    EMERGENCY: {patient.emergencyReason || patient.complaint || "Immediate attention"}
                                  </span>
                                )}

                                {/* Grey No ABHA Badge */}
                                {hasNoAbha && (
                                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 border border-gray-300">
                                    No ABHA
                                  </span>
                                )}
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

                              {/* ABHA Details or Unlinked Notice */}
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                {!hasNoAbha ? (
                                  <>
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
                                      <span className="text-navy-muted font-mono">
                                        {patient.abhaAddress}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-xs text-amber-700 font-mono">
                                    No ABHA linked &bull; Pending post-stabilization lookup
                                  </div>
                                )}

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
                            {hasNoAbha ? (
                              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-600 text-xs font-mono">
                                <span>No records available</span>
                              </div>
                            ) : patient.dataStatus === "Records available" ? (
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

      {/* Emergency Admission Modal */}
      <EmergencyPatientModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        onPatientAdded={handleEmergencyPatientAdded}
      />

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
            <button
              type="button"
              onClick={handleResetDemo}
              className="text-xs text-slate hover:text-navy hover:underline font-medium cursor-pointer"
            >
              Reset demo
            </button>
            <Link
              href="/register"
              className="text-xs text-blue hover:underline font-medium flex items-center gap-1"
            >
              Register Patient &rarr;
            </Link>
            {process.env.NODE_ENV !== "production" && (
              <Link
                href="/dev"
                className="text-xs text-blue hover:underline font-medium flex items-center gap-1"
              >
                Developer / FHIR Inspector &rarr;
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
