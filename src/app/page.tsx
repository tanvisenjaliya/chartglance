import { getOpdQueue } from "@/lib/records";

export default function HomePage() {
  const queue = getOpdQueue();
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
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue flex items-center justify-center font-bold text-lg text-white">
              CG
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-surface">
                ChartGlance
              </h1>
              <p className="text-xs text-slate tracking-wide">
                Primary Health Centre (PHC) OPD · Clinical Assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-wider px-3 py-1 rounded-full border border-slate/40 text-slate bg-navy/60">
              SIMULATED ABDM FLOW
            </span>
            <span className="text-xs text-slate font-mono">
              {currentDateFormatted}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Session Header Card */}
        <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-blue tracking-wider uppercase">
                  OPD QUEUE
                </span>
                <span className="text-slate text-xs">•</span>
                <span className="text-xs text-navy-muted">
                  Consultation Room 1 · Medical Officer
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-navy mt-1">
                Today&apos;s Patient Queue
              </h2>
              <p className="text-sm text-navy-muted mt-1">
                {queue.length} registered patients waiting for consultation.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-panel px-4 py-2.5 rounded-xl border border-border">
              <span className="w-2.5 h-2.5 rounded-full bg-blue animate-pulse" />
              <span className="text-xs font-mono font-medium text-navy-muted uppercase tracking-wider">
                Milestone 1 Active · Persona 1 Loaded
              </span>
            </div>
          </div>

          {/* Prototype Milestone 1 Notice */}
          <div className="mt-4 pt-4 border-t border-border flex items-start gap-3 text-xs text-navy-muted">
            <span className="font-mono font-semibold text-blue px-2 py-0.5 rounded bg-panel border border-border shrink-0">
              M1 STATUS
            </span>
            <p>
              FHIR R4 Bundle for <strong>Persona 1</strong> (Ramesh Patel) is loaded with NRCeS ABDM profiles and relative date offsets. Clinical values marked with <code className="font-mono font-bold text-navy bg-panel px-1 py-0.5 rounded border border-border">TODO-VERIFY</code> for clinical review. Consent flow, rules engine, and AI summary are deferred to subsequent milestones.
            </p>
          </div>
        </div>

        {/* OPD Queue List */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-panel/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-navy">
                Queue Entries ({queue.length})
              </h3>
            </div>
            <span className="text-xs font-mono text-slate uppercase">
              Order: Token Sequence
            </span>
          </div>

          <div className="divide-y divide-border">
            {queue.map((patient) => {
              const isPersona1 = patient.id === "p1";

              return (
                <div
                  key={patient.id}
                  className={`p-6 transition-colors ${
                    isPersona1 ? "bg-panel/20 hover:bg-panel/40" : "hover:bg-panel/10"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Token & Patient Demographics */}
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-panel border border-border text-navy">
                        <span className="font-mono text-xs uppercase tracking-wider text-slate">
                          TOKEN
                        </span>
                        <span className="font-mono text-sm font-bold text-navy">
                          {patient.tokenNumber.replace("OPD-", "")}
                        </span>
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-bold text-navy tracking-tight">
                            {patient.name}
                          </h4>
                          <span className="text-sm font-medium text-navy-muted">
                            {patient.age} yrs · {patient.gender}
                          </span>
                          {isPersona1 && (
                            <span className="font-mono text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue text-white">
                              DEMO PERSONA 1
                            </span>
                          )}
                        </div>

                        {/* ABHA details */}
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
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

                        {/* Notes / Clinical purpose */}
                        {patient.notes && (
                          <p className="mt-2 text-xs text-slate italic">
                            {patient.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Data Status Badges */}
                    <div className="flex items-center gap-3 lg:self-center shrink-0">
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
            })}
          </div>
        </div>

        {/* Persona 1 FHIR Bundle Inspection Panel (Milestone 1 Verification) */}
        <section className="mt-8 bg-surface rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue uppercase tracking-wider">
                  FHIR R4 INSPECTOR
                </span>
                <span className="text-slate text-xs">•</span>
                <span className="text-xs text-navy-muted">NRCeS ABDM Profiles</span>
              </div>
              <h3 className="text-lg font-bold text-navy mt-0.5">
                Persona 1 FHIR Bundle Structure
              </h3>
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
              <p className="font-medium text-navy">CHC Shirur (HIP-MH-PUN-001)</p>
              <p className="font-medium text-navy">PHC Mandavgan (HIP-MH-PUN-042)</p>
              <span className="text-slate text-[11px] mt-1 block">Federated mock ABDM facilities</span>
            </div>

            <div className="p-4 rounded-xl bg-panel border border-border">
              <span className="font-mono uppercase font-semibold text-slate block mb-1">
                OBSERVATIONS &amp; TRENDS (TODO-VERIFY)
              </span>
              <p className="font-medium text-navy">HbA1c: 7.8% &rarr; 8.4% &rarr; 9.2% (9 mo)</p>
              <p className="font-medium text-navy">BP: 142/90 &rarr; 150/94 &rarr; 182/112</p>
              <span className="text-slate text-[11px] mt-1 block">Negative day offsets: -270d, -180d, -90d</span>
            </div>

            <div className="p-4 rounded-xl bg-panel border border-border">
              <span className="font-mono uppercase font-semibold text-slate block mb-1">
                FOLLOW-UP STATUS (TODO-VERIFY)
              </span>
              <p className="font-medium text-navy">Scheduled: -30 days ago</p>
              <p className="font-medium text-navy">Status: No-show / Overdue</p>
              <span className="text-slate text-[11px] mt-1 block">Triggers overdue flag in Milestone 3</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-border bg-surface py-6 text-center text-xs text-slate font-mono">
        <p>ChartGlance · Ayushman Bharat Digital Mission (ABDM) Clinical Queue Prototype</p>
        <p className="mt-1 text-[11px] text-navy-muted">
          Synthetic data only · Dates stored as dynamic offsets relative to runtime
        </p>
      </footer>
    </div>
  );
}
