"use client";

import { PatientQueueItem } from "@/lib/queue-utils";

export type FilterType =
  | "all"
  | "emergency"
  | "infants-seniors"
  | "infants"
  | "seniors"
  | "male"
  | "female"
  | "other-gender";

interface KpiBarProps {
  patients: PatientQueueItem[];
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export function isInfant(age: string | number): boolean {
  if (typeof age === "number") return age < 1;
  const str = String(age).toLowerCase().trim();
  if (
    str.includes("m") ||
    str.includes("mo") ||
    str.includes("month") ||
    str.includes("d") ||
    str.includes("day")
  ) {
    return true;
  }
  const parsed = parseFloat(str);
  return !isNaN(parsed) && parsed < 1;
}

export function isSenior(age: string | number): boolean {
  if (typeof age === "number") return age >= 60;
  const str = String(age).toLowerCase().trim();
  if (
    str.includes("m") ||
    str.includes("mo") ||
    str.includes("month") ||
    str.includes("d") ||
    str.includes("day")
  ) {
    return false;
  }
  const parsed = parseFloat(str);
  return !isNaN(parsed) && parsed >= 60;
}

function isEmergencyPatient(p: PatientQueueItem): boolean {
  return (
    Boolean(p.isEmergency) ||
    p.visitType === "Emergency" ||
    Boolean(p.tokenNumber && p.tokenNumber.startsWith("E"))
  );
}

export default function KpiBar({
  patients,
  activeFilter,
  onFilterChange,
}: KpiBarProps) {
  // ── Card 1: Total Today ── counts ALL patients
  const total = patients.length;
  const waitingCount = patients.filter((p) => p.queueStatus === "Waiting").length;
  const inConsultCount = patients.filter((p) => p.queueStatus === "In consultation").length;
  const doneCount = patients.filter((p) => p.queueStatus === "Done").length;

  // ── Cards 2-4: active queue only (Waiting + In consultation)
  const activeQueue = patients.filter(
    (p) => p.queueStatus === "Waiting" || p.queueStatus === "In consultation"
  );

  // M : F
  const mCount = activeQueue.filter((p) => p.gender === "Male" || p.gender === "M").length;
  const fCount = activeQueue.filter((p) => p.gender === "Female" || p.gender === "F").length;
  const oCount = activeQueue.filter((p) => p.gender === "Other" || p.gender === "O").length;

  // Infants & Seniors
  const infantCount = activeQueue.filter((p) => isInfant(p.age)).length;
  const seniorCount = activeQueue.filter((p) => isSenior(p.age)).length;

  // Emergencies
  const activeEmergencyCount = activeQueue.filter(isEmergencyPatient).length;
  const doneEmergencyCount = patients
    .filter((p) => p.queueStatus === "Done")
    .filter(isEmergencyPatient).length;

  // ── Active filter states
  const isTotalActive = activeFilter === "all";
  const isGenderActive =
    activeFilter === "male" || activeFilter === "female" || activeFilter === "other-gender";
  const isAgeActive =
    activeFilter === "infants-seniors" ||
    activeFilter === "infants" ||
    activeFilter === "seniors";
  const isEmergencyActive = activeFilter === "emergency";

  // ── Shared card base classes
  const baseCard =
    "flex flex-col gap-2 p-4 rounded-2xl border text-left transition-all cursor-pointer select-none";
  const normalCard = "bg-surface border-border hover:border-slate/50 hover:bg-panel/40";
  const activeCard = "bg-surface border-blue shadow-sm ring-2 ring-blue/20";

  // ── Infants · Seniors detail line (correct singular/plural)
  const infantLabel = infantCount === 1 ? "infant" : "infants";
  const seniorLabel = seniorCount === 1 ? "senior" : "seniors";

  // ── Emergency detail line
  const emergencyDetail =
    activeEmergencyCount === 0 && doneEmergencyCount === 0
      ? "None today"
      : `${doneEmergencyCount} seen today`;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

      {/* ── Card 1: Total Today ── */}
      <button
        type="button"
        onClick={() => onFilterChange("all")}
        className={`${baseCard} ${isTotalActive ? activeCard : normalCard}`}
      >
        <span className="font-mono text-xs uppercase tracking-wider text-slate truncate">
          Total today
        </span>
        <span className="text-3xl font-semibold text-navy leading-none">
          {total}
        </span>
        <span className="text-sm text-slate">
          {waitingCount} waiting &middot; {inConsultCount} in consult &middot; {doneCount} done
        </span>
      </button>

      {/* ── Card 2: M : F ── */}
      <button
        type="button"
        onClick={() => {
          if (activeFilter === "male") onFilterChange("female");
          else if (activeFilter === "female") onFilterChange("all");
          else onFilterChange("male");
        }}
        className={`${baseCard} ${isGenderActive ? activeCard : normalCard}`}
      >
        <span className="font-mono text-xs uppercase tracking-wider text-slate truncate">
          M : F
        </span>
        <span className="text-3xl font-semibold text-navy leading-none">
          {mCount} : {fCount}
        </span>
        <span className="text-sm text-slate">
          {mCount} male &middot; {fCount} female
          {oCount > 0 ? ` · ${oCount} other` : ""}
        </span>
      </button>

      {/* ── Card 3: Infants · Seniors ── */}
      <button
        type="button"
        onClick={() =>
          onFilterChange(isAgeActive ? "all" : "infants-seniors")
        }
        className={`${baseCard} ${isAgeActive ? activeCard : normalCard}`}
      >
        <span className="font-mono text-xs uppercase tracking-wider text-slate truncate">
          Infants &middot; Seniors
        </span>
        <span className="text-3xl font-semibold text-navy leading-none">
          {infantCount} | {seniorCount}
        </span>
        <span className="text-sm text-slate">
          {infantCount} {infantLabel} | {seniorCount} {seniorLabel}
        </span>
      </button>

      {/* ── Card 4: Emergencies ── */}
      <button
        type="button"
        onClick={() => onFilterChange(isEmergencyActive ? "all" : "emergency")}
        className={`${baseCard} ${
          activeEmergencyCount > 0
            ? isEmergencyActive
              ? "bg-[#FDE8EA] border-[#F8CED3] ring-2 ring-brand-red/30 shadow-sm"
              : "bg-[#FDE8EA] border-[#F8CED3] hover:border-brand-red"
            : isEmergencyActive
            ? activeCard
            : normalCard
        }`}
      >
        <span
          className={`font-mono text-xs uppercase tracking-wider truncate ${
            activeEmergencyCount > 0 ? "text-brand-red" : "text-slate"
          }`}
        >
          Emergencies
        </span>
        <span
          className={`text-3xl font-semibold leading-none ${
            activeEmergencyCount > 0 ? "text-brand-red" : "text-navy"
          }`}
        >
          {activeEmergencyCount}
        </span>
        <span
          className={`text-sm ${
            activeEmergencyCount > 0 ? "text-[#7A0F1C]" : "text-slate"
          }`}
        >
          {emergencyDetail}
        </span>
      </button>
    </div>
  );
}
