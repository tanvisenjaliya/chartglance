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
    id: "P01",
    name: "Persona 1: Ramesh Patel (52M)",
    fileName: "P01.json",
    condition: "Type 2 Diabetes Mellitus & Hypertension",
    highlights: [
      "HbA1c trend rising: 7.8% -> 8.4% -> 9.2%",
      "Blood Pressure: 142/90 -> 150/94 -> 182/112 mmHg",
      "Current Rx: Metformin 500mg BD, Amlodipine 5mg OD",
      "Overdue 30-day review for BP and blood sugar",
      "Overdue annual diabetic eye examination",
      "Missing kidney function tests (eGFR / Serum Creatinine)",
    ],
  },
  {
    id: "P02",
    name: "Persona 2: Hetal Parmar (24F)",
    fileName: "P02.json",
    condition: "Pregnancy (~22 weeks, 2nd Trimester)",
    highlights: [
      "Severe anaemia in pregnancy: Hb dropped to 6.8 g/dL (< 7.0 g/dL threshold)",
      "Baseline ANC Hb: 9.8 g/dL; later visit: 8.2 g/dL with IFA prescribed",
      "Tetanus-diphtheria (Td) vaccine dose 1 administered",
      "Scheduled upcoming ANC follow-up review visit",
    ],
  },
  {
    id: "P03",
    name: "Persona 3: Shankar Meena (38M)",
    fileName: "P03.json",
    condition: "Pulmonary Tuberculosis (Treatment Gap)",
    highlights: [
      "Diagnosed with pulmonary tuberculosis in Rajasthan (CHC Kherwara)",
      "Initial weight: 52 kg; on 4FDC HRZE regimen",
      "Discontinued medicine pick-ups with a 28-day gap (exceeds 14-day threshold)",
      "Cross-state ABHA health records federation demonstration",
    ],
  },
  {
    id: "P04",
    name: "Persona 4: Manjula Rathod (45F)",
    fileName: "P04.json",
    condition: "Sparse Record History (Single Old Record)",
    highlights: [
      "Has active ABHA with only a single historical record from 3 years ago",
      "Prescription record for mild osteoarthritis (Paracetamol 500mg)",
      "Demonstrates normal primary care scenario: digital records exist but sparse",
    ],
  },
  {
    id: "P05",
    name: "Persona 5: Kantilal Shah (60M)",
    fileName: "P05.json",
    condition: "Medication Conflict & Unstructured PDF",
    highlights: [
      "Conflicting sulfonylureas: Glimepiride from CHC Petlad & Gliclazide from General Hospital Anand",
      "Both prescribed within 90 days across two facilities",
      "Unstructured scanned cardiology discharge summary PDF",
    ],
  },
];

export default function DevPage() {
  const [selectedPersonaId, setSelectedPersonaId] = useState("P01");

  const selectedMeta =
    PERSONAS.find((p) => p.id === selectedPersonaId) || PERSONAS[0];

  const handleSelect = (p: PersonaMeta) => {
    setSelectedPersonaId(p.id);
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
              FHIR R4 INSPECTOR &bull; PHC NAVLI
            </span>
          </div>

          <span className="font-mono text-xs uppercase tracking-wider px-3 py-1 rounded-full border border-slate/40 text-slate bg-navy/60">
            DEVELOPER CONSOLE
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">
            Synthetic Personas &amp; FHIR Bundles
          </h1>
          <p className="text-sm text-navy-muted mt-1">
            Inspect NRCeS ABDM compliant document bundles with dynamically resolved dates and clinically verified test personas.
          </p>
        </div>

        {/* Persona Selector Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {PERSONAS.map((p) => {
            const isSelected = p.id === selectedPersonaId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? "bg-surface border-blue shadow-sm ring-2 ring-blue"
                    : "bg-surface border-border hover:border-slate/50 hover:bg-panel/40"
                }`}
              >
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-blue block">
                  {p.id}
                </span>
                <span className="text-sm font-bold text-navy mt-1 block truncate">
                  {p.name.replace(/Persona \d: /, "")}
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
              KEY CLINICAL ELEMENTS
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

        {/* Action to Test in Consultation View */}
        <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm flex items-center justify-between text-xs">
          <span className="text-navy-muted">
            Test consent request and composition delivery for this persona:
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
