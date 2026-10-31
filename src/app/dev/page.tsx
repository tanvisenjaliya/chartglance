"use client";

import { useState } from "react";
import Link from "next/link";

interface PersonaMeta {
  id: string;
  name: string;
  fileName: string;
  condition: string;
  highlights: string[];
}

const PERSONAS: PersonaMeta[] = [
  {
    id: "p1",
    name: "Persona 1: Ramesh Patel (52M)",
    fileName: "persona-1.json",
    condition: "Type 2 Diabetes & Hypertension",
    highlights: [
      "HbA1c rising: 7.8% -> 8.4% -> 9.2% (-270d, -180d, -90d)",
      "Blood Pressure: 142/90 -> 150/94 -> 182/112 mmHg",
      "Medications: Metformin, Glimepiride, Telmisartan",
      "Follow-up review overdue by 30 days (-30d)",
      "Annual eye check-up overdue by 60 days (-60d)",
      "No kidney function test on record",
    ],
  },
  {
    id: "p2",
    name: "Persona 2: Sunita Sharma (24F)",
    fileName: "persona-2.json",
    condition: "Pregnancy (~22 weeks, 2nd Trimester)",
    highlights: [
      "ANC Registration at PHC Mandavgan (-100d): Hb 9.8 g/dL",
      "Td vaccine dose 1 administered (-90d)",
      "ANC Visit at CHC Shirur (-40d): Hb 8.2 g/dL, IFA prescribed",
      "Lab report at CHC Shirur (-10d): Hb 6.8 g/dL (Severe Anaemia < 7 g/dL)",
      "Next ANC visit due in 5 days (+5d)",
    ],
  },
  {
    id: "p3",
    name: "Persona 3: Vikas Jadhav (38M)",
    fileName: "persona-3.json",
    condition: "Pulmonary Tuberculosis",
    highlights: [
      "Diagnosis at CHC Shirur (-120d): CBNAAT positive, Rifampicin-sensitive",
      "Baseline weight: 52 kg (-120d)",
      "TB treatment started (-118d): 4FDC HRZE regimen",
      "Medicine pick-ups: -118d, -88d, -58d (30 days supply each)",
      "Weight gain at -58d: 54 kg (+2 kg)",
      "Next medicine pick-up overdue by 28 days (TB treatment gap > 14d)",
    ],
  },
  {
    id: "p5",
    name: "Persona 5: Anand Verma (60M)",
    fileName: "persona-5.json",
    condition: "Type 2 Diabetes Mellitus",
    highlights: [
      "OP consult at CHC Shirur (-60d): Glimepiride 1 mg OD prescribed",
      "HbA1c test at CHC Shirur (-60d): 7.6%",
      "OP consult at Aundh District Hospital (-45d): Gliclazide 40 mg OD prescribed",
      "Conflicting sulfonylureas across 2 facilities within 90 days",
      "Scanned discharge summary PDF from Ruby Hall Clinic (-200d) with no structured data",
    ],
  },
];

export default function DevPage() {
  const [selectedPersonaId, setSelectedPersonaId] = useState("p1");
  const [bundleData, setBundleData] = useState<Record<string, unknown> | null>(null);
  const [_loading, setLoading] = useState(false);

  const selectedMeta = PERSONAS.find((p) => p.id === selectedPersonaId) || PERSONAS[0];

  const loadBundle = async (fileName: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/data/records/${fileName}`);
      if (res.ok) {
        const data = await res.json();
        setBundleData(data);
      } else {
        // Fallback fetch via API
        const apiRes = await fetch(`/api/abdm/consent/${selectedPersonaId}`);
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          setBundleData(apiData.recordsData);
        }
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (p: PersonaMeta) => {
    setSelectedPersonaId(p.id);
    loadBundle(p.fileName);
  };

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
            NRCeS ABDM PROFILES
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
              FHIR R4 Bundles &amp; Clinical Data Verification
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-navy mt-1">
            Persona FHIR R4 Bundle Inspector
          </h1>
          <p className="text-sm text-navy-muted mt-1">
            Inspect NRCeS ABDM compliant document bundles with relative day offsets and placeholder clinical values (TODO-VERIFY).
          </p>
        </div>

        {/* Persona Selector Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PERSONAS.map((p) => {
            const isSelected = p.id === selectedPersonaId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "bg-surface border-blue shadow-sm ring-1 ring-blue"
                    : "bg-surface border-border hover:bg-panel/40"
                }`}
              >
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate block truncate">
                  {p.fileName}
                </span>
                <span className="font-bold text-xs text-navy mt-1 block truncate">
                  {p.name}
                </span>
                <span className="text-[11px] text-navy-muted mt-0.5 block truncate">
                  {p.condition}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Persona Details */}
        <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-2">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-blue font-semibold">
                ACTIVE BUNDLE
              </span>
              <h2 className="text-lg font-bold text-navy mt-0.5">
                {selectedMeta.name}
              </h2>
            </div>
            <span className="font-mono text-xs px-3 py-1 rounded-full bg-panel border border-border text-navy-muted">
              data/records/{selectedMeta.fileName}
            </span>
          </div>

          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-slate block mb-2 font-semibold">
              KEY CLINICAL ELEMENTS (MARKED TODO-VERIFY)
            </span>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {selectedMeta.highlights.map((item, idx) => (
                <li
                  key={idx}
                  className="p-3 rounded-xl bg-panel/40 border border-border flex items-start gap-2"
                >
                  <span className="text-blue font-bold">&bull;</span>
                  <span className="text-navy">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Fast Action to Test in Consultation View */}
        <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm flex items-center justify-between text-xs">
          <span className="text-navy-muted">
            Test consent request and raw record delivery for this persona:
          </span>
          <Link
            href={`/patient/${selectedMeta.id}`}
            className="px-4 py-2 rounded-xl bg-blue hover:bg-blue/90 text-white font-mono text-xs uppercase tracking-wider font-semibold transition-colors"
          >
            Open Patient View &rarr;
          </Link>
        </div>
      </main>
    </div>
  );
}
