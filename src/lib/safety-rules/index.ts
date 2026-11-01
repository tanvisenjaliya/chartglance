import type { SafetyAlert } from "./types";
import type { FhirResource } from "./rules";
import {
  extractResources,
  checkHaemoglobinInPregnancy,
  checkHypertensiveCrisis,
  checkTbMedicationPickUp,
  checkDrugClassDuplication,
  checkHbA1cCritical,
} from "./rules";

export type * from "./types";
export * from "./thresholds";
export {
  checkHaemoglobinInPregnancy,
  checkHypertensiveCrisis,
  checkTbMedicationPickUp,
  checkDrugClassDuplication,
  checkHbA1cCritical,
  extractResources,
};

/**
 * Runs all five must-never-miss safety rules against a patient's FHIR record bundle.
 * Returns an array of triggered safety alerts.
 * If patient has no records or no alerts triggered, returns an empty array.
 */
export function evaluatePatientSafety(bundleOrResources: unknown): SafetyAlert[] {
  const resources: FhirResource[] = extractResources(bundleOrResources);
  if (resources.length === 0) {
    return [];
  }

  const alerts: SafetyAlert[] = [];

  // 1. Haemoglobin < 7 g/dL in pregnancy
  const r1 = checkHaemoglobinInPregnancy(resources);
  if (r1) alerts.push(r1);

  // 2. Latest BP ≥ 180/110
  const r2 = checkHypertensiveCrisis(resources);
  if (r2) alerts.push(r2);

  // 3. TB medicine pick-up overdue > 14 days
  const r3 = checkTbMedicationPickUp(resources);
  if (r3) alerts.push(r3);

  // 4. Two medicines from same drug class for same condition across facilities in 90 days
  const r4 = checkDrugClassDuplication(resources);
  if (r4) alerts.push(r4);

  // 5. HbA1c ≥ 9%
  const r5 = checkHbA1cCritical(resources);
  if (r5) alerts.push(r5);

  return alerts;
}

