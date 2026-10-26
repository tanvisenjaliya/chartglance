import Link from "next/link";
import { getPatientRecordBundle } from "@/lib/records";

export default function DevPage() {
  const persona1Bundle = getPatientRecordBundle("persona-1.json");

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
              DEV INSPECTOR
            </span>
          </div>

          <span className="font-mono text-xs uppercase tracking-wider px-3 py-1 rounded-full border border-slate/40 text-slate bg-navy/60">
            SIMULATED ABDM FLOW
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Title */}
        <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-blue font-semibold">
              DEVELOPER TOOLS
            </span>
            <span className="text-slate text-xs">&bull;</span>
            <span className="text-xs text-navy-muted">
              FHIR R4 Bundle Validation
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-navy mt-1">
            Persona 1 FHIR R4 Bundle Inspector
          </h1>
          <p className="text-sm text-navy-muted mt-1">
            NRCeS ABDM compliant document bundle with relative day offsets and placeholder clinical values.
          </p>
        </div>

        {/* Profile Architecture Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm">
            <span className="font-mono text-xs uppercase tracking-wider text-slate block mb-1">
              FACILITIES LINKED
            </span>
            <p className="font-medium text-navy">CHC Shirur (HIP-MH-PUN-001)</p>
            <p className="font-medium text-navy">PHC Mandavgan (HIP-MH-PUN-042)</p>
            <span className="text-slate text-xs mt-2 block">
              Federated mock HIP facilities per ABDM architecture
            </span>
          </div>

          <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm">
            <span className="font-mono text-xs uppercase tracking-wider text-slate block mb-1">
              OBSERVATIONS &amp; TRENDS (TODO-VERIFY)
            </span>
            <p className="font-medium text-navy">HbA1c: 7.8% &rarr; 8.4% &rarr; 9.2% (9 mo)</p>
            <p className="font-medium text-navy">BP: 142/90 &rarr; 150/94 &rarr; 182/112</p>
            <span className="text-slate text-xs mt-2 block">
              Stored as day offsets: -270d, -180d, -90d
            </span>
          </div>

          <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm">
            <span className="font-mono text-xs uppercase tracking-wider text-slate block mb-1">
              FOLLOW-UP STATUS (TODO-VERIFY)
            </span>
            <p className="font-medium text-navy">Scheduled: -30 days ago</p>
            <p className="font-medium text-navy">Status: No-show / Overdue</p>
            <span className="text-slate text-xs mt-2 block">
              Triggers overdue follow-up flag in Milestone 3
            </span>
          </div>
        </div>

        {/* Raw JSON viewer */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-panel/50 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-navy font-semibold">
              RAW FHIR R4 JSON BUNDLE (data/records/persona-1.json)
            </span>
            <span className="text-xs text-slate">
              {persona1Bundle?.entry?.length || 0} Resource Entries
            </span>
          </div>
          <div className="p-6 bg-navy text-surface overflow-x-auto max-h-[500px]">
            <pre className="text-xs font-mono leading-relaxed text-slate-200">
              {JSON.stringify(persona1Bundle, null, 2)}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}
