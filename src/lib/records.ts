import fs from "fs";
import path from "path";

export interface PatientQueueItem {
  id: string;
  tokenNumber: string;
  name: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  abhaNumber: string;
  abhaAddress: string;
  arrivalTime: string;
  visitType: "Follow-up" | "New Visit";
  chiefComplaint: string;
  dataStatus: "Records available" | "ABHA, no records" | "No ABHA";
  recordCount: number;
  hasRecords: boolean;
  recordFile?: string;
  /** Lifecycle status for the OPD queue. Defaults to "Waiting". */
  queueStatus: "Waiting" | "In consultation" | "Done";
}

/**
 * Resolves a day offset relative to current date (or specified base date).
 * e.g., offsetDays = -90 -> Date 90 days ago formatted as "YYYY-MM-DD".
 */
export function resolveOffsetDate(offsetDays: number, baseDate: Date = new Date()): string {
  const target = new Date(baseDate);
  target.setDate(target.getDate() + offsetDays);
  return target.toISOString().split("T")[0];
}

/**
 * Formats a date into a clean clinical display format: e.g. "28 Jul 2026"
 */
export function formatClinicalDate(isoDateStr: string): string {
  try {
    const d = new Date(isoDateStr);
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
 * Loads all patients in today's OPD queue from /data/patients.json
 * Back-fills queueStatus to "Waiting" for legacy records that lack the field.
 */
export function getOpdQueue(): PatientQueueItem[] {
  const filePath = path.join(process.cwd(), "data", "patients.json");
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const raw = JSON.parse(fileContent) as PatientQueueItem[];
  return raw.map((p) => ({
    ...p,
    queueStatus: p.queueStatus ?? "Waiting",
  }));
}

/**
 * Writes the full patient queue back to /data/patients.json.
 */
export function saveOpdQueue(patients: PatientQueueItem[]): void {
  const filePath = path.join(process.cwd(), "data", "patients.json");
  fs.writeFileSync(filePath, JSON.stringify(patients, null, 2), "utf-8");
}

/**
 * Returns the next available OPD token number (e.g. "OPD-26").
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
 * Loads a patient's FHIR bundle from /data/records/ and returns raw JSON bundle
 */
export function getPatientRecordBundle(fileName: string) {
  const filePath = path.join(process.cwd(), "data", "records", fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const fileContent = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(fileContent);
}
