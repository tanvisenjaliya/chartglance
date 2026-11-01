import fs from "fs";
import path from "path";
import type { SafetyAlert } from "./types";
import { CLINICAL_THRESHOLDS } from "./thresholds";

export interface FhirResource {
  resourceType: string;
  id: string;
  [key: string]: unknown;
}

/**
 * Normalises raw date or {{today...}} token to Date instance.
 */
export function parseFhirDate(rawDate?: string): Date | null {
  if (!rawDate) return null;
  const tokenMatch = rawDate.match(/\{\{today(?:([+-]\d+)([dmy]))?\}\}/);
  if (tokenMatch) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const n = tokenMatch[1];
    const u = tokenMatch[2];
    if (n && u) {
      const k = parseInt(n, 10);
      if (u === "d") d.setDate(d.getDate() + k);
      if (u === "m") d.setMonth(d.getMonth() + k);
      if (u === "y") d.setFullYear(d.getFullYear() + k);
    }
    return d;
  }

  const parsed = new Date(rawDate);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Extracts resources list from either a Bundle or a raw array of resources.
 */
export function extractResources(bundleOrResources: unknown): FhirResource[] {
  if (!bundleOrResources) return [];
  if (Array.isArray(bundleOrResources)) {
    return bundleOrResources.filter(
      (r) => r && typeof r === "object" && typeof r.resourceType === "string"
    ) as FhirResource[];
  }
  const obj = bundleOrResources as { resourceType?: string; entry?: Array<{ resource?: FhirResource }> };
  if (obj.resourceType === "Bundle" && Array.isArray(obj.entry)) {
    return obj.entry
      .map((e) => e.resource)
      .filter((r): r is FhirResource => Boolean(r && r.resourceType));
  }
  return [];
}

/**
 * RULE 1: Haemoglobin < 7 g/dL in pregnancy (Severe Anaemia)
 * Programme: Anaemia Mukt Bharat (AMB) & Maternal ANC Guidelines
 */
export function checkHaemoglobinInPregnancy(resources: FhirResource[]): SafetyAlert | null {
  // 1. Identify active pregnancy condition
  const conditions = resources.filter((r) => r.resourceType === "Condition");
  const pregnancyCondition = conditions.find((c) => {
    const codeObj = c.code as { text?: string; coding?: Array<{ display?: string; code?: string }> } | undefined;
    const text = (codeObj?.text || "").toLowerCase();
    const codingText = (codeObj?.coding || []).map((cd) => (cd.display || "").toLowerCase()).join(" ");
    return (
      text.includes("pregnan") ||
      text.includes("g2p") ||
      text.includes("g1p") ||
      text.includes("gravida") ||
      codingText.includes("pregnan")
    );
  });

  if (!pregnancyCondition) {
    return null;
  }

  // 2. Find Haemoglobin observations
  const observations = resources.filter((r) => r.resourceType === "Observation");
  const hbObservations = observations.filter((obs) => {
    const codeObj = obs.code as { text?: string; coding?: Array<{ code?: string; display?: string }> } | undefined;
    const isHbCode = codeObj?.coding?.some((cd) => cd.code === "718-7" || cd.display?.toLowerCase().includes("haemoglobin"));
    const isHbText = (codeObj?.text || "").toLowerCase().includes("haemoglobin") || (codeObj?.text || "").toLowerCase().includes("hemoglobin");
    return isHbCode || isHbText;
  });

  if (hbObservations.length === 0) {
    return null;
  }

  // Sort by effective date descending to get latest
  hbObservations.sort((a, b) => {
    const dateA = parseFhirDate(a.effectiveDateTime as string)?.getTime() || 0;
    const dateB = parseFhirDate(b.effectiveDateTime as string)?.getTime() || 0;
    return dateB - dateA;
  });

  const latestHbObs = hbObservations[0];
  const valueQuantity = latestHbObs.valueQuantity as { value?: number } | undefined;
  const hbVal = valueQuantity?.value;

  if (typeof hbVal === "number" && hbVal < CLINICAL_THRESHOLDS.HAEMOGLOBIN_PREGNANCY_SEVERE) {
    return {
      ruleId: "R-ANAEMIA-PREGNANCY",
      ruleName: "Severe Anaemia in Pregnancy",
      severity: "CRITICAL",
      programme: "Anaemia Mukt Bharat / ANC Guidelines",
      message: `Severe anaemia in pregnancy: latest Hb ${hbVal} g/dL (< ${CLINICAL_THRESHOLDS.HAEMOGLOBIN_PREGNANCY_SEVERE} g/dL threshold)`,
      sourceIds: [latestHbObs.id, pregnancyCondition.id],
      rationale: "Haemoglobin < 7 g/dL during pregnancy carries high risk of maternal heart failure, pre-term delivery and postpartum hemorrhage. Requires urgent specialist referral and parenteral iron/transfusion workup.",
    };
  }

  return null;
}

/**
 * RULE 2: Latest BP ≥ 180/110 (Hypertensive Crisis / Severe Hypertension)
 * Programme: NP-NCD
 */
export function checkHypertensiveCrisis(resources: FhirResource[]): SafetyAlert | null {
  const observations = resources.filter((r) => r.resourceType === "Observation");

  const systolicReadings: Array<{ id: string; date: number; value: number }> = [];
  const diastolicReadings: Array<{ id: string; date: number; value: number }> = [];

  for (const obs of observations) {
    const codeObj = obs.code as { text?: string; coding?: Array<{ code?: string; display?: string }> } | undefined;
    const date = parseFhirDate(obs.effectiveDateTime as string)?.getTime() || 0;
    const val = (obs.valueQuantity as { value?: number } | undefined)?.value;

    const isSystolic =
      codeObj?.coding?.some((cd) => cd.code === "8480-6") ||
      (codeObj?.text || "").toLowerCase().includes("systolic");

    const isDiastolic =
      codeObj?.coding?.some((cd) => cd.code === "8462-4") ||
      (codeObj?.text || "").toLowerCase().includes("diastolic");

    if (isSystolic && typeof val === "number") {
      systolicReadings.push({ id: obs.id, date, value: val });
    }
    if (isDiastolic && typeof val === "number") {
      diastolicReadings.push({ id: obs.id, date, value: val });
    }
  }

  if (systolicReadings.length === 0 && diastolicReadings.length === 0) {
    return null;
  }

  systolicReadings.sort((a, b) => b.date - a.date);
  diastolicReadings.sort((a, b) => b.date - a.date);

  const latestSys = systolicReadings[0];
  const latestDia = diastolicReadings[0];

  const sysVal = latestSys ? latestSys.value : 0;
  const diaVal = latestDia ? latestDia.value : 0;

  if (sysVal >= CLINICAL_THRESHOLDS.SYSTOLIC_BP_CRISIS || diaVal >= CLINICAL_THRESHOLDS.DIASTOLIC_BP_CRISIS) {
    const sourceIds: string[] = [];
    if (latestSys) sourceIds.push(latestSys.id);
    if (latestDia && latestDia.id !== latestSys?.id) sourceIds.push(latestDia.id);

    return {
      ruleId: "R-HYPERTENSION-CRISIS",
      ruleName: "Hypertensive Urgency / Crisis",
      severity: "CRITICAL",
      programme: "NP-NCD",
      message: `Severe hypertension: latest BP ${sysVal}/${diaVal} mmHg (≥ ${CLINICAL_THRESHOLDS.SYSTOLIC_BP_CRISIS}/${CLINICAL_THRESHOLDS.DIASTOLIC_BP_CRISIS} threshold)`,
      sourceIds,
      rationale: "BP ≥ 180/110 mmHg indicates hypertensive crisis with immediate risk of encephalopathy, stroke, acute coronary event or renal failure.",
    };
  }

  return null;
}

/**
 * RULE 3: TB medicine pick-up overdue by more than 14 days
 * Programme: NTEP
 */
export function checkTbMedicationPickUp(resources: FhirResource[]): SafetyAlert | null {
  const conditions = resources.filter((r) => r.resourceType === "Condition");
  const tbCondition = conditions.find((c) => {
    const text = ((c.code as { text?: string })?.text || "").toLowerCase();
    const codingText = (((c.code as { coding?: Array<{ display?: string }> })?.coding || [])
      .map((cd) => (cd.display || "").toLowerCase())
      .join(" "));
    return text.includes("tuberculosis") || codingText.includes("tuberculosis");
  });

  const medicationRequests = resources.filter((r) => r.resourceType === "MedicationRequest");
  const tbMed = medicationRequests.find((m) => {
    const medText = ((m.medicationCodeableConcept as { text?: string })?.text || "").toLowerCase();
    return (
      medText.includes("hrze") ||
      medText.includes("anti-tb") ||
      medText.includes("rifampicin") ||
      medText.includes("isoniazid")
    );
  });

  if (!tbCondition && !tbMed) {
    return null;
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const appointments = resources.filter((r) => r.resourceType === "Appointment");
  const tbAppointment = appointments.find((a) => {
    const desc = ((a.description as string) || "").toLowerCase();
    return desc.includes("pick-up") || desc.includes("pickup") || desc.includes("tb medicine");
  });

  let overdueDays = 0;
  const sourceIds: string[] = [];

  if (tbAppointment) {
    const apptDate = parseFhirDate(tbAppointment.start as string);
    if (apptDate) {
      const diffMs = now.getTime() - apptDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > overdueDays) {
        overdueDays = diffDays;
        sourceIds.push(tbAppointment.id);
      }
    }
  }

  const dispenses = resources.filter((r) => r.resourceType === "MedicationDispense");
  if (dispenses.length > 0) {
    dispenses.sort((a, b) => {
      const dateA = parseFhirDate(a.whenHandedOver as string)?.getTime() || 0;
      const dateB = parseFhirDate(b.whenHandedOver as string)?.getTime() || 0;
      return dateB - dateA;
    });

    const lastDispense = dispenses[0];
    const dispenseDate = parseFhirDate(lastDispense.whenHandedOver as string);
    if (dispenseDate) {
      const daysSinceDispense = Math.floor((now.getTime() - dispenseDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysOverdue = daysSinceDispense - 28;
      if (daysOverdue > overdueDays) {
        overdueDays = daysOverdue;
        sourceIds.push(lastDispense.id);
      }
    }
  }

  if (tbCondition) sourceIds.push(tbCondition.id);
  else if (tbMed) sourceIds.push(tbMed.id);

  if (overdueDays > CLINICAL_THRESHOLDS.TB_PICKUP_OVERDUE_DAYS) {
    return {
      ruleId: "R-TB-TREATMENT-GAP",
      ruleName: "TB Treatment Interruption",
      severity: "HIGH",
      programme: "NTEP",
      message: `TB treatment interruption: medicine pick-up overdue by ${overdueDays} days (> ${CLINICAL_THRESHOLDS.TB_PICKUP_OVERDUE_DAYS} days threshold)`,
      sourceIds: Array.from(new Set(sourceIds)),
      rationale: "A treatment gap exceeding 14 days during Intensive Phase TB therapy risks treatment failure, relapse, and development of multi-drug resistant tuberculosis (MDR-TB). Immediate ASHA home tracing required.",
    };
  }

  return null;
}

let cachedDrugClasses: Record<string, string> | null = null;
function getDrugClasses(): Record<string, string> {
  if (cachedDrugClasses) return cachedDrugClasses;
  try {
    const filePath = path.join(process.cwd(), "data", "reference", "drug-classes.json");
    if (fs.existsSync(filePath)) {
      cachedDrugClasses = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return cachedDrugClasses!;
    }
  } catch {
    // Fallback
  }
  return {
    "Metformin": "Biguanide",
    "Glimepiride": "Sulfonylurea",
    "Gliclazide": "Sulfonylurea",
    "Amlodipine": "Calcium channel blocker",
    "Telmisartan": "Angiotensin receptor blocker",
  };
}

/**
 * RULE 4: Two medicines from the same drug class for the same condition, from different facilities within 90 days
 * Reference: Medication Safety / CDSS cross-facility conflict
 */
export function checkDrugClassDuplication(resources: FhirResource[]): SafetyAlert | null {
  const drugClasses = getDrugClasses();
  const medicationRequests = resources.filter(
    (r) => r.resourceType === "MedicationRequest" && r.status === "active"
  );

  if (medicationRequests.length < 2) {
    return null;
  }

  const encounters = new Map<string, FhirResource>();
  for (const r of resources) {
    if (r.resourceType === "Encounter") encounters.set(r.id, r);
  }

  const compositions = new Map<string, FhirResource>();
  for (const r of resources) {
    if (r.resourceType === "Composition") compositions.set(r.id, r);
  }

  const conditions = new Map<string, FhirResource>();
  for (const r of resources) {
    if (r.resourceType === "Condition") conditions.set(r.id, r);
  }

  interface MedInfo {
    id: string;
    drugName: string;
    drugClass: string;
    facility: string;
    date: Date;
    conditionName: string;
  }

  const parsedMeds: MedInfo[] = [];

  for (const med of medicationRequests) {
    const drugName = ((med.medicationCodeableConcept as { text?: string })?.text || "").trim();
    const drugClass = drugClasses[drugName];
    if (!drugClass) continue;

    const encRef = (med.encounter as { reference?: string })?.reference?.replace("Encounter/", "");

    let date = parseFhirDate(med.authoredOn as string);
    if (!date && encRef && encounters.has(encRef)) {
      const enc = encounters.get(encRef)!;
      const period = enc.period as { start?: string } | undefined;
      date = parseFhirDate(period?.start);
    }
    if (!date && encRef) {
      for (const comp of Array.from(compositions.values())) {
        const compEncRef = (comp.encounter as { reference?: string })?.reference?.replace("Encounter/", "");
        if (compEncRef === encRef) {
          date = parseFhirDate(comp.date as string);
          break;
        }
      }
    }
    if (!date) {
      date = new Date(0);
    }

    let facility = (med.requester as { reference?: string })?.reference || "";
    if (!facility && encRef && encounters.has(encRef)) {
      const enc = encounters.get(encRef)!;
      facility = (enc.serviceProvider as { reference?: string })?.reference || "";
    }
    if (!facility && encRef) {
      for (const comp of Array.from(compositions.values())) {
        const compEncRef = (comp.encounter as { reference?: string })?.reference?.replace("Encounter/", "");
        if (compEncRef === encRef) {
          const authorRef = ((comp.author as Array<{ reference?: string }>)?.[0])?.reference;
          if (authorRef) {
            facility = authorRef;
            break;
          }
        }
      }
    }

    let conditionName = "";
    if (encRef) {
      for (const cond of Array.from(conditions.values())) {
        const condEncRef = (cond.encounter as { reference?: string })?.reference?.replace("Encounter/", "");
        if (condEncRef === encRef) {
          conditionName = ((cond.code as { text?: string })?.text || "").trim();
          break;
        }
      }
    }

    if (!conditionName) {
      if (drugClass === "Sulfonylurea" || drugClass === "Biguanide") {
        conditionName = "Type 2 diabetes mellitus";
      } else if (drugClass === "Calcium channel blocker" || drugClass === "Angiotensin receptor blocker") {
        conditionName = "Hypertension";
      }
    }

    parsedMeds.push({
      id: med.id,
      drugName,
      drugClass,
      facility: facility || "Unknown Facility",
      date,
      conditionName: conditionName.toLowerCase(),
    });
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = 0; i < parsedMeds.length; i++) {
    for (let j = i + 1; j < parsedMeds.length; j++) {
      const medA = parsedMeds[i];
      const medB = parsedMeds[j];

      if (medA.drugClass !== medB.drugClass) continue;

      const sameCondition =
        medA.conditionName === medB.conditionName ||
        (medA.conditionName.includes("diabet") && medB.conditionName.includes("diabet")) ||
        (medA.conditionName.includes("hypertens") && medB.conditionName.includes("hypertens"));

      if (!sameCondition) continue;

      if (medA.facility === medB.facility) continue;

      const diffMs = Math.abs(medA.date.getTime() - medB.date.getTime());
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const daysFromNowA = Math.floor((now.getTime() - medA.date.getTime()) / (1000 * 60 * 60 * 24));
      const daysFromNowB = Math.floor((now.getTime() - medB.date.getTime()) / (1000 * 60 * 60 * 24));

      if (
        diffDays <= CLINICAL_THRESHOLDS.MED_DUPLICATION_WINDOW_DAYS &&
        daysFromNowA <= CLINICAL_THRESHOLDS.MED_DUPLICATION_WINDOW_DAYS &&
        daysFromNowB <= CLINICAL_THRESHOLDS.MED_DUPLICATION_WINDOW_DAYS
      ) {
        return {
          ruleId: "R-MED-DUPLICATION",
          ruleName: "Cross-Facility Duplicate Therapy",
          severity: "HIGH",
          programme: "Medication Safety / NRCeS CDSS",
          message: `Conflicting duplicate therapy: ${medA.drugName} and ${medB.drugName} (both ${medA.drugClass}) prescribed across different facilities within 90 days`,
          sourceIds: [medA.id, medB.id],
          rationale: "Concurrent prescription of two agents from the same therapeutic drug class across different facilities creates severe risk of additive adverse effects (e.g. profound hypoglycemia with dual sulfonylureas).",
        };
      }
    }
  }

  return null;
}

/**
 * RULE 5: HbA1c ≥ 9% (Critical Uncontrolled Diabetes)
 * Programme: NP-NCD
 */
export function checkHbA1cCritical(resources: FhirResource[]): SafetyAlert | null {
  const observations = resources.filter((r) => r.resourceType === "Observation");
  const hba1cObservations = observations.filter((obs) => {
    const codeObj = obs.code as { text?: string; coding?: Array<{ code?: string; display?: string }> } | undefined;
    const isHbA1cCode = codeObj?.coding?.some((cd) => cd.code === "4548-4" || cd.display?.toLowerCase().includes("hba1c"));
    const isHbA1cText = (codeObj?.text || "").toLowerCase().includes("hba1c");
    return isHbA1cCode || isHbA1cText;
  });

  if (hba1cObservations.length === 0) {
    return null;
  }

  hba1cObservations.sort((a, b) => {
    const dateA = parseFhirDate(a.effectiveDateTime as string)?.getTime() || 0;
    const dateB = parseFhirDate(b.effectiveDateTime as string)?.getTime() || 0;
    return dateB - dateA;
  });

  const latestObs = hba1cObservations[0];
  const val = (latestObs.valueQuantity as { value?: number } | undefined)?.value;

  if (typeof val === "number" && val >= CLINICAL_THRESHOLDS.HBA1C_CRITICAL) {
    return {
      ruleId: "R-HBA1C-CRITICAL",
      ruleName: "Severe Uncontrolled Diabetes (HbA1c ≥ 9%)",
      severity: "HIGH",
      programme: "NP-NCD",
      message: `Poor glycaemic control: latest HbA1c ${val}% (≥ ${CLINICAL_THRESHOLDS.HBA1C_CRITICAL}% threshold)`,
      sourceIds: [latestObs.id],
      rationale: "HbA1c ≥ 9.0% indicates severely decompensated blood glucose regulation, high risk of acute metabolic complications, and accelerated microvascular/macrovascular end-organ damage.",
    };
  }

  return null;
}
