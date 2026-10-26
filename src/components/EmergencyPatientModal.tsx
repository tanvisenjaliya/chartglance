"use client";

import { useState } from "react";
import { PatientQueueItem } from "@/lib/records";

interface EmergencyPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPatient: (patient: PatientQueueItem, position: "top" | "middle") => void;
}

export default function EmergencyPatientModal({
  isOpen,
  onClose,
  onAddPatient,
}: EmergencyPatientModalProps) {
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState<"Male" | "Female" | "Other">("Male");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [hasAbha, setHasAbha] = useState<boolean>(false);
  const [position, setPosition] = useState<"top" | "middle">("top");

  if (!isOpen) return null;

  const quickComplaints = [
    "Acute Chest Pain / Angina",
    "Severe Breathlessness (SpO2 < 90%)",
    "High Fever & Febrile Convulsion",
    "Trauma & Deep Bleeding Laceration",
    "Severe Dehydration / Syncope",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || age === "") return;

    const fakeAbhaSuffix = Math.floor(1000 + Math.random() * 9000);
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");

    const newPatient: PatientQueueItem = {
      id: `emg-${Date.now()}`,
      tokenNumber: "OPD-EMG",
      name: name.trim(),
      age: Number(age),
      gender: gender,
      abhaNumber: hasAbha
        ? `91-5555-8888-${fakeAbhaSuffix}`
        : "Unregistered (Emergency Walk-in)",
      abhaAddress: hasAbha ? `${slug || "patient"}@sbx` : "None (Emergency Walk-in)",
      abhaStatus: hasAbha ? "LINKED" : "UNLINKED",
      arrivalTime: new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      visitType: "Emergency Triage",
      chiefComplaint: chiefComplaint.trim() || "Acute clinical distress requiring urgent review",
      dataStatus: hasAbha ? "Records Available" : "No Linked Records",
      recordCount: 0,
      hasRecords: false,
      isEmergency: true,
      notes: "Emergency walk-in triage patient added directly to OPD queue",
    };

    onAddPatient(newPatient, position);
    onClose();

    // Reset form
    setName("");
    setAge("");
    setGender("Male");
    setChiefComplaint("");
    setHasAbha(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Modal Header */}
        <div className="bg-severity-critical-bg border-b border-severity-critical-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-sm shrink-0">
              !
            </span>
            <div>
              <span className="font-mono text-[10px] font-bold text-brand-red uppercase tracking-wider block">
                TRIAGE ASSISTANCE · URGENT CARE
              </span>
              <h3 className="text-base font-extrabold text-navy">
                Insert Emergency Patient
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-navy-muted hover:text-navy text-lg font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-navy-muted">
            Rapidly triage and inject a walk-in or critical patient directly into today&apos;s OPD queue.
          </p>

          {/* Name & Age */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-mono font-semibold uppercase text-slate mb-1">
                Patient Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Shakuntala Bai"
                className="w-full text-xs p-2.5 rounded-xl border border-border bg-panel/30 text-navy focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold uppercase text-slate mb-1">
                Age (Yrs) *
              </label>
              <input
                type="number"
                required
                min={0}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g. 58"
                className="w-full text-xs p-2.5 rounded-xl border border-border bg-panel/30 text-navy focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue"
              />
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-mono font-semibold uppercase text-slate mb-1">
              Sex
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["Male", "Female", "Other"] as const).map((g) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => setGender(g)}
                  className={`py-2 text-xs font-mono rounded-xl border transition-colors ${
                    gender === g
                      ? "bg-navy text-surface border-navy font-bold"
                      : "bg-panel text-navy-muted border-border hover:bg-border/60"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Chief Complaint & Quick Chips */}
          <div>
            <label className="block text-xs font-mono font-semibold uppercase text-slate mb-1">
              Chief Complaint / Triage Presentation *
            </label>
            <input
              type="text"
              required
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="e.g. Severe chest tightness radiating to left arm"
              className="w-full text-xs p-2.5 rounded-xl border border-border bg-panel/30 text-navy focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue"
            />

            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickComplaints.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setChiefComplaint(item)}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-panel hover:bg-border/70 text-navy-muted border border-border text-left"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* ABHA Status & Queue Placement */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
            <div>
              <label className="block text-xs font-mono font-semibold uppercase text-slate mb-1">
                ABHA Status
              </label>
              <select
                value={hasAbha ? "linked" : "unlinked"}
                onChange={(e) => setHasAbha(e.target.value === "linked")}
                className="w-full text-xs p-2 rounded-xl border border-border bg-panel/30 text-navy focus:outline-none"
              >
                <option value="unlinked">Walk-in (No ABHA)</option>
                <option value="linked">Has ABHA Card</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold uppercase text-slate mb-1">
                Queue Placement
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as "top" | "middle")}
                className="w-full text-xs p-2 rounded-xl border border-border bg-panel/30 text-navy focus:outline-none"
              >
                <option value="top">Top of Queue (Priority 1)</option>
                <option value="middle">Middle of Queue</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-xs font-mono text-slate hover:bg-panel transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-brand-red hover:bg-brand-red/90 text-surface text-xs font-mono font-bold tracking-wider uppercase transition-colors shadow-sm flex items-center gap-2"
            >
              <span>+ Insert Urgent Patient</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
