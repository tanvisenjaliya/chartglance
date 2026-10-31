"use client";

import { useState } from "react";
import { PatientQueueItem } from "@/lib/queue-utils";

interface EmergencyPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPatientAdded: (patient: PatientQueueItem) => void;
}

export default function EmergencyPatientModal({
  isOpen,
  onClose,
  onPatientAdded,
}: EmergencyPatientModalProps) {
  const [activeTab, setActiveTab] = useState<"has-abha" | "no-abha">("has-abha");

  // Common field
  const [reason, setReason] = useState("");

  // Path 1: Has ABHA
  const [identifier, setIdentifier] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [lookedUpPatient, setLookedUpPatient] = useState<{
    id?: string;
    name: string;
    age: string | number;
    gender: "Male" | "Female" | "Other";
    abhaNumber: string;
    abhaAddress: string;
    recordCount?: number;
    hasRecords?: boolean;
  } | null>(null);

  // Path 2: No ABHA
  const [manualName, setManualName] = useState("");
  const [manualAge, setManualAge] = useState("");
  const [manualGender, setManualGender] = useState<"Male" | "Female" | "Other">("Male");
  const [manualMobile, setManualMobile] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  if (!isOpen) return null;

  const handleLookup = async () => {
    if (!identifier.trim()) {
      setLookupError("Enter an ABHA number or ABHA address to lookup");
      return;
    }
    setLookupLoading(true);
    setLookupError("");
    try {
      const res = await fetch(`/api/abdm/lookup?identifier=${encodeURIComponent(identifier.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.error || "Patient not found in registry");
        setLookedUpPatient(null);
      } else {
        setLookedUpPatient({
          id: data.id,
          name: data.name,
          age: data.age,
          gender: data.gender === "M" ? "Male" : data.gender === "F" ? "Female" : data.gender,
          abhaNumber: data.abhaNumber,
          abhaAddress: data.abhaAddress,
          recordCount: data.recordCount,
          hasRecords: data.hasRecords,
        });
      }
    } catch {
      setLookupError("Network error during ABHA lookup");
      setLookedUpPatient(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleApplyPreset = (nameText: string, ageVal: string, genderVal: "Male" | "Female" | "Other") => {
    setManualName(nameText);
    setManualAge(ageVal);
    setManualGender(genderVal);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!reason.trim()) {
      setSubmitError("Please enter a short reason for emergency");
      return;
    }

    if (activeTab === "has-abha") {
      if (!lookedUpPatient) {
        setSubmitError("Please lookup and select an ABHA patient first");
        return;
      }
    } else {
      if (!manualName.trim()) {
        setSubmitError("Please enter a patient name or select an 'Unknown' preset");
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload =
        activeTab === "has-abha"
          ? {
              hasAbha: true,
              abhaNumber: lookedUpPatient?.abhaNumber,
              abhaAddress: lookedUpPatient?.abhaAddress,
              name: lookedUpPatient?.name,
              age: lookedUpPatient?.age,
              gender: lookedUpPatient?.gender,
              emergencyReason: reason.trim(),
            }
          : {
              hasAbha: false,
              name: manualName.trim(),
              age: manualAge.trim() || "Unknown",
              gender: manualGender,
              mobileNumber: manualMobile.trim() || undefined,
              emergencyReason: reason.trim(),
            };

      const res = await fetch("/api/patients/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Failed to admit emergency patient");
        return;
      }

      onPatientAdded(data.patient);
      onClose();
    } catch {
      setSubmitError("Network error while creating emergency admission");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl border-2 border-red-500 shadow-2xl max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
            <h2 className="text-base font-bold tracking-wide uppercase">
              Emergency Patient Intake
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white text-xl font-bold p-1 leading-none"
          >
            &times;
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-border bg-panel/60 p-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("has-abha")}
            className={`flex-1 py-2 px-3 text-xs font-mono uppercase tracking-wider font-semibold rounded-lg transition-all ${
              activeTab === "has-abha"
                ? "bg-surface text-red-600 shadow-sm border border-red-200"
                : "text-slate hover:text-navy hover:bg-surface/50"
            }`}
          >
            Path 1: Has ABHA
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("no-abha")}
            className={`flex-1 py-2 px-3 text-xs font-mono uppercase tracking-wider font-semibold rounded-lg transition-all ${
              activeTab === "no-abha"
                ? "bg-surface text-red-600 shadow-sm border border-red-200"
                : "text-slate hover:text-navy hover:bg-surface/50"
            }`}
          >
            Path 2: No ABHA
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Reason for Emergency (Required on both paths) */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-navy font-semibold mb-1">
              Reason for Emergency <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acute chest pain, Road accident trauma, Severe breathlessness"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-50/30 text-navy"
            />
          </div>

          {activeTab === "has-abha" ? (
            /* Path 1: Has ABHA */
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate font-medium mb-1">
                  ABHA Number or Address <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 91-5555-2031-0006 or rahul.verma@sbx"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={lookupLoading}
                    className="px-4 py-2 bg-navy text-white text-xs font-mono uppercase tracking-wider font-semibold rounded-lg hover:bg-navy-muted disabled:opacity-50"
                  >
                    {lookupLoading ? "Looking up..." : "Lookup"}
                  </button>
                </div>
                {lookupError && (
                  <p className="mt-1 text-xs text-red-600">{lookupError}</p>
                )}
                <p className="mt-1 text-[11px] text-slate">
                  Auto-fills demographics and triggers consent request immediately upon entry.
                </p>
              </div>

              {lookedUpPatient && (
                <div className="p-3 bg-panel rounded-xl border border-border space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-slate">
                      Matched Registry Patient
                    </span>
                    <span className="text-xs font-mono font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                      Verified ABHA
                    </span>
                  </div>
                  <div className="text-sm font-bold text-navy">
                    {lookedUpPatient.name}
                  </div>
                  <div className="text-xs text-navy-muted flex gap-3">
                    <span>Age: {lookedUpPatient.age} yrs</span>
                    <span>Sex: {lookedUpPatient.gender}</span>
                    <span className="font-mono">{lookedUpPatient.abhaAddress}</span>
                  </div>
                  <div className="text-xs text-blue">
                    {lookedUpPatient.hasRecords
                      ? `${lookedUpPatient.recordCount} past records will be requested via consent`
                      : "ABHA verified (zero prior records in network)"}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Path 2: No ABHA */
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate font-medium">
                    Patient Name <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate">
                    Allow &quot;Unknown&quot; for unidentified patients
                  </span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel or Unknown male, ~40 yrs"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue"
                />

                {/* Quick preset chips */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleApplyPreset("Unknown male, ~40 yrs", "40", "Male")
                    }
                    className="text-[11px] px-2 py-1 bg-panel hover:bg-border/60 text-navy-muted rounded border border-border"
                  >
                    + Unknown male, ~40 yrs
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleApplyPreset("Unknown female, ~35 yrs", "35", "Female")
                    }
                    className="text-[11px] px-2 py-1 bg-panel hover:bg-border/60 text-navy-muted rounded border border-border"
                  >
                    + Unknown female, ~35 yrs
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleApplyPreset("Unknown elderly, ~65 yrs", "65", "Male")
                    }
                    className="text-[11px] px-2 py-1 bg-panel hover:bg-border/60 text-navy-muted rounded border border-border"
                  >
                    + Unknown elderly, ~65 yrs
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate font-medium mb-1">
                    Approx. Age
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 40"
                    value={manualAge}
                    onChange={(e) => setManualAge(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate font-medium mb-1">
                    Sex
                  </label>
                  <select
                    value={manualGender}
                    onChange={(e) =>
                      setManualGender(e.target.value as "Male" | "Female" | "Other")
                    }
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue bg-surface"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate font-medium mb-1">
                  Mobile Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={manualMobile}
                  onChange={(e) => setManualMobile(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue font-mono"
                />
              </div>

              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
                <span className="font-semibold">Note:</span> Admitted with token E1, E2... No consent or records fetch until ABHA is linked later via the patient file.
              </div>
            </div>
          )}

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg text-xs font-mono uppercase tracking-wider font-semibold text-slate hover:bg-panel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-red-600 text-white rounded-lg text-xs font-mono uppercase tracking-wider font-bold hover:bg-red-700 shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? "Admitting..." : "Admit Emergency Patient \u2192"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
