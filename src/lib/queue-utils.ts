export interface PatientQueueItem {
  id: string;
  tokenNumber: string; // e.g. "E1", "E2" or "OPD-01"
  name: string;
  age: string | number;
  gender: "Male" | "Female" | "Other" | "M" | "F" | "O";
  abhaNumber: string;
  abhaAddress: string;
  hasAbha?: boolean;
  isEmergency?: boolean;
  emergencyReason?: string;
  mobileNumber?: string;
  arrivalTime: string;
  arrivalTimestamp?: number;
  completedTimestamp?: number;
  visitType: "Follow-up" | "New Visit" | "Emergency";
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

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 9999;
  const parts = timeStr.trim().split(":");
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
  }
  return 9999;
}

/**
 * Sorts patients strictly according to live queue ordering rules:
 * 1. Emergency patients who are "Waiting" (earliest first)
 * 2. The patient "In consultation" (if any)
 * 3. Regular Waiting patients in token order
 * 4. Done patients at the bottom, greyed out, in completion order
 */
export function sortQueueLive(patients: PatientQueueItem[]): PatientQueueItem[] {
  return [...patients].sort((a, b) => {
    const aDone = a.queueStatus === "Done";
    const bDone = b.queueStatus === "Done";
    if (aDone && !bDone) return 1;
    if (!aDone && bDone) return -1;
    if (aDone && bDone) {
      return (a.completedTimestamp || 0) - (b.completedTimestamp || 0);
    }

    const getRank = (item: PatientQueueItem): number => {
      if (item.queueStatus === "In consultation") return 2;
      if (item.isEmergency || item.tokenNumber.startsWith("E")) return 1;
      return 3;
    };

    const rankA = getRank(a);
    const rankB = getRank(b);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    if (rankA === 1) {
      const timeA = a.arrivalTimestamp || parseTimeToMinutes(a.arrivalTime);
      const timeB = b.arrivalTimestamp || parseTimeToMinutes(b.arrivalTime);
      return timeA - timeB;
    }

    if (rankA === 3) {
      const tokenNumA = parseInt(a.tokenNumber.replace(/\D/g, ""), 10) || 999;
      const tokenNumB = parseInt(b.tokenNumber.replace(/\D/g, ""), 10) || 999;
      return tokenNumA - tokenNumB;
    }

    return 0;
  });
}

