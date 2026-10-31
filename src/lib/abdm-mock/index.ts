import fs from "fs";
import path from "path";
import { resolveOffsetDate, formatClinicalDate } from "@/lib/records";
import {
  CONSENT_PROBABILITIES,
  RECORD_FETCH_DELAY_RANGE,
  FACILITY_TIMEOUT_RATE,
  AUTO_CONSENT_DELAY_RANGE,
  isDemoMode,
} from "@/lib/demo-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConsentStatus =
  | "NOT_REQUESTED"
  | "REQUESTED"
  | "GRANTED"
  | "DENIED"
  | "EXPIRED"
  | "REVOKED";

export interface FacilityFetchState {
  facility: string;
  /** Wall-clock ms at which this facility's records are "received" */
  scheduledAt: number;
  status: "pending" | "received" | "timeout";
}

export interface ConsentRecord {
  id: string;
  patientId: string;
  abhaNumber: string;
  abhaAddress: string;
  requesterName: string;
  requesterFacility: string;
  purpose: "CAREMGT";
  hiTypes: string[];
  dateRange: {
    from: string;
    to: string;
  };
  expiryDate: string;
  status: ConsentStatus;
  createdAt: string;
  updatedAt: string;
  /**
   * Auto-simulation fields: pre-computed at request time.
   * null means the patient-phone screen was used (or consent resolved already).
   */
  simulation?: {
    outcome: "GRANTED" | "DENIED" | "EXPIRED";
    resolveAt: number; // wall-clock ms
  };
  /** Per-facility staged fetch state; populated when consent is GRANTED. */
  facilityFetch?: FacilityFetchState[];
}

export interface RawClinicalRecord {
  id: string;
  sourceId: string;
  type: string;
  facility: string;
  date: string;
  display: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONSENTS_FILE = path.join(process.cwd(), "data", "consents.json");

function ensureConsentsFile(): Record<string, ConsentRecord> {
  if (!fs.existsSync(CONSENTS_FILE)) {
    fs.writeFileSync(CONSENTS_FILE, JSON.stringify({}, null, 2), "utf-8");
    return {};
  }
  try {
    const raw = fs.readFileSync(CONSENTS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveConsents(data: Record<string, ConsentRecord>) {
  fs.writeFileSync(CONSENTS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Seeded random for deterministic facility-fetch scheduling.
 * Uses a simple LCG per consent id hash so different patients get different timings.
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Pick a weighted outcome from the CONSENT_PROBABILITIES config.
 * Uses a seeded value (not Math.random) so results are reproducible per consent id.
 */
function pickSimulatedOutcome(
  rngValue: number
): "GRANTED" | "DENIED" | "EXPIRED" {
  const { approve, deny } = CONSENT_PROBABILITIES;
  if (rngValue < approve) return "GRANTED";
  if (rngValue < approve + deny) return "DENIED";
  return "EXPIRED";
}

/**
 * Builds the per-facility staged fetch state for a patient.
 * In Demo Mode: all facilities marked as "received" with scheduledAt = now.
 */
function buildFacilityFetchStates(
  patientId: string,
  facilities: string[],
  now: number
): FacilityFetchState[] {
  const demo = isDemoMode();
  const rng = seededRandom(hashString(patientId + now));

  return facilities.map((facility, _i) => {
    if (demo) {
      return { facility, scheduledAt: now, status: "received" as const };
    }
    const [minS, maxS] = RECORD_FETCH_DELAY_RANGE;
    const delaySec = minS + rng() * (maxS - minS);
    const scheduledAt = now + delaySec * 1000;
    // 10% chance timeout — use a second draw per facility
    const isTimeout = rng() < FACILITY_TIMEOUT_RATE;
    return {
      facility,
      scheduledAt,
      status: isTimeout ? ("timeout" as const) : ("pending" as const),
    };
  });
}

// ---------------------------------------------------------------------------
// FHIR record parsing (unchanged logic, extracted for reuse)
// ---------------------------------------------------------------------------

function parseBundleIntoRecords(bundle: {
  entry?: Array<{ resource?: Record<string, unknown> }>;
}): { records: RawClinicalRecord[]; facilities: Set<string> } {
  const rawRecords: RawClinicalRecord[] = [];
  const facilities = new Set<string>();

  for (const entry of bundle.entry || []) {
    const res = entry.resource;
    if (!res) continue;

    const facility =
      (res.facility as string) || "CHC Shirur (HIP-MH-PUN-001)";
    facilities.add(facility);

    if (res.resourceType === "Encounter") {
      const resolved = resolveOffsetDate((res.periodOffsetDays as number) ?? 0);
      rawRecords.push({
        id: res.id as string,
        sourceId: res.sourceId as string,
        type: "OPConsultation",
        facility,
        date: formatClinicalDate(resolved),
        display:
          ((res.reasonCode as Array<{ text?: string }>)?.[0]?.text) ||
          "Outpatient Clinical Consultation",
        details: "Clinical consult record",
      });
    } else if (res.resourceType === "Observation") {
      const resolved = resolveOffsetDate(
        (res.effectiveDateTimeOffsetDays as number) ?? 0
      );
      let display = (res.code as { text?: string })?.text || "Clinical Lab Observation";
      let details = "";
      const vq = res.valueQuantity as { value?: number; unit?: string } | undefined;
      const vs = res.valueString as string | undefined;
      if (vq) {
        display = `${display}: ${vq.value} ${vq.unit}`;
      } else if (vs) {
        display = `${display}: ${vs}`;
      } else if (Array.isArray(res.component)) {
        interface ObsComp {
          code?: { coding?: Array<{ code?: string }> };
          valueQuantity?: { value?: number };
        }
        const comps = res.component as ObsComp[];
        const sys = comps.find(
          (c) => c.code?.coding?.[0]?.code === "8480-6"
        )?.valueQuantity?.value;
        const dia = comps.find(
          (c) => c.code?.coding?.[0]?.code === "8462-4"
        )?.valueQuantity?.value;
        display = `${display}: ${sys}/${dia} mmHg`;
      }
      if ((res.note as Array<{ text?: string }>)?.[0]?.text) {
        details = (res.note as Array<{ text: string }>)[0].text;
      }
      rawRecords.push({
        id: res.id as string,
        sourceId: res.sourceId as string,
        type: "DiagnosticReport",
        facility,
        date: formatClinicalDate(resolved),
        display,
        details,
      });
    } else if (res.resourceType === "MedicationRequest") {
      const resolved = resolveOffsetDate(
        (res.authoredOnOffsetDays as number) ?? 0
      );
      rawRecords.push({
        id: res.id as string,
        sourceId: res.sourceId as string,
        type: "Prescription",
        facility,
        date: formatClinicalDate(resolved),
        display:
          (res.medicationCodeableConcept as { text?: string })?.text ||
          "Medication Order",
        details: (res.dosageInstruction as Array<{ text?: string }>)?.[0]?.text,
      });
    } else if (res.resourceType === "MedicationDispense") {
      const resolved = resolveOffsetDate(
        (res.whenHandedOverOffsetDays as number) ?? 0
      );
      rawRecords.push({
        id: res.id as string,
        sourceId: res.sourceId as string,
        type: "Prescription",
        facility,
        date: formatClinicalDate(resolved),
        display:
          (res.medicationCodeableConcept as { text?: string })?.text ||
          "Dispensed Medication",
        details: `${(res.daysSupply as { value?: number })?.value ?? 30} days supply dispensed`,
      });
    } else if (res.resourceType === "Immunization") {
      const resolved = resolveOffsetDate(
        (res.occurrenceDateTimeOffsetDays as number) ?? 0
      );
      rawRecords.push({
        id: res.id as string,
        sourceId: res.sourceId as string,
        type: "ImmunizationRecord",
        facility,
        date: formatClinicalDate(resolved),
        display: (res.vaccineCode as { text?: string })?.text || "Immunization",
        details:
          (res.note as Array<{ text?: string }>)?.[0]?.text ||
          "Completed vaccine administration",
      });
    } else if (res.resourceType === "DocumentReference") {
      const resolved = resolveOffsetDate((res.dateOffsetDays as number) ?? 0);
      rawRecords.push({
        id: res.id as string,
        sourceId: res.sourceId as string,
        type: "HealthDocument",
        facility,
        date: formatClinicalDate(resolved),
        display:
          (res.type as { text?: string })?.text || "Scanned Health Document",
        details:
          (res.description as string) ||
          (res.content as Array<{ attachment?: { title?: string } }>)?.[0]
            ?.attachment?.title ||
          "Unstructured document scan",
      });
    } else if (res.resourceType === "Appointment") {
      const resolved = resolveOffsetDate(
        (res.scheduledDateOffsetDays as number) ?? 0
      );
      rawRecords.push({
        id: res.id as string,
        sourceId: res.sourceId as string,
        type: "OPConsultation",
        facility,
        date: formatClinicalDate(resolved),
        display:
          (res.serviceType as Array<{ text?: string }>)?.[0]?.text ||
          "Scheduled Consultation",
        details: `Status: ${res.status as string} · ${(res.description as string) || ""}`,
      });
    } else if (res.resourceType === "Condition") {
      const resolved = resolveOffsetDate(
        (res.recordedDateOffsetDays as number) ?? 0
      );
      rawRecords.push({
        id: res.id as string,
        sourceId: res.sourceId as string,
        type: "HealthDocument",
        facility,
        date: formatClinicalDate(resolved),
        display: `Condition: ${(res.code as { text?: string })?.text || "Medical Condition"}`,
        details: `Status: ${(res.clinicalStatus as { coding?: Array<{ code?: string }> })?.coding?.[0]?.code || "active"}`,
      });
    }
  }

  return { records: rawRecords, facilities };
}

// ---------------------------------------------------------------------------
// abdmClient — the one interface to swap for real ABDM integration
// ---------------------------------------------------------------------------

export const abdmClient = {
  /**
   * Retrieves the current consent record for a patient.
   * - Auto-evaluates real-time 24h expiration.
   * - Applies auto-simulation outcome when the simulated delay has elapsed
   *   AND the patient-phone screen has NOT resolved the consent manually.
   */
  getConsent(patientId: string): ConsentRecord | null {
    const store = ensureConsentsFile();
    const consent = store[patientId];
    if (!consent) return null;

    const now = Date.now();
    let changed = false;

    // Apply auto-simulation if still REQUESTED and simulation is pending
    if (
      consent.status === "REQUESTED" &&
      consent.simulation &&
      now >= consent.simulation.resolveAt
    ) {
      const outcome = consent.simulation.outcome;
      consent.status = outcome;
      consent.updatedAt = new Date(now).toISOString();
      consent.simulation = undefined; // consumed

      if (outcome === "GRANTED") {
        // Set 24h expiry from resolution moment
        const expiry = new Date(now + 24 * 60 * 60 * 1000);
        consent.expiryDate = expiry.toISOString();
        // Initialise per-facility staged fetch
        const allFacilities = this._getFacilitiesForPatient(patientId);
        consent.facilityFetch = buildFacilityFetchStates(
          patientId,
          allFacilities,
          now
        );
      } else if (outcome === "EXPIRED") {
        consent.expiryDate = new Date(now - 60000).toISOString();
      }
      changed = true;
    }

    // Check real 24h expiry if currently GRANTED
    if (consent.status === "GRANTED") {
      const exp = new Date(consent.expiryDate).getTime();
      if (now > exp) {
        consent.status = "EXPIRED";
        consent.updatedAt = new Date(now).toISOString();
        changed = true;
      }
    }

    if (changed) {
      store[patientId] = consent;
      saveConsents(store);
    }

    return consent;
  },

  /**
   * Creates a mock consent request (doctor-side, HIU role).
   * - Status: REQUESTED
   * - Pre-computes auto-simulation outcome and delay (unless Demo Mode)
   */
  createConsentRequest(
    patientId: string,
    abhaNumber: string,
    abhaAddress: string
  ): ConsentRecord {
    const store = ensureConsentsFile();
    const now = new Date();
    const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const fromDate = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const toDate = now.toISOString().split("T")[0];

    // Pre-compute simulation
    const rng = seededRandom(hashString(patientId + now.getTime()));
    const rngVal = rng();

    let simulation: ConsentRecord["simulation"];
    if (isDemoMode()) {
      // Demo mode: resolve immediately as GRANTED
      simulation = {
        outcome: "GRANTED",
        resolveAt: now.getTime(), // instant
      };
    } else {
      const [minS, maxS] = AUTO_CONSENT_DELAY_RANGE;
      const delaySec = minS + rngVal * (maxS - minS);
      simulation = {
        outcome: pickSimulatedOutcome(rng()), // second draw for outcome
        resolveAt: now.getTime() + delaySec * 1000,
      };
    }

    const consent: ConsentRecord = {
      id: `consent-${patientId}-${Date.now()}`,
      patientId,
      abhaNumber,
      abhaAddress,
      requesterName: "Dr. Aditi Sharma",
      requesterFacility: "PHC Mandavgan (HIU-MH-PUN-042)",
      purpose: "CAREMGT",
      hiTypes: [
        "OPConsultation",
        "DiagnosticReport",
        "Prescription",
        "DischargeSummary",
      ],
      dateRange: { from: fromDate, to: toDate },
      expiryDate: expiry.toISOString(),
      status: "REQUESTED",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      simulation,
    };

    store[patientId] = consent;
    saveConsents(store);
    return consent;
  },

  /**
   * Approves consent — called ONLY from the patient phone screen.
   * Clears any pending simulation and immediately sets GRANTED.
   */
  approveConsent(patientId: string): ConsentRecord {
    const store = ensureConsentsFile();
    const consent = store[patientId];
    if (!consent) {
      throw new Error(`Consent request for patient ${patientId} not found`);
    }

    const now = Date.now();
    const expiry = new Date(now + 24 * 60 * 60 * 1000);

    consent.status = "GRANTED";
    consent.expiryDate = expiry.toISOString();
    consent.updatedAt = new Date(now).toISOString();
    consent.simulation = undefined; // patient acted; cancel auto-simulation

    // Initialise staged fetch
    const allFacilities = this._getFacilitiesForPatient(patientId);
    consent.facilityFetch = buildFacilityFetchStates(
      patientId,
      allFacilities,
      now
    );

    store[patientId] = consent;
    saveConsents(store);
    return consent;
  },

  /**
   * Denies consent — called ONLY from the patient phone screen.
   */
  denyConsent(patientId: string): ConsentRecord {
    const store = ensureConsentsFile();
    const consent = store[patientId];
    if (!consent) {
      throw new Error(`Consent request for patient ${patientId} not found`);
    }

    consent.status = "DENIED";
    consent.updatedAt = new Date().toISOString();
    consent.simulation = undefined;

    store[patientId] = consent;
    saveConsents(store);
    return consent;
  },

  /** Simulates immediate expiry. */
  expireConsent(patientId: string): ConsentRecord {
    const store = ensureConsentsFile();
    const consent = store[patientId];
    if (!consent) {
      throw new Error(`Consent request for patient ${patientId} not found`);
    }

    consent.status = "EXPIRED";
    consent.expiryDate = new Date(Date.now() - 60000).toISOString();
    consent.updatedAt = new Date().toISOString();
    consent.simulation = undefined;

    store[patientId] = consent;
    saveConsents(store);
    return consent;
  },

  /** Resets consent to NOT_REQUESTED for demo repetition. */
  resetConsent(patientId: string): void {
    const store = ensureConsentsFile();
    delete store[patientId];
    saveConsents(store);
  },

  // ---------------------------------------------------------------------------
  // Record fetch — staged per-facility
  // ---------------------------------------------------------------------------

  /**
   * Returns all facilities that have records for this patient.
   * Used internally to set up facilityFetch states.
   */
  _getFacilitiesForPatient(patientId: string): string[] {
    const recordsFilePath = this._getRecordsPath(patientId);
    if (!recordsFilePath) return [];
    if (!fs.existsSync(recordsFilePath)) return [];

    const bundle = JSON.parse(fs.readFileSync(recordsFilePath, "utf-8"));
    const facilities = new Set<string>();
    for (const entry of bundle.entry || []) {
      const res = entry.resource;
      if (!res) continue;
      facilities.add(
        (res.facility as string) || "CHC Shirur (HIP-MH-PUN-001)"
      );
    }
    return Array.from(facilities);
  },

  _getRecordsPath(patientId: string): string | null {
    const personaFileMap: Record<string, string> = {
      p1: "persona-1.json",
      p2: "persona-2.json",
      p3: "persona-3.json",
      p5: "persona-5.json",
    };
    const targetFile = personaFileMap[patientId];
    if (!targetFile) return null;
    return path.join(process.cwd(), "data", "records", targetFile);
  },

  /**
   * Staged record fetch — called on each poll while GRANTED.
   *
   * Advances facilityFetch states where the scheduled time has elapsed.
   * Returns:
   * - `records`: records from facilities whose status is now "received"
   * - `pendingFacilities`: facilities still loading
   * - `timedOutCount`: number of facilities that timed out
   * - `facilityCount`: total facilities (received + timed out, not pending)
   */
  fetchRecordsStaged(patientId: string): {
    records: RawClinicalRecord[];
    hasRecords: boolean;
    facilityCount: number;
    pendingFacilities: string[];
    timedOutCount: number;
  } {
    const consent = this.getConsent(patientId);
    if (!consent || consent.status !== "GRANTED") {
      return {
        records: [],
        hasRecords: false,
        facilityCount: 0,
        pendingFacilities: [],
        timedOutCount: 0,
      };
    }

    const recordsFilePath = this._getRecordsPath(patientId);
    if (!recordsFilePath || !fs.existsSync(recordsFilePath)) {
      return {
        records: [],
        hasRecords: false,
        facilityCount: 0,
        pendingFacilities: [],
        timedOutCount: 0,
      };
    }

    // If facilityFetch wasn't initialised (edge case), build it now
    const store = ensureConsentsFile();
    if (!store[patientId].facilityFetch) {
      const allFacilities = this._getFacilitiesForPatient(patientId);
      store[patientId].facilityFetch = buildFacilityFetchStates(
        patientId,
        allFacilities,
        Date.now()
      );
      saveConsents(store);
    }

    const now = Date.now();
    const fetchStates = store[patientId].facilityFetch!;
    let changed = false;

    // Advance "pending" → "received" (timeouts stay as-is since they're pre-set)
    for (const state of fetchStates) {
      if (state.status === "pending" && now >= state.scheduledAt) {
        state.status = "received";
        changed = true;
      }
    }

    if (changed) {
      store[patientId].facilityFetch = fetchStates;
      saveConsents(store);
    }

    const receivedFacilities = new Set(
      fetchStates
        .filter((s) => s.status === "received")
        .map((s) => s.facility)
    );
    const pendingFacilities = fetchStates
      .filter((s) => s.status === "pending")
      .map((s) => s.facility);
    const timedOutCount = fetchStates.filter((s) => s.status === "timeout").length;

    // Parse bundle and filter to received facilities only
    const bundle = JSON.parse(fs.readFileSync(recordsFilePath, "utf-8"));
    const { records } = parseBundleIntoRecords(bundle);
    const filteredRecords = records.filter((r) =>
      receivedFacilities.has(r.facility)
    );

    return {
      records: filteredRecords,
      hasRecords: filteredRecords.length > 0,
      facilityCount: receivedFacilities.size + timedOutCount,
      pendingFacilities,
      timedOutCount,
    };
  },

  /**
   * Legacy synchronous fetch — kept for compatibility. Returns all records immediately.
   * @deprecated Use fetchRecordsStaged() instead.
   */
  fetchRecords(patientId: string): {
    records: RawClinicalRecord[];
    hasRecords: boolean;
    facilityCount: number;
  } {
    const consent = this.getConsent(patientId);
    if (!consent || consent.status !== "GRANTED") {
      return { records: [], hasRecords: false, facilityCount: 0 };
    }

    const recordsFilePath = this._getRecordsPath(patientId);
    if (!recordsFilePath || !fs.existsSync(recordsFilePath)) {
      return { records: [], hasRecords: false, facilityCount: 0 };
    }

    const bundle = JSON.parse(fs.readFileSync(recordsFilePath, "utf-8"));
    const { records, facilities } = parseBundleIntoRecords(bundle);
    return {
      records,
      hasRecords: records.length > 0,
      facilityCount: facilities.size,
    };
  },
};
