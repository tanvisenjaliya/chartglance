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
  abhaStatus: "LINKED" | "UNLINKED";
  arrivalTime: string;
  visitType: "Follow-up" | "New Visit" | "Emergency Triage";
  chiefComplaint: string;
  dataStatus: "Records Available" | "Consent Pending" | "No Linked Records";
  recordCount: number;
  hasRecords: boolean;
  recordFile?: string;
  notes?: string;
  isEmergency?: boolean;
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
 */
export function getOpdQueue(): PatientQueueItem[] {
  const filePath = path.join(process.cwd(), "data", "patients.json");
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const fileContent = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(fileContent) as PatientQueueItem[];
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
