"use client";

import { useState } from "react";
import { PatientQueueItem } from "@/lib/records";
import KpiBar, { FilterType } from "./KpiBar";
import DoctorSidebar from "./DoctorSidebar";
import EmergencyPatientModal from "./EmergencyPatientModal";

interface OpdDashboardProps {
  initialPatients: PatientQueueItem[];
}

export default function OpdDashboard({ initialPatients }: OpdDashboardProps) {
  const [patients, setPatients] = useState<PatientQueueItem[]>(initialPatients);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Filter logic
  const filteredPatients = patients.filter((patient) => {
    switch (activeFilter) {
      case "male":
        return patient.gender === "Male";
      case "female":
        return patient.gender === "Female";
      case "vulnerable":
        return patient.age < 18 || patient.age >= 60;
      case "abha_linked":
        return patient.abhaStatus === "LINKED";
      case "abha_unlinked":
        return patient.abhaStatus === "UNLINKED" || !patient.abhaStatus;
      case "follow_up":
        return patient.visitType === "Follow-up";
      case "new_visit":
        return patient.visitType === "New Visit";
      case "emergency":
        return patient.isEmergency === true;
      case "all":
      default:
        return true;
    }
  });

  const handleAddEmergencyPatient = (
    newPatient: PatientQueueItem,
    position: "top" | "middle"
  ) => {
    const updated = [...patients];
    if (position === "top") {
      updated.unshift(newPatient);
    } else {
      const mid = Math.ceil(updated.length / 2);
      updated.splice(mid, 0, newPatient);
    }
    setPatients(updated);

    // Show temporary alert banner
    setAlertMessage(
      `Emergency triage patient "${newPatient.name}" inserted at ${
        position === "top" ? "top of queue (Position 1)" : "middle of queue"
      } for immediate clinical assessment.`
    );
  };

  const emergencyCount = patients.filter((p) => p.isEmergency).length;

  const currentDateFormatted = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-panel text-navy">
      {/* Top Navigation Bar */}
      <header className="bg-navy text-surface border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue flex items-center justify-center font-bold text-lg text-white shadow-sm">
              CG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-surface">
                  ChartGlance
                </h1>
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-blue/30 text-blue-200 border border-blue/40">
                  PHC Mandavgan
                </span>
              </div>
              <p className="text-xs text-slate tracking-wide">
                Primary Health Centre · OPD Queue &amp; Clinical Dashboard
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-wider px-3 py-1.5 rounded-full border border-slate/40 text-slate bg-navy/60">
              SIMULATED ABDM FLOW
            </span>

            {/* Emergency Walk-in Action Button */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-brand-red hover:bg-brand-red/90 text-surface text-xs font-mono font-bold tracking-wider uppercase transition-colors shadow-sm flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>+ Add Emergency Patient</span>
            </button>

            <span className="text-xs text-slate font-mono hidden lg:inline-block">
              {currentDateFormatted}
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Emergency Alert Toast / Banner */}
        {alertMessage && (
          <div className="mb-6 bg-severity-critical-bg border border-severity-critical-border text-severity-critical-text p-4 rounded-2xl shadow-sm flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-xs shrink-0">
                !
              </span>
              <div>
                <span className="font-mono text-xs font-bold text-brand-red uppercase tracking-wider">
                  URGENT TRIAGE ALERT
                </span>
                <p className="text-xs mt-0.5 font-medium">{alertMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAlertMessage(null)}
              className="text-xs font-mono text-brand-red hover:underline shrink-0"
            >
              Dismiss ✕
            </button>
          </div>
        )}

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: OPD Queue & KPIs (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Dynamic KPI Metrics Bar */}
            <KpiBar
              patients={patients}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />

            {/* OPD Queue Card */}
            <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
              {/* Queue Header */}
              <div className="px-6 py-4 border-b border-border bg-panel/50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-navy">
                    Queue Entries ({filteredPatients.length} of {patients.length})
                  </h2>
                  {activeFilter !== "all" && (
                    <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded-full bg-blue text-white">
                      Filter Active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs font-mono text-slate">
                  <span>Order: Token Sequence</span>
                </div>
              </div>

              {/* Patient Rows */}
              <div className="divide-y divide-border">
                {filteredPatients.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-sm font-semibold text-navy">
                      No patients match the active filter ({activeFilter})
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveFilter("all")}
                      className="mt-2 text-xs font-mono text-blue hover:underline font-bold"
                    >
                      Reset filter to view all patients
                    </button>
                  </div>
                ) : (
                  filteredPatients.map((patient) => {
                    const isPersona1 = patient.id === "p1";
                    const isEmergency = Boolean(patient.isEmergency);

                    return (
                      <div
                        key={patient.id}
                        className={`p-6 transition-colors ${
                          isEmergency
                            ? "bg-severity-critical-bg/50 border-l-4 border-l-brand-red"
                            : isPersona1
                            ? "bg-panel/20 hover:bg-panel/40"
                            : "hover:bg-panel/10"
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          {/* Token & Patient Demographics */}
                          <div className="flex items-start gap-4">
                            {/* Token Badge */}
                            <div
                              className={`shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl border ${
                                isEmergency
                                  ? "bg-severity-critical-bg border-severity-critical-border text-brand-red"
                                  : "bg-panel border-border text-navy"
                              }`}
                            >
                              <span className="font-mono text-[10px] uppercase tracking-wider text-slate">
                                {isEmergency ? "URGENT" : "TOKEN"}
                              </span>
                              <span className="font-mono text-sm font-bold">
                                {patient.tokenNumber.replace("OPD-", "")}
                              </span>
                            </div>

                            {/* Details */}
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-bold text-navy tracking-tight">
                                  {patient.name}
                                </h3>
                                <span className="text-sm font-medium text-navy-muted">
                                  {patient.age} yrs · {patient.gender}
                                </span>

                                {isEmergency && (
                                  <span className="font-mono text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-brand-red text-white flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                    EMERGENCY · TRIAGE 1
                                  </span>
                                )}

                                {isPersona1 && (
                                  <span className="font-mono text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue text-white">
                                    DEMO PERSONA 1
                                  </span>
                                )}

                                {patient.visitType && (
                                  <span
                                    className={`font-mono text-[10px] font-medium uppercase px-2 py-0.5 rounded border ${
                                      patient.visitType === "Follow-up"
                                        ? "bg-panel text-navy-muted border-border"
                                        : patient.visitType === "Emergency Triage"
                                        ? "bg-severity-critical-bg text-brand-red border-severity-critical-border"
                                        : "bg-surface text-slate border-border"
                                    }`}
                                  >
                                    {patient.visitType}
                                  </span>
                                )}
                              </div>

                              {/* Chief Complaint */}
                              {patient.chiefComplaint && (
                                <div className="mt-1 flex items-center gap-1.5 text-xs text-navy font-medium">
                                  <span className="font-mono uppercase text-slate text-[11px]">
                                    COMPLAINT:
                                  </span>
                                  <span>{patient.chiefComplaint}</span>
                                </div>
                              )}

                              {/* ABHA details */}
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono uppercase text-slate text-[11px]">
                                    ABHA NO:
                                  </span>
                                  <span className="font-mono font-medium text-navy">
                                    {patient.abhaNumber}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono uppercase text-slate text-[11px]">
                                    ABHA ID:
                                  </span>
                                  <span className="font-mono font-medium text-navy-muted">
                                    {patient.abhaAddress}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 text-slate">
                                  <span className="font-mono uppercase text-[11px]">
                                    ARRIVED:
                                  </span>
                                  <span>{patient.arrivalTime}</span>
                                </div>
                              </div>

                              {/* Clinical Note / Spec Hint */}
                              {patient.notes && (
                                <p className="mt-2 text-xs text-slate italic">
                                  {patient.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Data Status Badge */}
                          <div className="flex items-center gap-3 self-start md:self-center shrink-0">
                            {patient.dataStatus === "Records Available" ? (
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-panel text-navy text-xs font-mono font-semibold tracking-wide uppercase">
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
                                <span>RECORDS AVAILABLE (3 VISITS)</span>
                              </div>
                            ) : patient.dataStatus === "No Linked Records" ? (
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-dashed border-border-dashed bg-surface text-navy-muted text-xs font-mono font-semibold tracking-wide uppercase">
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
                                <span>NO LINKED RECORDS</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface text-slate text-xs font-mono font-medium tracking-wide uppercase">
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
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                <span>CONSENT PENDING (M2)</span>
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

            {/* Persona 1 FHIR Bundle Inspection Panel (Milestone 1 Verification) */}
            <section className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue uppercase tracking-wider">
                      FHIR R4 INSPECTOR
                    </span>
                    <span className="text-slate text-xs">•</span>
                    <span className="text-xs text-navy-muted">
                      NRCeS ABDM Profiles
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-navy mt-0.5">
                    Persona 1 FHIR Bundle Structure
                  </h4>
                </div>
                <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-panel text-navy-muted border border-border">
                  data/records/persona-1.json
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs">
                <div className="p-4 rounded-xl bg-panel border border-border">
                  <span className="font-mono uppercase font-semibold text-slate block mb-1">
                    FACILITIES LINKED
                  </span>
                  <p className="font-medium text-navy">
                    CHC Shirur (HIP-MH-PUN-001)
                  </p>
                  <p className="font-medium text-navy">
                    PHC Mandavgan (HIP-MH-PUN-042)
                  </p>
                  <span className="text-slate text-[11px] mt-1 block">
                    Federated mock ABDM facilities
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-panel border border-border">
                  <span className="font-mono uppercase font-semibold text-slate block mb-1">
                    OBSERVATIONS &amp; TRENDS (TODO-VERIFY)
                  </span>
                  <p className="font-medium text-navy">
                    HbA1c: 7.8% &rarr; 8.4% &rarr; 9.2% (9 mo)
                  </p>
                  <p className="font-medium text-navy">
                    BP: 142/90 &rarr; 150/94 &rarr; 182/112
                  </p>
                  <span className="text-slate text-[11px] mt-1 block">
                    Negative day offsets: -270d, -180d, -90d
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-panel border border-border">
                  <span className="font-mono uppercase font-semibold text-slate block mb-1">
                    FOLLOW-UP STATUS (TODO-VERIFY)
                  </span>
                  <p className="font-medium text-navy">
                    Scheduled: -30 days ago
                  </p>
                  <p className="font-medium text-navy">
                    Status: No-show / Overdue
                  </p>
                  <span className="text-slate text-[11px] mt-1 block">
                    Triggers overdue flag in Milestone 3
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Doctor Profile & Session Notes (4 cols) */}
          <div className="lg:col-span-4">
            <DoctorSidebar
              totalPatients={patients.length}
              emergencyCount={emergencyCount}
            />
          </div>
        </div>
      </main>

      {/* Emergency Patient Pop-up Modal */}
      <EmergencyPatientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddPatient={handleAddEmergencyPatient}
      />

      {/* Footer */}
      <footer className="mt-12 border-t border-border bg-surface py-6 text-center text-xs text-slate font-mono">
        <p>
          ChartGlance · Ayushman Bharat Digital Mission (ABDM) Clinical Queue Prototype
        </p>
        <p className="mt-1 text-[11px] text-navy-muted">
          Synthetic data only · Dates stored as dynamic offsets relative to runtime
        </p>
      </footer>
    </div>
  );
}
