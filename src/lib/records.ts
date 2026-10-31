import fs from "fs";
import path from "path";

export interface PatientQueueItem {
  id: string;
  tokenNumber: string;
  name: string;
  age: string | number;
  gender: "Male" | "Female" | "Other" | "M" | "F" | "O";
  abhaNumber: string;
  abhaAddress: string;
  arrivalTime: string;
  visitType: "Follow-up" | "New Visit";
  chiefComplaint: string;
  complaint?: string;
  dataStatus: "Records available" | "ABHA, no records";
  recordCount: number;
  hasRecords: boolean;
  recordsFile?: string;
  village?: string;
  district?: string;
  state?: string;
  nativePlace?: string | null;
  facilities?: string[];
  isDemoPersona?: boolean;
  personaNumber?: number | null;
  /** Lifecycle status for the OPD queue. Defaults to "Waiting". */
  queueStatus: "Waiting" | "In consultation" | "Done";
}

export interface FacilityMetadata {
  facilityName: string;
  district: string;
  state: string;
}

/**
 * Resolves all {{today...}} date tokens using the formula from README.md.
 * e.g., {{today}}, {{today-90d}}, {{today+5d}}, {{today-52y}}
 */
export function resolveDates(raw: string): string {
  return raw.replace(/\{\{today(?:([+-]\d+)([dmy]))?\}\}/g, (_, n, u) => {
    const d = new Date();
    if (n) {
      const k = parseInt(n, 10);
      if (u === "d") d.setDate(d.getDate() + k);
      if (u === "m") d.setMonth(d.getMonth() + k);
      if (u === "y") d.setFullYear(d.getFullYear() + k);
    }
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Formats an ISO date into clean clinical display format: e.g. "28 Jul 2026"
 */
export function formatClinicalDate(isoDateStr: string): string {
  try {
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) return isoDateStr;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoDateStr;
  }
}

/**
 * Normalises gender representation for standard display ("Male", "Female", "Other")
 */
export function formatGender(gender: string): "Male" | "Female" | "Other" {
  if (gender === "F" || gender === "Female") return "Female";
  if (gender === "M" || gender === "Male") return "Male";
  return "Other";
}

/**
 * Normalises age display: ensures clean string like "52" or "68"
 */
export function formatAge(age: string | number): string {
  if (typeof age === "number") return `${age}`;
  return age.replace(/[^\d]/g, "") || String(age);
}

/**
 * Reads facility metadata dynamically from data/patients.json
 */
export function getClinicFacility(): FacilityMetadata {
  const filePath = path.join(process.cwd(), "data", "patients.json");
  if (!fs.existsSync(filePath)) {
    return {
      facilityName: "PHC Navli (demo)",
      district: "Anand",
      state: "Gujarat",
    };
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const resolved = JSON.parse(resolveDates(raw));
    return {
      facilityName: resolved.facility || "PHC Navli (demo)",
      district: resolved.district || "Anand",
      state: resolved.state || "Gujarat",
    };
  } catch {
    return {
      facilityName: "PHC Navli (demo)",
      district: "Anand",
      state: "Gujarat",
    };
  }
}

/**
 * Loads all 25 registered patients from data/patients.json
 */
export function getAllRegistryPatients(): PatientQueueItem[] {
  const filePath = path.join(process.cwd(), "data", "patients.json");
  if (!fs.existsSync(filePath)) return [];

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(resolveDates(raw));
    const list = parsed.patients || [];
    return list.map((p: Record<string, unknown>, idx: number) => ({
      id: p.id as string,
      tokenNumber: (p.tokenNumber as string) || `OPD-${String(idx + 1).padStart(2, "0")}`,
      name: p.name as string,
      age: formatAge(p.age as string | number),
      gender: formatGender(p.gender as string),
      abhaNumber: p.abhaNumber as string,
      abhaAddress: p.abhaAddress as string,
      arrivalTime: (p.arrivalTime as string) || "09:00",
      visitType: (p.visitType as "Follow-up" | "New Visit") || "New Visit",
      chiefComplaint: (p.complaint as string) || (p.chiefComplaint as string) || "",
      complaint: p.complaint as string,
      dataStatus: ((p.recordCount as number) > 0 ? "Records available" : "ABHA, no records") as "Records available" | "ABHA, no records",
      recordCount: (p.recordCount as number) || 0,
      hasRecords: ((p.recordCount as number) || 0) > 0,
      recordsFile: p.recordsFile as string,
      village: p.village as string,
      district: p.district as string,
      state: p.state as string,
      nativePlace: (p.nativePlace as string) || null,
      facilities: (p.facilities as string[]) || [],
      isDemoPersona: Boolean(p.isDemoPersona),
      personaNumber: (p.personaNumber as number) || null,
      queueStatus: "Waiting" as const,
    }));
  } catch {
    return [];
  }
}

/**
 * Loads today's OPD queue from data/todays-queue.json
 */
export function getOpdQueue(): PatientQueueItem[] {
  const filePath = path.join(process.cwd(), "data", "todays-queue.json");
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const list = JSON.parse(resolveDates(raw)) as Record<string, unknown>[];
    return list.map((p) => ({
      ...p,
      id: p.id as string,
      tokenNumber: (p.tokenNumber as string) || "OPD-01",
      name: p.name as string,
      age: formatAge(p.age as string | number),
      gender: formatGender(p.gender as string),
      abhaNumber: p.abhaNumber as string,
      abhaAddress: p.abhaAddress as string,
      arrivalTime: (p.arrivalTime as string) || "09:00",
      visitType: (p.visitType as "Follow-up" | "New Visit") || "New Visit",
      chiefComplaint: (p.complaint as string) || (p.chiefComplaint as string) || "",
      dataStatus: ((p.recordCount as number) > 0 ? "Records available" : "ABHA, no records") as "Records available" | "ABHA, no records",
      recordCount: (p.recordCount as number) || 0,
      hasRecords: ((p.recordCount as number) || 0) > 0,
      queueStatus: (p.queueStatus as "Waiting" | "In consultation" | "Done") || "Waiting",
    }));
  } catch {
    return [];
  }
}

/**
 * Writes the active today's OPD queue back to data/todays-queue.json
 */
export function saveOpdQueue(patients: PatientQueueItem[]): void {
  const filePath = path.join(process.cwd(), "data", "todays-queue.json");
  fs.writeFileSync(filePath, JSON.stringify(patients, null, 2), "utf-8");
}

/**
 * Returns the next available OPD token number (e.g. "OPD-11")
 */
export function getNextTokenNumber(): string {
  const queue = getOpdQueue();
  if (queue.length === 0) return "OPD-01";
  const nums = queue
    .map((p) => parseInt(p.tokenNumber.replace("OPD-", ""), 10))
    .filter((n) => !isNaN(n));
  const max = Math.max(0, ...nums);
  return `OPD-${String(max + 1).padStart(2, "0")}`;
}

/**
 * Loads a patient's raw FHIR bundle from data/records/<id>.json after resolving all date tokens.
 */
export function getPatientRecordBundle(patientId: string): Record<string, unknown> | null {
  const filePath = path.join(process.cwd(), "data", "records", `${patientId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const resolved = resolveDates(raw);
    return JSON.parse(resolved);
  } catch {
    return null;
  }
}