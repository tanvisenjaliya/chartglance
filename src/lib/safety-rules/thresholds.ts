/**
 * Clinical Thresholds Configuration
 * Referenced from Indian National Health Programmes (NP-NCD, NTEP, AMB, ANC).
 * Status: DRAFT – pending doctor review.
 */

export const CLINICAL_THRESHOLDS = {
  // Rule 1: Anaemia Mukt Bharat & ANC Guidelines
  HAEMOGLOBIN_PREGNANCY_SEVERE: 7.0, // g/dL (Severe anaemia in pregnancy threshold)

  // Rule 2: NP-NCD Hypertension Crisis
  SYSTOLIC_BP_CRISIS: 180, // mmHg (Hypertensive urgency/emergency systolic threshold)
  DIASTOLIC_BP_CRISIS: 110, // mmHg (Hypertensive urgency/emergency diastolic threshold)

  // Rule 3: NTEP Tuberculosis Treatment Interruption
  TB_PICKUP_OVERDUE_DAYS: 14, // Days overdue without medicine pick-up while on active TB treatment

  // Rule 4: Medication Safety / Cross-Facility Duplication
  MED_DUPLICATION_WINDOW_DAYS: 90, // Days within which cross-facility prescriptions are checked

  // Rule 5: NP-NCD Diabetes Glycaemic Control
  HBA1C_CRITICAL: 9.0, // % (Poor glycaemic control / critical threshold)
} as const;

