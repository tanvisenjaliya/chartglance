# ChartGlance synthetic ABHA dataset – Gujarat

25 synthetic patients for one OPD morning at PHC Navli (demo), Anand district, Gujarat.
**Not real patients.** Facility names are demo placeholders; replace with your own clinic's name.

## Files
- `patients.json` – today's OPD queue: token, demographics, village, ABHA number/address,
  complaint, arrival time, visit type, data status, record count, facilities, link to records.
- `records/<id>.json` – one FHIR R4 `Bundle` per patient: everything the mock ABDM gateway
  returns AFTER consent is granted.
- `reference/facilities.json` – mock HIPs (facilities) that hold records.
- `reference/drug-classes.json` – drug → class lookup for rule R6 (duplication).
- `PATIENT_OVERVIEW.md` – one-page table to send to the doctor for review.

## Structure (follows NRCeS ABDM profile names)
Each health record (= one ABDM care context) is a `Composition` whose `meta.profile` is one of
OPConsultRecord, PrescriptionRecord, DiagnosticReportRecord, DischargeSummaryRecord,
ImmunizationRecord, HealthDocumentRecord. Its section holds the free-text clinical note
(realistic shorthand, e.g. "k/c/o T2DM") and references to Condition, Observation (LOINC),
MedicationRequest, MedicationDispense, Immunization, DocumentReference and Appointment.
`recordCount` = number of Compositions. Profiles are approximations; validate against the
NRCeS IG before any real integration.

## Relative dates
Dates are tokens resolved at load time, so the demo never goes stale:
`{{today}}`, `{{today-90d}}`, `{{today+5d}}`, `{{today-52y}}`.

```ts
const resolveDates = (json: string) =>
  json.replace(/\{\{today(?:([+-]\d+)([dmy]))?\}\}/g, (_, n, u) => {
    const d = new Date();
    if (n) {
      const k = parseInt(n, 10);
      if (u === "d") d.setDate(d.getDate() + k);
      if (u === "m") d.setMonth(d.getMonth() + k);
      if (u === "y") d.setFullYear(d.getFullYear() + k);
    }
    return d.toISOString().slice(0, 10);
  });
```

## Distribution
- ABHA: all 25 patients are ABHA-registered, each with a unique 14-digit ABHA number
  (XX-XXXX-XXXX-XXXX) and ABHA address (name@sbx). Both are mandatory.
- Records: every patient has at least one record. 17 have one, 8 have two or more.
  Several single records are old (up to 3 years), so sparse history is still represented.
- Location: all live in Anand district, Gujarat (Navli, Petlad, Bakrol, Sojitra, Umreth,
  Karamsad, Vidyanagar, Khambhat, Bhalej, Anand). Two are migrants (Rajasthan, Uttar Pradesh);
  one has records from a Rajasthan facility, showing ABHA's cross-state portability.
- Ages 7 to 82: 1 child, 1 teenager, the rest spread across every adult decade including 80+.
- Gender: 13 female, 11 male, 1 other.

## Planted test cases for the rules engine
- P01 Ramesh Patel: HbA1c 7.8 → 8.4 → 9.2 (R1); BP 182/112 (R2); 30-day follow-up and eye
  check overdue (R5); no kidney function test on record (missing).
- P02 Hetal Parmar: Hb 6.8 g/dL in pregnancy (R3); next ANC visit in 5 days.
- P03 Shankar Meena: TB diagnosed in Rajasthan, pick-ups stopped; last due 28 days ago (R4).
- P04 Manjula Rathod: only one record, 3 years old (sparse history; "last record 3 years ago").
- P05 Kantilal Shah: glimepiride + gliclazide, both sulfonylureas, from two facilities (R6);
  one scanned PDF.
- Other cases worth noticing: B07 asthma review after discharge overdue, B10 COPD review
  overdue, B11 repeat TSH overdue, B13 BP recheck never done, B14 creatinine rising 1.9 → 2.3,
  B16 only a scanned PDF, B18 silicosis referral not attended, B20 BPH review overdue,
  B25 diabetes review overdue.

All clinical values are TODO-VERIFY until reviewed by a doctor.
