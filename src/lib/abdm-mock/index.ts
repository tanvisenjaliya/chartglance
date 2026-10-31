import fs from "fs";
import path from "path";
import {
  formatClinicalDate,
  getClinicFacility,
  getPatientRecordBundle,
} from "@/lib/records";
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
  /** Wall-clock ms at which this facility's records are received */
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
  simulation?: {
    outcome: "GRANTED" | "DENIED" | "EXPIRED";
    resolveAt: number;
  };
  facilityFetch?: FacilityFetchState[];
}

/**
 * Child item referenced inside a Composition section
 */
export interface ClinicalRecordItem {
  id: string;
  resourceType: string;
  display: string;
  details?: string;
  date?: string;
  rawDate?: string;
}

/**
 * High-level Health Record representing an ABDM Composition
 */
export interface CompositionRecord {
  id: string;
  type: string;
  title: string;
  facility: string;
  date: string;
  rawDate: string;
  clinicalNote?: string;
  items: ClinicalRecordItem[];
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
// Consents Storage
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

function pickSimulatedOutcome(
  rngValue: number
): "GRANTED" | "DENIED" | "EXPIRED" {
  const { approve, deny } = CONSENT_PROBABILITIES;
  if (rngValue < approve) return "GRANTED";
  if (rngValue < approve + deny) return "DENIED";
  return "EXPIRED";
}

function buildFacilityFetchStates(
  patientId: string,
  facilities: string[],
  now: number
): FacilityFetchState[] {
  const demo = isDemoMode();
  const rng = seededRandom(hashString(patientId + now));

  return facilities.map((facility) => {
    if (demo) {
      return { facility, scheduledAt: now, status: "received" as const };
    }
    const [minS, maxS] = RECORD_FETCH_DELAY_RANGE;
    const delaySec = minS + rng() * (maxS - minS);
    const scheduledAt = now + delaySec * 1000;
    const isTimeout = rng() < FACILITY_TIMEOUT_RATE;
    return {
      facility,
      scheduledAt,
      status: isTimeout ? ("timeout" as const) : ("pending" as const),
    };
  });
}

// ---------------------------------------------------------------------------
// FHIR Bundle Composition-Grouped Parser
// ---------------------------------------------------------------------------

function cleanHtmlDiv(div?: string): string {
  if (!div) return "";
  return div.replace(/<[^>]*>/g, "").trim();
}

/**
 * Maps profile URL to user-friendly ABDM record category
 */
function mapProfileToRecordType(profileUrl?: string, title?: string): string {
  if (profileUrl) {
    if (profileUrl.includes("OPConsultRecord")) return "OP Consultation";
    if (profileUrl.includes("PrescriptionRecord")) return "Prescription Record";
    if (profileUrl.includes("DiagnosticReportRecord")) return "Diagnostic Report";
    if (profileUrl.includes("DischargeSummaryRecord")) return "Discharge Summary";
    if (profileUrl.includes("ImmunizationRecord")) return "Immunization Record";
    if (profileUrl.includes("HealthDocumentRecord")) return "Health Document";
  }
  return title || "Health Record";
}

/**
 * Extracts item display and details from referenced resource
 */
function parseChildResource(res: Record<string, unknown>): ClinicalRecordItem {
  const resourceType = res.resourceType as string;
  const id = (res.id as string) || `res-${Date.now()}`;
  let display = resourceType;
  let details = "";
  let date = "";

  if (resourceType === "Condition") {
    const code = res.code as { text?: string } | undefined;
    display = `Condition: ${code?.text || "Medical Condition"}`;
    const clinStatus = (res.clinicalStatus as { coding?: Array<{ code?: string }> })?.coding?.[0]?.code;
    const recorded = res.recordedDate as string | undefined;
    if (recorded) {
      date = formatClinicalDate(recorded);
    }
    details = `Status: ${clinStatus || "active"}`;
  } else if (resourceType === "Observation") {
    const code = res.code as { text?: string } | undefined;
    display = code?.text || "Clinical Observation";
    const vq = res.valueQuantity as { value?: number; unit?: string } | undefined;
    const vs = res.valueString as string | undefined;
    if (vq) {
      display = `${display}: ${vq.value} ${vq.unit || ""}`;
    } else if (vs) {
      display = `${display}: ${vs}`;
    } else if (Array.isArray(res.component)) {
      interface Comp {
        code?: { coding?: Array<{ code?: string }> };
        valueQuantity?: { value?: number };
      }
      const comps = res.component as Comp[];
      const sys = comps.find((c) => c.code?.coding?.[0]?.code === "8480-6")?.valueQuantity?.value;
      const dia = comps.find((c) => c.code?.coding?.[0]?.code === "8462-4")?.valueQuantity?.value;
      if (sys && dia) display = `${display}: ${sys}/${dia} mmHg`;
    }
    const note = (res.note as Array<{ text?: string }>)?.[0]?.text;
    if (note) details = note.replace(/\s*\(TODO-VERIFY[^)]*\)/g, "").replace(/TODO-VERIFY:?\s*/g, "");
    const eff = res.effectiveDateTime as string | undefined;
    if (eff) date = formatClinicalDate(eff);
  } else if (resourceType === "MedicationRequest") {
    const med = res.medicationCodeableConcept as { text?: string } | undefined;
    display = med?.text || "Medication Order";
    const dosage = (res.dosageInstruction as Array<{ text?: string }>)?.[0]?.text;
    if (dosage) details = dosage.replace(/\s*\(TODO-VERIFY[^)]*\)/g, "").replace(/TODO-VERIFY:?\s*/g, "");
    const authored = res.authoredOn as string | undefined;
    if (authored) date = formatClinicalDate(authored);
  } else if (resourceType === "MedicationDispense") {
    const med = res.medicationCodeableConcept as { text?: string } | undefined;
    display = med?.text || "Medication Dispense";
    const days = (res.daysSupply as { value?: number })?.value ?? 30;
    details = `${days} days supply dispensed`;
    const handed = res.whenHandedOver as string | undefined;
    if (handed) date = formatClinicalDate(handed);
  } else if (resourceType === "Immunization") {
    const vaccine = res.vaccineCode as { text?: string } | undefined;
    display = vaccine?.text || "Immunization";
    const note = (res.note as Array<{ text?: string }>)?.[0]?.text;
    if (note) details = note;
    const occ = res.occurrenceDateTime as string | undefined;
    if (occ) date = formatClinicalDate(occ);
  } else if (resourceType === "DocumentReference") {
    const type = res.type as { text?: string } | undefined;
    display = type?.text || "Scanned Health Document";
    details = (res.description as string) || "Unstructured document scan (PDF)";
    const d = res.date as string | undefined;
    if (d) date = formatClinicalDate(d);
  } else if (resourceType === "Appointment") {
    const srv = (res.serviceType as Array<{ text?: string }>)?.[0]?.text;
    display = srv || "Scheduled Follow-up Appointment";
    const status = res.status as string;
    details = `Appointment status: ${status}`;
    const start = res.start as string | undefined;
    if (start) date = formatClinicalDate(start);
  }

  // Strip any lingering developer notes from details
  details = details
    .replace(/\s*\(TODO-VERIFY[^)]*\)/g, "")
    .replace(/TODO-VERIFY:?\s*/g, "")
    .replace(/\s*\(-?\d+[dmy]\)/g, "")
    .trim();

  return {
    id,
    resourceType,
    display,
    details: details || undefined,
    date: date || undefined,
    rawDate: (res.date || res.effectiveDateTime || res.authoredOn || res.whenHandedOver || res.recordedDate || res.start) as string | undefined,
  };
}

/**
 * Parses a FHIR bundle into structured Compositions and facilities map
 */
function parseBundleIntoCompositions(bundle: Record<string, unknown>): {
  compositions: CompositionRecord[];
  allFacilities: Set<string>;
} {
  const entries = (bundle.entry as Array<{ resource?: Record<string, unknown> }>) || [];
  const resourceMap = new Map<string, Record<string, unknown>>();
  const orgMap = new Map<string, string>();
  const allFacilities = new Set<string>();

  // Index resources & organizations
  for (const entry of entries) {
    const res = entry.resource;
    if (!res) continue;
    const key = `${res.resourceType}/${res.id}`;
    resourceMap.set(key, res);
    if (res.resourceType === "Organization") {
      const orgId = res.id as string;
      const orgName = (res.name as string) || "Public Health Facility";
      orgMap.set(orgId, orgName);
      orgMap.set(`Organization/${orgId}`, orgName);
    }
  }

  const compositions: CompositionRecord[] = [];

  for (const entry of entries) {
    const res = entry.resource;
    if (!res || res.resourceType !== "Composition") continue;

    const profileUrl = (res.meta as { profile?: string[] })?.profile?.[0];
    const type = mapProfileToRecordType(profileUrl, res.title as string);
    const rawDate = (res.date as string) || new Date().toISOString().slice(0, 10);
    const date = formatClinicalDate(rawDate);

    // Resolve author / custodian facility name
    const authorRef = (res.author as Array<{ reference?: string }>)?.[0]?.reference;
    const custodianRef = (res.custodian as { reference?: string })?.reference;
    const refKey = authorRef || custodianRef || "";
    let facilityName: string | undefined = orgMap.get(refKey) || (res.facility as string | undefined);

    if (!facilityName && refKey) {
      const cleanId = refKey.replace("Organization/", "");
      facilityName = orgMap.get(cleanId);
    }
    if (!facilityName) {
      facilityName = "PHC Navli (demo)";
    }
    allFacilities.add(facilityName);

    // Clinical note
    const section = (res.section as Array<{ title?: string; text?: { div?: string }; entry?: Array<{ reference?: string }> }>)?.[0];
    let clinicalNote = cleanHtmlDiv(section?.text?.div);
    clinicalNote = clinicalNote
      .replace(/\s*\(TODO-VERIFY[^)]*\)/g, "")
      .replace(/TODO-VERIFY:?\s*/g, "")
      .replace(/\s*\(-?\d+[dmy]\)/g, "")
      .trim();

    // Referenced items
    const items: ClinicalRecordItem[] = [];
    if (section?.entry && Array.isArray(section.entry)) {
      for (const itemRef of section.entry) {
        if (!itemRef.reference) continue;
        const targetRes = resourceMap.get(itemRef.reference);
        if (targetRes) {
          items.push(parseChildResource(targetRes));
        }
      }
    }

    compositions.push({
      id: res.id as string,
      type,
      title: (res.title as string) || type,
      facility: facilityName,
      date,
      rawDate,
      clinicalNote: clinicalNote || undefined,
      items,
    });
  }

  return { compositions, allFacilities };
}

// ---------------------------------------------------------------------------
// ABDM Client
// ---------------------------------------------------------------------------

export const abdmClient = {
  getConsent(patientId: string): ConsentRecord | null {
    const store = ensureConsentsFile();
    const consent = store[patientId];
    if (!consent) return null;

    const now = Date.now();
    let changed = false;

    if (
      consent.status === "REQUESTED" &&
      consent.simulation &&
      now >= consent.simulation.resolveAt
    ) {
      const outcome = consent.simulation.outcome;
      consent.status = outcome;
      consent.updatedAt = new Date(now).toISOString();
      consent.simulation = undefined;

      if (outcome === "GRANTED") {
        const expiry = new Date(now + 24 * 60 * 60 * 1000);
        consent.expiryDate = expiry.toISOString();
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

    const clinic = getClinicFacility();
    const requesterFacility = `${clinic.facilityName} (HIU-GJ-AND-042)`;

    const rng = seededRandom(hashString(patientId + now.getTime()));
    const rngVal = rng();

    let simulation: ConsentRecord["simulation"];
    if (isDemoMode()) {
      simulation = {
        outcome: "GRANTED",
        resolveAt: now.getTime(),
      };
    } else {
      const [minS, maxS] = AUTO_CONSENT_DELAY_RANGE;
      const delaySec = minS + rngVal * (maxS - minS);
      simulation = {
        outcome: pickSimulatedOutcome(rng()),
        resolveAt: now.getTime() + delaySec * 1000,
      };
    }

    const consent: ConsentRecord = {
      id: `consent-${patientId}-${Date.now()}`,
      patientId,
      abhaNumber,
      abhaAddress,
      requesterName: "Dr. Aditi Sharma",
      requesterFacility,
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
    consent.simulation = undefined;

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

  resetConsent(patientId: string): void {
    const store = ensureConsentsFile();
    delete store[patientId];
    saveConsents(store);
  },

  _getFacilitiesForPatient(patientId: string): string[] {
    const bundle = getPatientRecordBundle(patientId);
    if (!bundle) return ["PHC Navli (demo)"];
    const { allFacilities } = parseBundleIntoCompositions(bundle);
    return Array.from(allFacilities);
  },

  /**
   * Staged fetch delivering composition-grouped records
   */
  fetchRecordsStaged(patientId: string): {
    compositions: CompositionRecord[];
    records: RawClinicalRecord[]; // Flat legacy fallback
    hasRecords: boolean;
    facilityCount: number;
    pendingFacilities: string[];
    timedOutCount: number;
  } {
    const consent = this.getConsent(patientId);
    if (!consent || consent.status !== "GRANTED") {
      return {
        compositions: [],
        records: [],
        hasRecords: false,
        facilityCount: 0,
        pendingFacilities: [],
        timedOutCount: 0,
      };
    }

    const bundle = getPatientRecordBundle(patientId);
    if (!bundle) {
      return {
        compositions: [],
        records: [],
        hasRecords: false,
        facilityCount: 0,
        pendingFacilities: [],
        timedOutCount: 0,
      };
    }

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

    const { compositions } = parseBundleIntoCompositions(bundle);
    const filteredCompositions = compositions.filter((c) =>
      receivedFacilities.has(c.facility)
    );

    // Also build a flat raw records array for backward compatibility
    const flatRecords: RawClinicalRecord[] = [];
    for (const comp of filteredCompositions) {
      for (const item of comp.items) {
        flatRecords.push({
          id: item.id,
          sourceId: item.id,
          type: comp.type,
          facility: comp.facility,
          date: item.date || comp.date,
          display: item.display,
          details: item.details,
        });
      }
    }

    return {
      compositions: filteredCompositions,
      records: flatRecords,
      hasRecords: filteredCompositions.length > 0,
      facilityCount: receivedFacilities.size + timedOutCount,
      pendingFacilities,
      timedOutCount,
    };
  },
};
