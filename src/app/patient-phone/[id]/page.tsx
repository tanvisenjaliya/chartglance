"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ConsentRecord } from "@/lib/abdm-mock";
import { PatientQueueItem } from "@/lib/records";

export default function PatientPhonePage() {
  const params = useParams();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<PatientQueueItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load patient info
  useEffect(() => {
    async function loadPatient() {
      try {
        const res = await fetch("/api/patients");
        if (res.ok) {
          const list: PatientQueueItem[] = await res.json();
          const match = list.find((p) => p.id === patientId);
          setPatient(match || null);
        }
      } catch {
        // Handle error
      } finally {
        setLoading(false);
      }
    }
    loadPatient();
  }, [patientId]);

  // Fetch consent status
  const fetchConsent = useCallback(async () => {
    try {
      const res = await fetch(`/api/abdm/consent/${patientId}`);
      if (res.ok) {
        const data = await res.json();
        setConsent(data.consent);
      }
    } catch {
      // Ignore
    }
  }, [patientId]);

  useEffect(() => {
    fetchConsent();
  }, [fetchConsent]);

  // Poll when status is NOT_REQUESTED or REQUESTED to detect new requests from doctor
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConsent();
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchConsent]);

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/abdm/consent/${patientId}/approve`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setConsent(data.consent);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeny = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/abdm/consent/${patientId}/deny`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setConsent(data.consent);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/abdm/consent/${patientId}/reset`, {
        method: "POST",
      });
      if (res.ok) {
        setConsent(null);
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-panel flex items-center justify-center p-6 text-navy">
        <p className="text-xs font-mono">Loading patient app...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-10 px-4 flex flex-col items-center justify-center font-sans">
      {/* Top Warning Banner Required by SPEC Section 8 */}
      <div className="mb-4 text-center">
        <span className="font-mono text-xs uppercase tracking-wider px-3.5 py-1.5 rounded-full border border-amber-400/40 text-amber-300 bg-amber-950/60 font-semibold shadow-sm inline-block">
          SIMULATED PATIENT ABHA APP
        </span>
        <p className="text-xs text-slate-400 mt-1">
          Simulating patient phone view for <strong>{patient?.name || "Patient"}</strong> (<code className="font-mono">{patient?.abhaAddress}</code>)
        </p>
      </div>

      {/* Simulated Smartphone Container */}
      <div className="w-full max-w-sm bg-surface rounded-[36px] border-4 border-slate-700 shadow-2xl overflow-hidden flex flex-col min-h-[640px]">
        {/* Smartphone Status Bar Mock */}
        <div className="bg-navy text-surface px-6 pt-3 pb-2 flex items-center justify-between text-[11px] font-mono">
          <span>09:41</span>
          <div className="w-20 h-4 bg-slate-800 rounded-full mx-auto" />
          <div className="flex items-center gap-1.5">
            <span>5G</span>
            <span>100%</span>
          </div>
        </div>

        {/* ABHA App Header */}
        <div className="bg-navy text-surface px-6 py-4 border-b border-navy-muted/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue flex items-center justify-center font-bold text-sm text-white">
                A
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-white">
                  ABHA PHR App
                </h2>
                <p className="text-[10px] text-slate-300">
                  National Health Authority &bull; ABDM
                </p>
              </div>
            </div>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-navy-muted/50 text-slate-200">
              {patient?.gender?.charAt(0)} &bull; {patient?.age}y
            </span>
          </div>

          <div className="mt-3 pt-2.5 border-t border-navy-muted/40 flex items-center justify-between text-[11px]">
            <span className="text-slate-300">Account:</span>
            <span className="font-mono text-white font-medium">
              {patient?.abhaAddress || "patient@sbx"}
            </span>
          </div>
        </div>

        {/* Smartphone Screen Body */}
        <div className="p-5 flex-1 flex flex-col justify-between space-y-4 text-xs">
          {/* State 1: No Consent Request Active */}
          {(!consent || consent.status === "NOT_REQUESTED") && (
            <div className="my-auto text-center p-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-panel border border-border mx-auto flex items-center justify-center text-slate">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="font-bold text-sm text-navy">
                No Pending Consent Requests
              </h3>
              <p className="text-xs text-navy-muted leading-relaxed">
                When a doctor requests access to your health history at the OPD, the consent authorization will appear right here.
              </p>
              <div className="pt-4 border-t border-border">
                <Link
                  href={`/patient/${patientId}`}
                  className="text-xs font-semibold text-blue hover:underline inline-flex items-center gap-1"
                >
                  &larr; Switch to Doctor&apos;s Screen to Send Request
                </Link>
              </div>
            </div>
          )}

          {/* State 2: REQUESTED -> Active Consent Approval Screen */}
          {consent?.status === "REQUESTED" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Badge */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                  NEW REQUEST RECEIVED
                </span>
                <span className="text-[11px] text-slate font-mono">Just now</span>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-navy">
                  Approve Health Record Access?
                </h3>
                <p className="text-xs text-navy-muted mt-0.5">
                  A registered medical officer is requesting temporary access to your health records.
                </p>
              </div>

              {/* Request Details Card */}
              <div className="bg-panel rounded-2xl border border-border p-4 space-y-3 text-xs">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate block">
                    REQUESTING DOCTOR
                  </span>
                  <p className="font-bold text-navy mt-0.5">
                    {consent.requesterName}
                  </p>
                  <p className="text-[11px] text-navy-muted">
                    {consent.requesterFacility}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/60">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate block">
                    PURPOSE OF ACCESS
                  </span>
                  <p className="font-semibold text-navy mt-0.5">
                    Care Management (CAREMGT)
                  </p>
                </div>

                <div className="pt-2 border-t border-border/60">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate block">
                    RECORDS REQUESTED
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {consent.hiTypes.map((type) => (
                      <span
                        key={type}
                        className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-surface border border-border text-navy"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-slate block">
                      DATA RANGE
                    </span>
                    <span className="font-medium text-navy">Past 3 Years</span>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-slate block">
                      EXPIRY
                    </span>
                    <span className="font-medium text-navy">24 Hours</span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate leading-relaxed">
                Under ABDM, you can revoke access at any time. Records are securely fetched directly from participating hospitals.
              </p>

              {/* Action Buttons: Doctor NEVER has access to these */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl bg-blue hover:bg-blue/90 text-white font-mono text-xs uppercase tracking-wider font-bold transition-colors shadow-md disabled:opacity-50"
                >
                  {actionLoading ? "Granting..." : "Approve & Share Records"}
                </button>

                <button
                  type="button"
                  onClick={handleDeny}
                  disabled={actionLoading}
                  className="w-full py-2.5 rounded-xl border border-brand-red/40 bg-surface hover:bg-red-50 text-brand-red font-mono text-xs uppercase tracking-wider font-semibold transition-colors disabled:opacity-50"
                >
                  Deny Request
                </button>
              </div>
            </div>
          )}

          {/* State 3: GRANTED */}
          {consent?.status === "GRANTED" && (
            <div className="my-auto text-center p-6 space-y-3 animate-in fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center font-bold text-2xl shadow-inner">
                ✓
              </div>
              <h3 className="font-extrabold text-base text-navy">
                Consent Granted
              </h3>
              <p className="text-xs text-navy-muted leading-relaxed">
                Health records have been securely delivered to <strong>{consent.requesterName}</strong> for care management.
              </p>
              <div className="p-3 rounded-xl bg-panel border border-border font-mono text-[11px] text-navy-muted">
                Valid for 24 Hours &bull; ID: {consent.id.slice(-8)}
              </div>

              <div className="pt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleDeny}
                  className="w-full py-2 rounded-xl border border-border text-slate hover:text-brand-red text-xs font-mono transition-colors"
                >
                  Revoke Consent Now
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full py-1.5 text-xs text-slate hover:underline font-mono"
                >
                  Reset for Demo
                </button>
              </div>
            </div>
          )}

          {/* State 4: DENIED */}
          {consent?.status === "DENIED" && (
            <div className="my-auto text-center p-6 space-y-3 animate-in fade-in">
              <div className="w-14 h-14 rounded-full bg-red-100 text-brand-red mx-auto flex items-center justify-center font-bold text-2xl shadow-inner">
                ✕
              </div>
              <h3 className="font-extrabold text-base text-navy">
                Request Denied
              </h3>
              <p className="text-xs text-navy-muted leading-relaxed">
                You denied the consent request. No health records will be shared with the clinic.
              </p>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full py-2 rounded-xl bg-navy text-white text-xs font-mono uppercase tracking-wider font-semibold"
                >
                  Reset Demo State
                </button>
              </div>
            </div>
          )}

          {/* State 5: EXPIRED */}
          {consent?.status === "EXPIRED" && (
            <div className="my-auto text-center p-6 space-y-3 animate-in fade-in">
              <div className="w-14 h-14 rounded-full bg-panel text-slate mx-auto flex items-center justify-center font-bold text-xl">
                ⏳
              </div>
              <h3 className="font-bold text-base text-navy">
                Consent Expired
              </h3>
              <p className="text-xs text-navy-muted leading-relaxed">
                The 24-hour sharing window has closed. All shared records have been automatically locked.
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full py-2 rounded-xl bg-navy text-white text-xs font-mono uppercase tracking-wider font-semibold"
                >
                  Reset Demo State
                </button>
              </div>
            </div>
          )}

          {/* Return to Doctor Consultation Link */}
          <div className="pt-3 border-t border-border text-center">
            <Link
              href={`/patient/${patientId}`}
              className="text-xs text-blue hover:underline font-medium inline-flex items-center gap-1"
            >
              &larr; Switch to Doctor&apos;s OPD Screen
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
