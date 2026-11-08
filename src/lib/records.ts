import fs from "fs";
import path from "path";

export * from "./queue-utils";
import type {
  PatientQueueItem,
  FacilityMetadata,
} from "./queue-utils";
import {
  sortQueueLive,
} from "./queue-utils";

// ---------------------------------------------------------------------------
// Seeded PRNG (32-bit LCG) — no external dependency
// Same pattern used in abdm-mock/index.ts
// ---------------------------------------------------------------------------
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223 >>> 0;
    return s / 0x100000000;
  };
}

/** Deterministic Fisher-Yates shuffle using the given rng */
function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Format minutes-from-midnight as "HH:MM" */
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Builds a fresh 10-patient daily queue for the given date string (YYYY-MM-DD).
 * Always includes P01–P05; picks 5 more from the other 20 using the date as seed.
 * Assigns realistic arrival times between 09:00–11:30 and tokens OPD-01..OPD-10.
 * Writes the result to data/runtime/queue-{dateStr}.json and returns the list.
 */
export function buildFreshDailyQueue(dateStr: string): PatientQueueItem[] {
  const seed = parseInt(dateStr.replace(/-/g, ""), 10); // e.g. 20261106
  const rng = seededRng(seed);

  const all = getAllRegistryPatients();
  const demoIds = new Set(["P01", "P02", "P03", "P04", "P05"]);
  const demos = all.filter((p) => demoIds.has(p.id));
  const others = all.filter((p) => !demoIds.has(p.id));

  // Pick 5 from the 20 non-demo patients deterministically
  const shuffledOthers = seededShuffle(others, rng);
  const picked = shuffledOthers.slice(0, 5);

  const pool = [...demos, ...picked]; // 10 patients

  // Generate 10 arrival times between 09:00 (540 min) and 11:30 (690 min)
  // Spread them out with a base spacing of ~15 min + jitter up to ±5 min
  const SESSION_START = 540; // 09:00
  const SESSION_END = 690;   // 11:30
  const totalWindow = SESSION_END - SESSION_START; // 150 min for 10 patients
  const baseGap = Math.floor(totalWindow / pool.length); // ~15 min

  const arrivalMins: number[] = [];
  for (let i = 0; i < pool.length; i++) {
    const base = SESSION_START + i * baseGap;
    // Jitter ± up to half the gap, capped to window
    const jitter = Math.floor((rng() - 0.5) * baseGap);
    const mins = Math.min(SESSION_END, Math.max(SESSION_START, base + jitter));
    arrivalMins.push(mins);
  }
  // Sort arrival times
  arrivalMins.sort((a, b) => a - b);

  // Assign arrival times randomly across the pool (shuffle pool order, then zip)
  const shuffledPool = seededShuffle(pool, rng);

  // Zip pool with sorted arrival times, then sort by arrival time for token assignment
  const paired = shuffledPool.map((p, i) => ({ p, arrivalMin: arrivalMins[i] }));
  paired.sort((a, b) => a.arrivalMin - b.arrivalMin);

  const queue: PatientQueueItem[] = paired.map((item, idx) => {
    const arrivalTime = minutesToTime(item.arrivalMin);
    // Build arrival timestamp for today
    const [yy, mm, dd] = dateStr.split("-").map(Number);
    const arrivalDate = new Date(yy, mm - 1, dd, Math.floor(item.arrivalMin / 60), item.arrivalMin % 60, 0, 0);
    return {
      ...item.p,
      tokenNumber: `OPD-${String(idx + 1).padStart(2, "0")}`,
      arrivalTime,
      arrivalTimestamp: arrivalDate.getTime(),
      queueStatus: "Waiting" as const,
      isEmergency: false,
      emergencyReason: undefined,
      completedTimestamp: undefined,
    };
  });

  // Persist
  const runtimeDir = path.join(process.cwd(), "data", "runtime");
  if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });
  const filePath = path.join(runtimeDir, `queue-${dateStr}.json`);
  fs.writeFileSync(filePath, JSON.stringify(queue, null, 2), "utf-8");

  return queue;
}

/**
 * Resets today's queue to its initial state (all 10 patients Waiting, no emergencies).
 * Consultation notes in data/runtime/notes.json are NOT touched.
 */
export function resetTodayQueue(): PatientQueueItem[] {
  const todayStr = new Date().toISOString().slice(0, 10);
  return buildFreshDailyQueue(todayStr);
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
  if (typeof age === "string" && age.endsWith("m")) return age;
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
      abhaNumber: (p.abhaNumber as string) || "",
      abhaAddress: (p.abhaAddress as string) || "",
      hasAbha: Boolean(p.abhaNumber && (p.abhaNumber as string) !== "—"),
      arrivalTime: (p.arrivalTime as string) || "09:00",
      visitType: (p.visitType as "Follow-up" | "New Visit" | "Emergency") || "New Visit",
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
 * Returns the path to today's runtime queue file: data/runtime/queue-YYYY-MM-DD.json
 */
function todayQueuePath(): string {
  const todayStr = new Date().toISOString().slice(0, 10);
  return path.join(process.cwd(), "data", "runtime", `queue-${todayStr}.json`);
}

/**
 * Loads today's OPD queue from data/runtime/queue-YYYY-MM-DD.json.
 * If the file does not exist (new day or first run), generates a fresh queue.
 */
export function getOpdQueue(): PatientQueueItem[] {
  const filePath = todayQueuePath();
  if (!fs.existsSync(filePath)) {
    // Auto-generate a fresh queue for today
    const todayStr = new Date().toISOString().slice(0, 10);
    return buildFreshDailyQueue(todayStr);
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const list = JSON.parse(resolveDates(raw)) as Record<string, unknown>[];
    const normalized: PatientQueueItem[] = list.map((p, idx) => ({
      ...p,
      id: p.id as string,
      tokenNumber: (p.tokenNumber as string) || `OPD-${String(idx + 1).padStart(2, "0")}`,
      name: p.name as string,
      age: formatAge(p.age as string | number),
      gender: formatGender(p.gender as string),
      abhaNumber: (p.abhaNumber as string) || "",
      abhaAddress: (p.abhaAddress as string) || "",
      hasAbha: typeof p.hasAbha === "boolean" ? p.hasAbha : Boolean(p.abhaNumber && p.abhaNumber !== "—"),
      isEmergency: Boolean(p.isEmergency),
      emergencyReason: p.emergencyReason as string | undefined,
      mobileNumber: p.mobileNumber as string | undefined,
      arrivalTime: (p.arrivalTime as string) || "09:00",
      arrivalTimestamp: (p.arrivalTimestamp as number) || (Date.now() - idx * 60000),
      completedTimestamp: p.completedTimestamp as number | undefined,
      visitType:
        (p.visitType as "Follow-up" | "New Visit" | "Emergency") ||
        (p.isEmergency ? "Emergency" : "New Visit"),
      chiefComplaint: (p.complaint as string) || (p.chiefComplaint as string) || "",
      dataStatus: (
        (p.recordCount as number) > 0 ? "Records available" : "ABHA, no records"
      ) as "Records available" | "ABHA, no records",
      recordCount: (p.recordCount as number) || 0,
      hasRecords: ((p.recordCount as number) || 0) > 0,
      queueStatus:
        (p.queueStatus as "Waiting" | "In consultation" | "Done") || "Waiting",
    }));

    return sortQueueLive(normalized);
  } catch {
    return [];
  }
}

/**
 * Writes the active today's OPD queue back to data/runtime/queue-YYYY-MM-DD.json
 */
export function saveOpdQueue(patients: PatientQueueItem[]): void {
  const filePath = todayQueuePath();
  const runtimeDir = path.dirname(filePath);
  if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(patients, null, 2), "utf-8");
}

export interface StatusUpdateResult {
  ok: boolean;
  patient?: PatientQueueItem;
  conflict?: boolean;
  error?: string;
  activePatient?: {
    id: string;
    name: string;
    tokenNumber: string;
  };
}

/**
 * Updates a patient's queueStatus in today's active queue.
 * Enforces single in-consultation constraint: only one patient can be In consultation at a time.
 */
export function updatePatientQueueStatus(
  patientId: string,
  newStatus: "Waiting" | "In consultation" | "Done"
): StatusUpdateResult {
  const queue = getOpdQueue();
  const idx = queue.findIndex((p) => p.id === patientId);
  if (idx === -1) {
    return { ok: false, error: "Patient not found in today's queue" };
  }

  // Enforce single active consultation rule
  if (newStatus === "In consultation") {
    const activeOther = queue.find(
      (p) => p.queueStatus === "In consultation" && p.id !== patientId
    );
    if (activeOther) {
      return {
        ok: false,
        conflict: true,
        error: "Finish the current consultation first",
        activePatient: {
          id: activeOther.id,
          name: activeOther.name,
          tokenNumber: activeOther.tokenNumber,
        },
      };
    }
  }

  queue[idx] = {
    ...queue[idx],
    queueStatus: newStatus,
    completedTimestamp: newStatus === "Done" ? Date.now() : undefined,
  };
  saveOpdQueue(queue);

  return { ok: true, patient: queue[idx] };
}

/**
 * Returns the next available emergency token (e.g. "E1", "E2", "E3")
 */
export function getNextEmergencyToken(): string {
  const queue = getOpdQueue();
  const emergencyNums = queue
    .filter((p) => p.isEmergency || p.tokenNumber.startsWith("E"))
    .map((p) => parseInt(p.tokenNumber.replace("E", ""), 10))
    .filter((n) => !isNaN(n));
  const max = Math.max(0, ...emergencyNums);
  return `E${max + 1}`;
}

/**
 * Returns the next available OPD token number (e.g. "OPD-11")
 */
export function getNextTokenNumber(): string {
  const queue = getOpdQueue();
  if (queue.length === 0) return "OPD-01";
  const nums = queue
    .filter((p) => !p.isEmergency && p.tokenNumber.startsWith("OPD-"))
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
