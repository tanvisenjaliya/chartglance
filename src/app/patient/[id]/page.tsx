"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ConsentRecord, CompositionRecord } from "@/lib/abdm-mock";
import { PatientQueueItem } from "@/lib/queue-utils";
import { ConsultationNote } from "@/lib/notes-store";
import QueueStatusBadge from "@/components/QueueStatusBadge";
import DemoModeBanner from "@/components/DemoModeBanner";
import ConsultationNoteBox from "@/components/ConsultationNoteBox";
import PreviousVisitsList from "@/components/PreviousVisitsList";

export default function PatientConsultationPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<PatientQueueItem | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [compositions, setCompositions] = useState<CompositionRecord[]>([]);
  const [facilityCount, setFacilityCount] = useState(0);
  const [pendingFacilities, setPendingFacilities] = useState<string[]>([]);
  const [timedOutCount, setTimedOutCount] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [startingNewVisit, setStartingNewVisit] = useState(false);

  // Local Notes state
  const [previousNotes, setPreviousNotes] = useState<ConsultationNote[]>([]);

  // Link ABHA modal state
  const [isLinkAbhaOpen, setIsLinkAbhaOpen] = useState(false);
  const [linkIdentifier, setLinkIdentifier] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkSuccess, setLinkSuccess] = useState(false);

  // 1. Fetch patient details
  const loadPatient = useCallback(async () => {
    try {
      const res = await fetch("/api/patients");
      if (res.ok) {
        const list: PatientQueueItem[] = await res.json();
        const match = list.find((p) => p.id === patientId);
        setPatient(match || null);
      }
    } catch {
      // Fallback
    } finally {
      setLoadingPatient(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadPatient();
  }, [loadPatient]);

  // 2. Fetch local previous visits (independent of ABDM consent)
  const fetchPreviousNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes?patientId=${patientId}`);
      if (res.ok) {
        const data = await res.json();
        setPreviousNotes(data.notes || []);
      }
    } catch {
      // Ignore
    }
  }, [patientId]);

  useEffect(() => {
    fetchPreviousNotes();
  }, [fetchPreviousNotes]);

  // 3. Fetch consent status and compositions
  const fetchConsentStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/abdm/consent/${patientId}`);
      if (res.ok) {
        const data = await res.json();
        setConsent(data.consent);
        if (data.recordsData) {
          setCompositions(data.recordsData.compositions || []);
          setFacilityCount(data.recordsData.facilityCount || 0);
          setPendingFacilities(data.recordsData.pendingFacilities || []);
          setTimedOutCount(data.recordsData.timedOutCount || 0);
        }
      }
    } catch {
      // Ignore polling errors
    }
  }, [patientId]);

  useEffect(() => {
    fetchConsentStatus();
  }, [fetchConsentStatus]);

  useEffect(() => {
    const shouldPoll =
      consent?.status === "REQUESTED" || pendingFacilities.length > 0;
    if (!shouldPoll) return;
    const interval = setInterval(() => {
      fetchConsentStatus();
    }, 2500);
    return () => clearInterval(interval);
  }, [consent?.status, pendingFacilities.length, fetchConsentStatus]);

  const handleRequestRecords = async () => {
    if (!patient) return;
    setRequesting(true);
    try {
      const res = await fetch("/api/abdm/consent/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          abhaNumber: patient.abhaNumber,
          abhaAddress: patient.abhaAddress,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setConsent(data.consent);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRequesting(false);
    }
  };

  const handleSimulateExpiry = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/abdm/consent/${patientId}/expire`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setConsent(data.consent);
        setCompositions([]);
        setPendingFacilities([]);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetConsent = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/abdm/consent/${patientId}/reset`, {
        method: "POST",
      });
      if (res.ok) {
        setConsent(null);
        setCompositions([]);
        setPendingFacilities([]);
        setTimedOutCount(0);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (
    newStatus: "Waiting" | "In consultation" | "Done"
  ) => {
    if (!patient) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setPatient(data.patient);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStatusUpdating(false);
    }
  };

  // 4. Start new visit handler for return demo
  const handleStartNewVisit = async () => {
    if (!patient) return;
    setStartingNewVisit(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/new-visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaint: patient.chiefComplaint || "Follow-up visit" }),
      });
      if (res.ok) {
        const data = await res.json();
        setPatient(data.patient);
        router.push("/");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStartingNewVisit(false);
    }
  };

  const handleLinkAbha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkIdentifier.trim()) {
      setLinkError("Please enter an ABHA number or address");
      return;
    }
    setLinkLoading(true);
    setLinkError("");
    try {
      const lookupRes = await fetch(
        `/api/abdm/lookup?identifier=${encodeURIComponent(linkIdentifier.trim())}`
      );
      const lookupData = await lookupRes.json();

      let abhaNum = linkIdentifier.trim();
      let abhaAddr = `${linkIdentifier.trim().toLowerCase().replace(/[^a-z0-9]/g, "")}@sbx`;
      if (lookupRes.ok && lookupData.abhaNumber) {
        abhaNum = lookupData.abhaNumber;
        abhaAddr = lookupData.abhaAddress || abhaAddr;
      }

      const res = await fetch(`/api/patients/${patientId}/link-abha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abhaNumber: abhaNum, abhaAddress: abhaAddr }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLinkError(data.error || "Failed to link ABHA");
        return;
      }

      setLinkSuccess(true);
      await loadPatient();
      await fetchConsentStatus();
      setTimeout(() => {
        setIsLinkAbhaOpen(false);
        setLinkSuccess(false);
      }, 500);
    } catch {
      setLinkError("Network error while linking ABHA");
    } finally {
      setLinkLoading(false);
    }
  };

  if (loadingPatient) {
    return (
      <div className="min-h-screen bg-panel flex items-center justify-center p-6 text-navy">
        <p className="text-sm font-medium">Loading patient record...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-panel p-6 text-navy flex flex-col items-center justify-center">
        <h2 className="text-lg font-bold">Patient Not Found</h2>
        <Link href="/" className="mt-3 text-xs font-semibold text-blue hover:underline">
          &larr; Back to OPD Queue
        </Link>
      </div>
    );
  }

  let hoursRemaining = 0;
  if (consent?.status === "GRANTED" && consent.expiryDate) {
    const diff = new Date(consent.expiryDate).getTime() - new Date().getTime();
    hoursRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60)));
  }

  const queueStatus = patient.queueStatus ?? "Waiting";
  const isEmergency = Boolean(patient.isEmergency) || patient.tokenNumber.startsWith("E");
  const hasNoAbha = patient.hasAbha === false || !patient.abhaNumber;

  return (
    <div className="min-h-screen bg-panel text-navy font-sans">
      {/* Top Header */}
      <header className="bg-navy text-surface border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-slate hover:text-surface flex items-center gap-1 transition-colors"
            >
              <span>&larr;</span> Back to OPD Queue
            </Link>
            <span className="text-slate text-xs">&bull;</span>
            <span className="font-mono text-xs uppercase tracking-wider text-slate">
              CONSULTATION VIEW
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-wider px-3 py-1 rounded-full border border-slate/40 text-slate bg-navy/60">
              SIMULATED ABDM FLOW
            </span>
          </div>
        </div>
      </header>

      {/* Demo Mode Banner */}
      <DemoModeBanner />

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Patient Demographics Card */}
        <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl border text-navy ${
                  isEmergency
                    ? "bg-red-100/80 border-red-300 text-red-800"
                    : "bg-panel border-border"
                }`}
              >
                <span className="font-mono text-xs uppercase tracking-wider text-slate">
                  TOKEN
                </span>
                <span className="text-sm font-bold">
                  {patient.tokenNumber.replace("OPD-", "")}
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-navy">
                    {patient.name}
                  </h1>
                  <span className="text-sm text-navy-muted">
                    {patient.age} yrs &bull; {patient.gender}
                  </span>
                  {patient.village && (
                    <span className="font-mono text-xs text-slate">
                      &bull; {patient.village} ({patient.district || "Anand"})
                    </span>
                  )}
                  <QueueStatusBadge status={queueStatus} />

                  {isEmergency && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                      EMERGENCY: {patient.emergencyReason || patient.complaint || "Immediate attention"}
                    </span>
                  )}

                  {hasNoAbha && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 border border-gray-300">
                      No ABHA
                    </span>
                  )}
                </div>

                {(patient.chiefComplaint || patient.complaint) && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-navy">
                    <span className="font-mono text-xs uppercase tracking-wider text-slate">
                      COMPLAINT:
                    </span>
                    <span className="font-medium">{patient.chiefComplaint || patient.complaint}</span>
                  </div>
                )}

                {/* Identifiers */}
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-700 font-mono">
                        No ABHA linked &bull; Admitted under emergency intake
                      </span>
                      <a
                        href="https://abha.abdm.gov.in/abha/v3"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue hover:underline font-semibold flex items-center gap-1"
                      >
                        Link ABHA &rarr;
                      </a>
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
            </div>

            {/* Queue Lifecycle Controls */}
            <div className="flex flex-col sm:items-end gap-3">
              <span className="font-mono text-xs uppercase tracking-wider text-slate">
                CONSULTATION STATUS
              </span>

              {queueStatus === "Waiting" && (
                <button
                  type="button"
                  onClick={() => handleStatusChange("In consultation")}
                  disabled={statusUpdating}
                  className="px-5 py-2.5 rounded-xl bg-blue text-white text-xs font-mono uppercase tracking-wider font-semibold hover:bg-blue/90 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {statusUpdating ? "Updating…" : "Start Consultation"}
                </button>
              )}

              {queueStatus === "In consultation" && (
                <div className="flex items-center gap-2">
                  <QueueStatusBadge status="In consultation" />
                  <span className="text-[11px] text-slate font-mono">
                    Fill note below to complete
                  </span>
                </div>
              )}

              {queueStatus === "Done" && (
                <div className="flex flex-wrap items-center gap-2.5">
                  <QueueStatusBadge status="Done" />
                  <button
                    type="button"
                    onClick={handleStartNewVisit}
                    disabled={startingNewVisit}
                    className="px-3.5 py-1.5 rounded-xl bg-blue hover:bg-blue/90 text-white font-mono text-xs uppercase tracking-wider font-semibold transition-colors shadow-sm disabled:opacity-50"
                  >
                    {startingNewVisit ? "Enqueuing…" : "+ Start New Visit"}
                  </button>
                  <Link
                    href="/"
                    className="text-xs text-blue hover:underline font-medium ml-1"
                  >
                    &larr; Back to queue
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Consultation Note Box (Shown only when status is "In consultation") */}
        {queueStatus === "In consultation" && (
          <ConsultationNoteBox
            patientId={patient.id}
            onNoteSaved={() => {
              loadPatient();
              fetchPreviousNotes();
            }}
          />
        )}

        {/* Previous Visits at this PHC (Shown for ALL patients, independent of ABDM consent) */}
        <PreviousVisitsList
          notes={previousNotes}
          onAddendumAdded={fetchPreviousNotes}
        />

        {/* ABDM Consent Flow Section (or No ABHA Linked Panel) */}
        {hasNoAbha ? (
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border gap-3">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-slate font-semibold">
                  ABDM IDENTITY STATUS
                </span>
                <h2 className="text-lg font-bold text-navy mt-0.5">
                  No ABHA linked: no records available
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsLinkAbhaOpen(true)}
                  className="px-3 py-2 border border-border bg-panel hover:bg-border/60 text-slate hover:text-navy text-xs font-mono uppercase tracking-wider rounded-xl transition-colors"
                  title="Lookup and link from simulated registry"
                >
                  Enter Mock ABHA
                </button>
                <a
                  href="https://abha.abdm.gov.in/abha/v3"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue text-white rounded-xl text-xs font-mono uppercase tracking-wider font-bold hover:bg-blue/90 shadow-sm transition-colors inline-flex items-center gap-1.5"
                >
                  Link ABHA &rarr;
                </a>
              </div>
            </div>
            <p className="text-xs text-navy-muted leading-relaxed">
              This patient arrived as an emergency admission without a verified ABHA number or address.
              ABDM health records cannot be requested from network facilities until an ABHA identity is linked.
              You can conduct the consultation and document clinical notes right away, or click <strong>Link ABHA</strong> above to visit the official ABHA portal (<strong>https://abha.abdm.gov.in/abha/v3</strong>) to generate or link an identity.
            </p>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-blue font-semibold">
                  ABDM CONSENT GATEWAY (HIU ROLE)
                </span>
                <span className="text-slate text-xs">&bull;</span>
                <span className="text-xs text-navy-muted">Time-bound Federated Access</span>
              </div>
              <h2 className="text-lg font-bold text-navy mt-0.5">
                Patient Consent Status
              </h2>
            </div>

            {/* Consent Status Pill */}
            <div>
              {consent?.status === "GRANTED" ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border bg-panel text-navy text-xs font-semibold">
                  <svg className="w-3.5 h-3.5 text-blue" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.5 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                  </svg>
                  <span className="font-mono text-xs uppercase tracking-wider">
                    WITH CONSENT &bull; EXPIRES IN {hoursRemaining}H
                  </span>
                </div>
              ) : consent?.status === "REQUESTED" ? (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-300 bg-amber-50 text-amber-800 text-xs font-mono uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  CONSENT REQUESTED &bull; AWAITING PATIENT
                </span>
              ) : consent?.status === "DENIED" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-200 bg-red-50 text-red-700 text-xs font-mono uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-brand-red" />
                  CONSENT DENIED BY PATIENT
                </span>
              ) : consent?.status === "EXPIRED" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate/30 bg-panel text-slate text-xs font-mono uppercase tracking-wider">
                  CONSENT EXPIRED &bull; RECORDS LOCKED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-panel text-slate text-xs font-mono uppercase tracking-wider">
                  NO ACTIVE CONSENT
                </span>
              )}
            </div>
          </div>

          {/* Consent State Controls */}
          {!consent || consent.status === "NOT_REQUESTED" ? (
            <div className="p-5 rounded-xl border border-border bg-panel/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs text-navy font-semibold">
                  Request access to patient&apos;s linked health records
                </p>
                <p className="text-xs text-navy-muted">
                  Purpose: <strong className="text-navy">Care Management (CAREMGT)</strong> &bull; Validity: <strong className="text-navy">24 Hours</strong> &bull; Scope: Outpatient Consults, Labs, Prescriptions.
                </p>
                <p className="text-[11px] text-slate">
                  A consent request will be sent to the patient&apos;s ABHA app. Auto-simulates approval/denial in 20–90 s if the patient app is not used.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRequestRecords}
                disabled={requesting}
                className="px-5 py-2.5 rounded-xl bg-blue hover:bg-blue/90 text-white text-xs font-mono uppercase tracking-wider font-semibold transition-colors shrink-0 shadow-sm disabled:opacity-50"
              >
                {requesting ? "Sending Request..." : "Request Records"}
              </button>
            </div>
          ) : consent.status === "REQUESTED" ? (
            <div className="p-5 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-amber-900">
                  Consent Request Sent to Patient&apos;s ABHA App
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  Sent to <code className="font-mono">{patient.abhaAddress}</code> &bull; Expires in 24 hours.
                </p>
                <p className="text-[11px] text-amber-700/80 mt-1">
                  Auto-resolves in 20–90 s if patient does not act. This screen updates automatically.
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <Link
                  href={`/patient-phone/${patient.id}`}
                  target="_blank"
                  className="px-4 py-2 rounded-xl bg-navy text-surface hover:bg-navy/90 text-xs font-mono uppercase tracking-wider font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <span>Open Patient Phone &rarr;</span>
                </Link>
              </div>
            </div>
          ) : consent.status === "DENIED" ? (
            <div className="p-5 rounded-xl border border-red-200 bg-red-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-brand-red">
                  Patient Denied Consent Request
                </p>
                <p className="text-xs text-navy-muted mt-1">
                  The patient declined the consent request in their ABHA app. Health records remain locked.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestRecords}
                  disabled={requesting}
                  className="px-4 py-2 rounded-xl bg-blue text-white text-xs font-mono uppercase tracking-wider font-semibold transition-colors"
                >
                  Send New Request
                </button>
                <button
                  type="button"
                  onClick={handleResetConsent}
                  className="px-3 py-2 rounded-xl border border-border text-xs font-mono text-slate hover:bg-surface"
                >
                  Reset Demo
                </button>
              </div>
            </div>
          ) : consent.status === "EXPIRED" ? (
            <div className="p-5 rounded-xl border border-border bg-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-navy">
                  Consent Expired (24h Window Elapsed)
                </p>
                <p className="text-xs text-navy-muted mt-1">
                  The time-bound consent has expired. Under ABDM privacy principles, previously downloaded records are locked.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestRecords}
                  disabled={requesting}
                  className="px-4 py-2 rounded-xl bg-blue text-white text-xs font-mono uppercase tracking-wider font-semibold transition-colors"
                >
                  Request Again
                </button>
                <button
                  type="button"
                  onClick={handleResetConsent}
                  className="px-3 py-2 rounded-xl border border-border text-xs font-mono text-slate hover:bg-surface"
                >
                  Reset Demo
                </button>
              </div>
            </div>
          ) : (
            // GRANTED Action Controls
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2">
              <span className="text-navy-muted">
                Sharing records across {facilityCount} linked facility (HIP) under consent ID <code className="font-mono text-navy font-bold">{consent.id}</code>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSimulateExpiry}
                  disabled={actionLoading}
                  className="px-3 py-1.5 rounded-lg border border-border bg-panel hover:bg-border/60 text-slate hover:text-navy text-xs font-mono uppercase tracking-wider transition-colors"
                  title="Simulate 24h expiration for demo"
                >
                  Simulate Expiry
                </button>
                <button
                  type="button"
                  onClick={handleResetConsent}
                  disabled={actionLoading}
                  className="px-3 py-1.5 rounded-lg border border-border bg-panel hover:bg-border/60 text-slate hover:text-navy text-xs font-mono uppercase tracking-wider transition-colors"
                >
                  Reset Consent
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Received Records — Grouped by Composition (Health Record) */}
        {consent?.status === "GRANTED" && (
          <section className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden animate-in fade-in duration-300">
            <div className="px-6 py-4 border-b border-border bg-panel/50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider font-semibold text-navy">
                  RECEIVED HEALTH RECORDS ({compositions.length})
                </span>
                <span className="text-slate text-xs">&bull;</span>
                <span className="text-xs text-navy-muted">
                  NRCeS ABDM FHIR R4 Bundles
                </span>
              </div>

              <div className="flex items-center gap-2">
                {timedOutCount > 0 && (
                  <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-800">
                    {timedOutCount} facilit{timedOutCount === 1 ? "y" : "ies"} didn&apos;t respond
                  </span>
                )}

                {pendingFacilities.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-slate">
                    <span className="w-2 h-2 rounded-full bg-slate/40 animate-pulse" />
                    {pendingFacilities.length} facilit{pendingFacilities.length === 1 ? "y" : "ies"} loading…
                  </span>
                )}
              </div>
            </div>

            {/* Per-facility pending notification */}
            {pendingFacilities.length > 0 && (
              <div className="px-6 py-3 border-b border-border bg-panel/20 space-y-2">
                {pendingFacilities.map((f) => (
                  <div
                    key={f}
                    className="flex items-center gap-3 text-xs text-slate"
                  >
                    <span className="w-2 h-2 rounded-full bg-slate/30 animate-pulse shrink-0" />
                    <span>
                      Waiting for <span className="font-medium text-navy">{f}</span>…
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {compositions.length === 0 && pendingFacilities.length === 0 ? (
              <div className="p-8 text-center">
                <div className="max-w-md mx-auto p-6 rounded-2xl border border-dashed border-border-dashed bg-panel/30">
                  <span className="w-8 h-8 rounded-full bg-panel text-slate flex items-center justify-center font-bold text-sm mx-auto mb-2">
                    i
                  </span>
                  <p className="text-sm font-semibold text-navy">
                    No records found
                  </p>
                  <p className="text-xs text-navy-muted mt-1">
                    Consent was granted, but no digital health records were linked across participating facilities.
                  </p>
                </div>
              </div>
            ) : (
              /* Grouped by Composition (Health Record) */
              <div className="divide-y divide-border">
                {compositions.map((comp) => (
                  <div key={comp.id} className="p-6 space-y-4 hover:bg-panel/10 transition-colors">
                    {/* Composition Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-panel border border-border text-blue shrink-0">
                          {comp.type}
                        </span>
                        <div>
                          <h4 className="text-base font-bold text-navy tracking-tight">
                            {comp.title}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-5 text-xs text-navy-muted sm:text-right shrink-0">
                        <div>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-slate block">
                            FACILITY
                          </span>
                          <span className="font-medium text-navy">{comp.facility}</span>
                        </div>
                        <div>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-slate block">
                            DATE
                          </span>
                          <span className="font-medium text-navy">{comp.date}</span>
                        </div>
                      </div>
                    </div>

                    {/* Clinical Note if present */}
                    {comp.clinicalNote && (
                      <div className="p-3.5 rounded-xl bg-panel/50 border border-border/80 text-xs">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-slate block mb-1">
                          CLINICAL NOTE
                        </span>
                        <p className="text-navy font-medium leading-relaxed">
                          {comp.clinicalNote}
                        </p>
                      </div>
                    )}

                    {/* Referenced Clinical Items */}
                    {comp.items.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-slate block">
                          RECORD CONTENTS ({comp.items.length})
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {comp.items.map((item) => (
                            <div
                              key={item.id}
                              className="p-3 rounded-xl border border-border bg-surface flex flex-col justify-between text-xs"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-panel text-slate">
                                    {item.resourceType}
                                  </span>
                                  {item.date && (
                                    <span className="text-[11px] text-slate font-mono">
                                      {item.date}
                                    </span>
                                  )}
                                </div>
                                <p className="font-semibold text-navy mt-1.5">
                                  {item.display}
                                </p>
                              </div>
                              {item.details && (
                                <p className="text-[11px] text-navy-muted mt-1 pt-1 border-t border-border/40">
                                  {item.details}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Link ABHA Modal */}
      {isLinkAbhaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-navy">Link ABHA to Patient</h3>
              <button
                type="button"
                onClick={() => setIsLinkAbhaOpen(false)}
                className="text-slate hover:text-navy text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleLinkAbha} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-navy font-semibold mb-1">
                  ABHA Number or Address
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 91-5555-2031-0006 or rahul.verma@sbx"
                  value={linkIdentifier}
                  onChange={(e) => setLinkIdentifier(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue"
                />
                <p className="mt-1 text-[11px] text-slate">
                  Enter patient&apos;s ABHA ID or look up from network registry. Once linked, consent request will initiate automatically.
                </p>
              </div>

              {linkError && (
                <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                  {linkError}
                </div>
              )}

              {linkSuccess && (
                <div className="p-2.5 bg-green-50 text-green-700 text-xs rounded-lg border border-green-200">
                  ABHA successfully linked! Starting consent flow...
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsLinkAbhaOpen(false)}
                  className="px-3 py-1.5 border border-border rounded-lg text-xs font-mono uppercase tracking-wider text-slate hover:bg-panel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkLoading}
                  className="px-4 py-1.5 bg-blue text-white rounded-lg text-xs font-mono uppercase tracking-wider font-bold hover:bg-blue/90 disabled:opacity-50"
                >
                  {linkLoading ? "Linking..." : "Confirm & Link ABHA"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}