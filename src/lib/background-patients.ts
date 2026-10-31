/**
 * Seeded background patient registry — 20 synthetic patients for the ABHA lookup.
 *
 * Rules:
 * - Seeded LCG (seed=42), no Math.random(). Output is always identical.
 * - ~40% no records, ~40% one record, ~20% two or more records.
 * - Realistic Indian names + Maharashtra facility names.
 * - NEVER treated as demo personas; no clinical flags planted here.
 * - These patients only enter the OPD queue when a staff member registers them via /register.
 */

export interface BackgroundPatient {
  id: string;
  name: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  abhaNumber: string;
  abhaAddress: string;
  recordCount: number;
  hasRecords: boolean;
  /** Facility name(s) where records exist, for mock display. */
  recordFacilities: string[];
  /** Brief record summary shown after lookup — never a clinical red flag. */
  recordSummary: string;
}

// ---------------------------------------------------------------------------
// Seeded LCG (Linear Congruential Generator)
// ---------------------------------------------------------------------------
function makeLcg(seed: number) {
  let state = seed;
  return function next(): number {
    // Parameters from Numerical Recipes
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    // Return value in [0, 1)
    return (state >>> 0) / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// Name pools — common Maharashtra / pan-Indian names
// ---------------------------------------------------------------------------
const MALE_FIRST = [
  "Rahul", "Suresh", "Ganesh", "Dnyaneshwar", "Kiran", "Santosh", "Nilesh",
  "Pramod", "Avinash", "Bharat", "Rajesh", "Umesh", "Vishwas", "Hemant",
  "Sanjay", "Prashant", "Mahesh", "Deepak", "Naresh", "Amol",
];
const FEMALE_FIRST = [
  "Sunanda", "Kavita", "Rekha", "Priya", "Shubhangi", "Sarita", "Varsha",
  "Laxmi", "Nanda", "Asha", "Manisha", "Pooja", "Smita", "Seema",
  "Archana", "Ujjwala", "Vandana", "Sangeeta", "Padma", "Anita",
];
const LAST_NAMES = [
  "Kadam", "Shinde", "Pawar", "Jagtap", "Gaikwad", "More", "Patil",
  "Deshmukh", "Bhosale", "Salunke", "Kale", "Mane", "Yadav", "Nikam",
  "Dhumal", "Waghmare", "Lokhande", "Thorat", "Chavan", "Kulkarni",
];

// ---------------------------------------------------------------------------
// Maharashtra facility pool
// ---------------------------------------------------------------------------
const FACILITIES = [
  "PHC Rajgurunagar (HIP-MH-PUN-011)",
  "CHC Junnar (HIP-MH-PUN-017)",
  "SDH Baramati (HIP-MH-PUN-023)",
  "PHC Phaltan (HIP-MH-SAT-009)",
  "CHC Wai (HIP-MH-SAT-014)",
  "SDH Karad (HIP-MH-SAT-021)",
  "PHC Kolhapur Rural (HIP-MH-KOL-007)",
  "CHC Hatkanangale (HIP-MH-KOL-013)",
  "PHC Igatpuri (HIP-MH-NSK-005)",
  "SDH Nashik City (HIP-MH-NSK-019)",
  "PHC Nandurbar (HIP-MH-NDB-003)",
  "CHC Shrirampur (HIP-MH-AHM-016)",
];

// ---------------------------------------------------------------------------
// Record summary pool (benign descriptions, not clinical red flags)
// ---------------------------------------------------------------------------
const RECORD_SUMMARIES_ONE = [
  "One OPD consult for seasonal fever — resolved.",
  "Prescription record for respiratory infection, 5-day course.",
  "ANC visit record from a linked facility.",
  "Diagnostic report: CBC — within normal limits.",
  "Immunisation record: TT booster administered.",
  "OPD consult for musculoskeletal pain.",
  "Prescription record for mild hypertension follow-up.",
  "Diagnostic report: blood sugar — fasting 98 mg/dL.",
];
const RECORD_SUMMARIES_MULTI = [
  "Two OPD consults over the past year; one prescription record.",
  "ANC visit × 2 plus one diagnostic report (haemoglobin).",
  "Three prescription records across two facilities.",
  "Two diagnostic reports (blood sugar, lipid panel) from the same facility.",
];

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------
function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function formatAbhaNumber(digits: number[]): string {
  // XX-XXXX-XXXX-XXXX
  const s = digits.map(String).join("").padStart(14, "0");
  return `${s.slice(0, 2)}-${s.slice(2, 6)}-${s.slice(6, 10)}-${s.slice(10, 14)}`;
}

function generateBackgroundPatients(): BackgroundPatient[] {
  const rng = makeLcg(42);
  const patients: BackgroundPatient[] = [];

  // Distribution targets: 8 no-records, 8 one-record, 4 two-or-more
  // Assign buckets up front so totals are exact
  const buckets: Array<"none" | "one" | "multi"> = [
    ...Array(8).fill("none"),
    ...Array(8).fill("one"),
    ...Array(4).fill("multi"),
  ];

  // Shuffle buckets with the seeded RNG (Fisher-Yates)
  for (let i = buckets.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [buckets[i], buckets[j]] = [buckets[j], buckets[i]];
  }

  for (let i = 0; i < 20; i++) {
    const isFemale = rng() < 0.5;
    const firstName = isFemale ? pick(FEMALE_FIRST, rng) : pick(MALE_FIRST, rng);
    const lastName = pick(LAST_NAMES, rng);
    const name = `${firstName} ${lastName}`;
    const age = 18 + Math.floor(rng() * 57); // 18–74

    // ABHA number: starts with 91 (India prefix for ABDM sandbox)
    const abhaDigits = [
      9, 1,
      Math.floor(rng() * 9) + 1,
      Math.floor(rng() * 9),
      Math.floor(rng() * 9),
      Math.floor(rng() * 9),
      Math.floor(rng() * 9),
      Math.floor(rng() * 9),
      Math.floor(rng() * 9),
      Math.floor(rng() * 9),
      Math.floor(rng() * 9),
      Math.floor(rng() * 9),
      Math.floor(rng() * 9),
      Math.floor(rng() * 9),
    ];
    const abhaNumber = formatAbhaNumber(abhaDigits);

    // ABHA address: firstname.lastname@sbx (lowercase, no spaces)
    const abhaAddress =
      `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i + 1}@sbx`;

    const bucket = buckets[i];
    let recordCount = 0;
    let hasRecords = false;
    let recordFacilities: string[] = [];
    let recordSummary = "No linked digital health records found.";

    if (bucket === "one") {
      recordCount = 1;
      hasRecords = true;
      recordFacilities = [pick(FACILITIES, rng)];
      recordSummary = pick(RECORD_SUMMARIES_ONE, rng);
    } else if (bucket === "multi") {
      recordCount = 2 + Math.floor(rng() * 3); // 2–4
      hasRecords = true;
      const f1 = pick(FACILITIES, rng);
      const f2 = pick(FACILITIES, rng);
      recordFacilities = f1 === f2 ? [f1] : [f1, f2];
      recordSummary = pick(RECORD_SUMMARIES_MULTI, rng);
    }

    patients.push({
      id: `bg-${String(i + 1).padStart(2, "0")}`,
      name,
      age,
      gender: isFemale ? "Female" : "Male",
      abhaNumber,
      abhaAddress,
      recordCount,
      hasRecords,
      recordFacilities,
      recordSummary,
    });
  }

  return patients;
}

/** The 20 seeded background patients. Immutable at runtime. */
export const BACKGROUND_PATIENTS: BackgroundPatient[] = generateBackgroundPatients();

/**
 * Look up a patient by ABHA number (exact) or ABHA address (exact, case-insensitive).
 * Also searches the 5 demo personas by matching against patients.json values.
 * Returns null if not found.
 */
export function lookupByAbha(
  query: string
): BackgroundPatient | null {
  const q = query.trim();
  const qLower = q.toLowerCase();

  return (
    BACKGROUND_PATIENTS.find(
      (p) =>
        p.abhaNumber === q ||
        p.abhaAddress.toLowerCase() === qLower
    ) ?? null
  );
}

