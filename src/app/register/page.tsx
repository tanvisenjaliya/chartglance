"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Common chief complaints for the OPD dropdown
const CHIEF_COMPLAINTS = [
  "Fever and body ache",
  "Cough and cold",
  "Blood pressure check",
  "Diabetes follow-up",
  "Abdominal pain",
  "ANC / maternal care visit",
  "Joint pain",
  "Headache / giddiness",
  "Skin rash or allergy",
  "Medicine refill",
  "General check-up",
  "Chest pain or breathlessness",
  "Eye / ear complaint",
  "Wound dressing",
  "Child vaccination",
  "Other",
];

interface LookedUpPatient {
  id: string;
  name: string;
  age: number;
  gender: string;
  abhaNumber: string;
  abhaAddress: string;
  hasRecords: boolean;
  recordCount: number;
  recordFacilities: string[];
  recordSummary: string;
}

export default function RegisterPatientPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookedUp, setLookedUp] = useState<LookedUpPatient | null>(null);
  const [alreadyInQueue, setAlreadyInQueue] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [customComplaint, setCustomComplaint] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupLoading(true);
    setLookupError(null);
    setLookedUp(null);
    setAlreadyInQueue(false);
    setChiefComplaint("");

    try {
      const res = await fetch("/api/abdm/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (res.ok) {
        setLookedUp(data.patient);
        setAlreadyInQueue(data.alreadyInQueue === true);
      } else {
        setLookupError(
          data.error ||
            "ABHA not found in the mock registry. The patient may not have a linked ABHA account."
        );
      }
    } catch {
      setLookupError("Network error — please try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookedUp) return;
    const complaint =
      chiefComplaint === "Other" ? customComplaint : chiefComplaint;
    if (!complaint.trim()) return;

    setRegistering(true);
    setRegisterError(null);
    try {
      const res = await fetch("/api/patients/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lookedUp.id,
          name: lookedUp.name,
          age: lookedUp.age,
          gender: lookedUp.gender,
          abhaNumber: lookedUp.abhaNumber,
          abhaAddress: lookedUp.abhaAddress,
          hasRecords: lookedUp.hasRecords,
          recordCount: lookedUp.recordCount,
          chiefComplaint: complaint,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/");
      } else {
        setRegisterError(data.error || "Failed to register patient.");
      }
    } catch {
      setRegisterError("Network error — please try again.");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-panel text-navy font-sans">
      {/* Header */}
      <header className="bg-navy text-surface border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-slate hover:text-surface flex items-center gap-1 transition-colors"
            >
              <span>&larr;</span> Back to OPD Queue
            </Link>
            <span className="text-slate text-xs">&bull;</span>
            <span className="font-mono text-xs uppercase tracking-wider text-slate">
              PATIENT REGISTRATION
            </span>
          </div>
          <span className="font-mono text-xs uppercase tracking-wider px-3 py-1 rounded-full border border-slate/40 text-slate bg-navy/60">
            SIMULATED ABDM FLOW
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Page Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">
            Register Patient
          </h1>
          <p className="text-sm text-navy-muted mt-1">
            Enter the patient&apos;s ABHA number or address to look them up in
            the mock ABDM registry, then add them to today&apos;s OPD queue and
            start the consent request.
          </p>
        </div>

        {/* Step 1 — ABHA Lookup */}
        <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider font-semibold text-blue">
              STEP 1 — ABHA LOOKUP
            </span>
            <h2 className="text-lg font-bold text-navy mt-0.5">
              Find patient by ABHA
            </h2>
          </div>

          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <label
                htmlFor="abha-query"
                className="block font-mono text-[11px] uppercase tracking-wider text-slate mb-1.5"
              >
                ABHA Number or ABHA Address
              </label>
              <div className="flex gap-2">
                <input
                  id="abha-query"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. 91-1234-5678-9012 or priya.kadam1@sbx"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-panel text-navy text-sm font-mono placeholder:text-slate/60 focus:outline-none focus:ring-2 focus:ring-blue/40 focus:border-blue"
                  required
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={lookupLoading || !query.trim()}
                  className="px-5 py-2.5 rounded-xl bg-blue hover:bg-blue/90 text-white text-xs font-mono uppercase tracking-wider font-semibold transition-colors disabled:opacity-50 shrink-0"
                >
                  {lookupLoading ? "Searching…" : "Look Up"}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate">
                Format: ABHA number{" "}
                <code className="font-mono">XX-XXXX-XXXX-XXXX</code> or ABHA
                address{" "}
                <code className="font-mono">firstname.lastname[N]@sbx</code>
              </p>
            </div>
          </form>

          {/* Lookup Error */}
          {lookupError && (
            <div className="p-4 rounded-xl border border-dashed border-border-dashed bg-panel/30">
              <p className="text-sm font-semibold text-navy">
                Patient not found
              </p>
              <p className="text-xs text-navy-muted mt-1">{lookupError}</p>
            </div>
          )}

          {/* Lookup Result */}
          {lookedUp && (
            <div className="p-4 rounded-xl border border-border bg-panel/40 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-navy">
                    {lookedUp.name}
                  </p>
                  <p className="text-xs text-navy-muted mt-0.5">
                    {lookedUp.age} yrs &bull; {lookedUp.gender}
                  </p>
                </div>
                {alreadyInQueue ? (
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-800">
                    Already in queue
                  </span>
                ) : (
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-border bg-surface text-slate">
                    Not in queue
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-slate">
                    ABHA NO:{" "}
                  </span>
                  <span className="font-medium text-navy">
                    {lookedUp.abhaNumber}
                  </span>
                </div>
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-slate">
                    ABHA ID:{" "}
                  </span>
                  <span className="text-navy-muted">
                    {lookedUp.abhaAddress}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60">
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate block mb-1">
                  RECORDS SUMMARY
                </span>
                <p className="text-xs text-navy">{lookedUp.recordSummary}</p>
                {lookedUp.recordFacilities.length > 0 && (
                  <p className="text-[11px] text-slate mt-1">
                    Facilities:{" "}
                    {lookedUp.recordFacilities.join(", ")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step 2 — Add to Queue (only shown after successful lookup) */}
        {lookedUp && !alreadyInQueue && (
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider font-semibold text-blue">
                STEP 2 — ADD TO QUEUE
              </span>
              <h2 className="text-lg font-bold text-navy mt-0.5">
                Record chief complaint
              </h2>
              <p className="text-xs text-navy-muted mt-1">
                Select or enter the patient&apos;s presenting complaint. A
                consent request will be sent automatically once they are added.
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label
                  htmlFor="complaint-select"
                  className="block font-mono text-[11px] uppercase tracking-wider text-slate mb-1.5"
                >
                  Chief Complaint
                </label>
                <select
                  id="complaint-select"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-panel text-navy text-sm focus:outline-none focus:ring-2 focus:ring-blue/40 focus:border-blue"
                >
                  <option value="">— Select a complaint —</option>
                  {CHIEF_COMPLAINTS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {chiefComplaint === "Other" && (
                <div>
                  <label
                    htmlFor="custom-complaint"
                    className="block font-mono text-[11px] uppercase tracking-wider text-slate mb-1.5"
                  >
                    Specify Complaint
                  </label>
                  <input
                    id="custom-complaint"
                    type="text"
                    value={customComplaint}
                    onChange={(e) => setCustomComplaint(e.target.value)}
                    placeholder="Describe the chief complaint…"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-panel text-navy text-sm focus:outline-none focus:ring-2 focus:ring-blue/40 focus:border-blue"
                  />
                </div>
              )}

              {registerError && (
                <p className="text-xs font-semibold text-brand-red">
                  {registerError}
                </p>
              )}

              <div className="flex items-center justify-between gap-4 pt-2">
                <p className="text-[11px] text-slate">
                  Patient will be added with token{" "}
                  <strong className="text-navy">next available</strong> and
                  status{" "}
                  <strong className="text-navy">Waiting</strong>.
                </p>
                <button
                  type="submit"
                  disabled={
                    registering ||
                    !chiefComplaint ||
                    (chiefComplaint === "Other" && !customComplaint.trim())
                  }
                  className="px-6 py-2.5 rounded-xl bg-blue hover:bg-blue/90 text-white text-xs font-mono uppercase tracking-wider font-semibold transition-colors disabled:opacity-50 shrink-0"
                >
                  {registering ? "Adding…" : "Add to Queue"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Already in queue notice */}
        {lookedUp && alreadyInQueue && (
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
            <p className="text-sm font-semibold text-navy">
              Already in today&apos;s queue
            </p>
            <p className="text-xs text-navy-muted mt-1">
              {lookedUp.name} is already registered in today&apos;s OPD queue.
              Open their entry from the queue list to manage their consent and
              records.
            </p>
            <Link
              href="/"
              className="inline-block mt-3 text-xs font-semibold text-blue hover:underline"
            >
              &larr; Return to OPD Queue
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

