import fs from "fs";
import path from "path";
import { resolveOffsetDate, formatClinicalDate } from "@/lib/records";

export type ConsentStatus =
  | "NOT_REQUESTED"
  | "REQUESTED"
  | "GRANTED"
  | "DENIED"
  | "EXPIRED"
  | "REVOKED";

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
  expiryDate: string; // ISO string, 24h from creation
  status: ConsentStatus;
  createdAt: string;
  updatedAt: string;
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

export const abdmClient = {
  /**
   * Retrieves the current consent record for a patient.
   * Auto-evaluates real-time 24h expiration.
   */
  getConsent(patientId: string): ConsentRecord | null {
    const store = ensureConsentsFile();
    const consent = store[patientId];
    if (!consent) return null;

    // Check expiry if currently GRANTED
    if (consent.status === "GRANTED") {
      const now = new Date();
      const exp = new Date(consent.expiryDate);
      if (now > exp) {
        consent.status = "EXPIRED";
        consent.updatedAt = now.toISOString();
        store[patientId] = consent;
        saveConsents(store);
      }
    }

    return consent;
  },

  /**
   * Creates a mock consent request from the doctor with purpose CAREMGT and 24-hour expiry.
   * Doctor CANNOT grant consent; this sets status strictly to REQUESTED.
   */
  createConsentRequest(
    patientId: string,
    abhaNumber: string,
    abhaAddress: string
  ): ConsentRecord {
    const store = ensureConsentsFile();
    const now = new Date();
    const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours later
    const fromDate = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const toDate = now.toISOString().split("T")[0];

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
      dateRange: {
        from: fromDate,
        to: toDate,
      },
      expiryDate: expiry.toISOString(),
      status: "REQUESTED",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    store[patientId] = consent;
    saveConsents(store);
    return consent;
  },

  /**
   * Approves consent (called ONLY from the patient phone screen).
   * Sets status to GRANTED.
   */
  approveConsent(patientId: string): ConsentRecord {
    const store = ensureConsentsFile();
    const consent = store[patientId];
    if (!consent) {
      throw new Error(`Consent request for patient ${patientId} not found`);
    }

    const now = new Date();
    // Refresh 24h validity from approval moment
    const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    consent.status = "GRANTED";
    consent.expiryDate = expiry.toISOString();
    consent.updatedAt = now.toISOString();

    store[patientId] = consent;
    saveConsents(store);
    return consent;
  },

  /**
   * Denies consent (called ONLY from the patient phone screen).
   * Sets status to DENIED.
   */
  denyConsent(patientId: string): ConsentRecord {
    const store = ensureConsentsFile();
    const consent = store[patientId];
    if (!consent) {
      throw new Error(`Consent request for patient ${patientId} not found`);
    }

    consent.status = "DENIED";
    consent.updatedAt = new Date().toISOString();

    store[patientId] = consent;
    saveConsents(store);
    return consent;
  },

  /**
   * Simulates immediate expiry for testing/demo purposes.
   */
  expireConsent(patientId: string): ConsentRecord {
    const store = ensureConsentsFile();
    const consent = store[patientId];
    if (!consent) {
      throw new Error(`Consent request for patient ${patientId} not found`);
    }

    consent.status = "EXPIRED";
    consent.expiryDate = new Date(Date.now() - 60000).toISOString();
    consent.updatedAt = new Date().toISOString();

    store[patientId] = consent;
    saveConsents(store);
    return consent;
  },

  /**
   * Resets consent to NOT_REQUESTED for demo repetition.
   */
  resetConsent(patientId: string): void {
    const store = ensureConsentsFile();
    delete store[patientId];
    saveConsents(store);
  },

  /**
   * Delivers raw health records from participating facilities.
   * Permitted ONLY when consent status is GRANTED.
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

    // Persona 1 (Ramesh Patel) has records in /data/records/persona-1.json
    if (patientId === "p1") {
      const recordsFile = path.join(process.cwd(), "data", "records", "persona-1.json");
      if (!fs.existsSync(recordsFile)) {
        return { records: [], hasRecords: false, facilityCount: 0 };
      }

      const bundle = JSON.parse(fs.readFileSync(recordsFile, "utf-8"));
      const rawRecords: RawClinicalRecord[] = [];
      const facilities = new Set<string>();

      for (const entry of bundle.entry || []) {
        const res = entry.resource;
        if (!res) continue;

        const facility = res.facility || "CHC Shirur (HIP-MH-PUN-001)";
        facilities.add(facility);

        if (res.resourceType === "Encounter") {
          const resolved = resolveOffsetDate(res.periodOffsetDays ?? 0);
          rawRecords.push({
            id: res.id,
            sourceId: res.sourceId,
            type: "OPConsultation",
            facility,
            date: formatClinicalDate(resolved),
            display: res.reasonCode?.[0]?.text || "Outpatient Clinical Consultation",
            details: "Clinical consult record",
          });
        } else if (res.resourceType === "Observation") {
          const resolved = resolveOffsetDate(res.effectiveDateTimeOffsetDays ?? 0);
          let display = res.code?.text || "Clinical Lab Observation";
          let details = "";
          if (res.valueQuantity) {
            display = `${display}: ${res.valueQuantity.value} ${res.valueQuantity.unit}`;
          } else if (Array.isArray(res.component)) {
            interface ObsComp {
              code?: { coding?: Array<{ code?: string }> };
              valueQuantity?: { value?: number };
            }
            const comps = res.component as ObsComp[];
            const sys = comps.find((c) => c.code?.coding?.[0]?.code === "8480-6")?.valueQuantity?.value;
            const dia = comps.find((c) => c.code?.coding?.[0]?.code === "8462-4")?.valueQuantity?.value;
            display = `${display}: ${sys}/${dia} mmHg`;
          }
          if (res.note?.[0]?.text) {
            details = res.note[0].text;
          }
          rawRecords.push({
            id: res.id,
            sourceId: res.sourceId,
            type: "DiagnosticReport",
            facility,
            date: formatClinicalDate(resolved),
            display,
            details,
          });
        } else if (res.resourceType === "MedicationRequest") {
          const resolved = resolveOffsetDate(res.authoredOnOffsetDays ?? 0);
          rawRecords.push({
            id: res.id,
            sourceId: res.sourceId,
            type: "Prescription",
            facility,
            date: formatClinicalDate(resolved),
            display: res.medicationCodeableConcept?.text || "Medication Order",
            details: res.dosageInstruction?.[0]?.text,
          });
        } else if (res.resourceType === "Condition") {
          const resolved = resolveOffsetDate(res.recordedDateOffsetDays ?? 0);
          rawRecords.push({
            id: res.id,
            sourceId: res.sourceId,
            type: "HealthDocument",
            facility,
            date: formatClinicalDate(resolved),
            display: `Condition: ${res.code?.text || "Medical Condition"}`,
            details: `Status: ${res.clinicalStatus?.coding?.[0]?.code || "active"}`,
          });
        }
      }

      return {
        records: rawRecords,
        hasRecords: rawRecords.length > 0,
        facilityCount: facilities.size,
      };
    }

    // For other personas (p2, p3, p4, p5) currently without uploaded record bundles:
    return { records: [], hasRecords: false, facilityCount: 0 };
  },
};
