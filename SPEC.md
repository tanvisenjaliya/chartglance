# ChartGlance – Project Spec

> Read this file before every task. If a request conflicts with this spec, stop and ask.

## 1. Product context

**Problem statement:** Build an AI-powered clinical assistant that, with the patient's consent,
uses their ABHA-linked (Ayushman Bharat Digital Mission) records to:
1. Summarise the relevant medical history in seconds
2. Highlight critical risk factors and overdue follow-ups
3. Help doctors prioritise attention across the OPD queue
4. Show clearly when information is missing

**The moment we design for:** a patient sits down in a Primary Health Centre (PHC) OPD.
The Medical Officer has about 2 minutes and knows nothing about them. History comes from
memory, paper slips or phone photos, even when digital records exist somewhere.

**Root cause (from 5 Whys):** there is no layer that turns consented, sparse records into a
decision-ready view that also shows what is missing.

**Key facts that shape the design:**
- ~2 min average primary-care consultation in India → the summary must be readable in ~10 seconds.
- ~1.1 linked records per ABHA account on average → most patients have little or no digital
  history. Sparse and empty records are the NORMAL case, not an edge case.
- ABDM is federated: records stay with the facility that created them and are shared only
  through the patient's time-bound, revocable consent.
- Records often arrive as scanned PDFs that cannot be parsed.

**Positioning:** context, not diagnosis. ChartGlance never diagnoses, prescribes or suggests
treatment. All clinical decisions stay with the doctor. (Diagnostic features would fall under
CDSCO medical-device regulation; out of scope.)

**Users:**
- Primary user: PHC Medical Officer (MBBS), high-volume rural OPD, often recently posted.
- Secondary user: registration staff who start the consent request.
- Data owner: the patient, who approves or denies consent in their own ABHA app.
- Beachhead: chronic NCD patients (diabetes, hypertension), plus maternal care and TB.

## 2. Prototype scope (capstone, deadline 1 Nov)

### In scope
1. **OPD queue** – today's patients, with ABHA number/address lookup.
2. **Mock ABDM consent flow (HIU role)** – doctor-side request + separate simulated
   "patient phone" screen to approve/deny. Doctor can only request, never grant.
3. **Record fetch** – records from 1–3 mock facilities (HIPs) per patient, as FHIR bundles.
4. **Summary card (10-second view)** – see section 5.
5. **Rule-based red flags and overdue follow-ups** – see section 6.
6. **Priority ordering of the queue** – patients sorted by rule-based flags, with the reason
   always visible (e.g. "2 red flags: severe anaemia in pregnancy"). No AI scoring.
7. **Alert dismissal with a reason** – logged, so the doctor stays in control.
8. **Consultation note** – short free text, saved per visit.
9. **Evaluation** – script comparing summaries against doctor-written must-know facts.

### Out of scope (roadmap only)
Real ABDM sandbox integration, login/HPR authentication, real patient data, Hindi/Marathi
UI, offline mode, diagnosis or treatment suggestions, state HMIS integration, analytics.

## 3. Tech stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts (lab trends only)
- Gemini API, called ONLY from server-side API routes. Key in `GEMINI_API_KEY`
  (`.env.local` locally, Vercel env vars in production). Never expose it to the browser.
- Storage: JSON files in `/data` for records; simple JSON/SQLite store for consents,
  dismissals, notes and cached summaries.
- Hosting: Vercel, auto-deployed from GitHub.
- No other external services. Ask before adding any new dependency.

## 4. Data rules
- **Synthetic data only.** Never real patients, never real ABHA numbers.
- Records follow the **NRCeS ABDM FHIR R4 profiles**: OPConsultRecord, PrescriptionRecord,
  DiagnosticReportRecord, DischargeSummaryRecord, ImmunizationRecord, HealthDocumentRecord.
- Realistic identifier formats: ABHA number `XX-XXXX-XXXX-XXXX` (14 digits),
  ABHA address `name@sbx`. Clearly fake values.
- **All dates are relative to today** (stored as offsets, e.g. `-95 days`), so the demo never
  looks stale.
- Every record has a stable `sourceId`, facility name and date, so summary lines can link to it.

### Personas (5)
| # | Patient | Purpose in demo |
|---|---|---|
| 1 | Diabetic + hypertensive man, 52, HbA1c rising over 9 months, missed follow-up | Main demo: trend, red flag, overdue follow-up |
| 2 | Pregnant woman, 24, 2nd trimester, low haemoglobin, ANC visit due | Maternal red flag, priority ordering |
| 3 | TB patient, 38, on treatment, gap in medicine pick-ups | Treatment-gap flag |
| 4 | Woman, 45, has ABHA but zero linked records | Empty state: "No records found", not a blank card |
| 5 | Man, 60, records from 2 facilities that conflict (different medicines for the same condition) + 1 scanned PDF | Conflict flag, unparseable document handling |

Clinical values must be realistic and doctor-checked (e.g. HbA1c is retested ~every 3 months,
not every 2 weeks).

## 5. Summary card
Readable in ~10 seconds. Order:
1. **Red flags** (from rules) – top, with reason.
2. **Active conditions** with latest value, date and trend (↑ ↓ →).
3. **Current medicines.**
4. **Allergies** (or "No allergy information on record" – never imply "none").
5. **Recent hospitalisations / key events.**
6. **Overdue follow-ups.**
7. **What's missing** – always shown: e.g. "No records in last 12 months",
   "1 scanned document not summarised – view original", "Records conflict: see details".
8. Footer: sources used (facility + date), consent status and expiry.

Every line links to its source record. A line without a source is not shown.

## 6. Rules engine (`/lib/rules`)
- Plain TypeScript functions, no AI. Each rule has: `id`, `name`, `condition`, `threshold`,
  `rationale`, `reference`, `status` (`DRAFT` until clinician-reviewed).
- Thresholds live in one config file, not inside code.
- Every rule has unit tests, including the "no data" case.

Draft rules (pending doctor review):
- R1 HbA1c ≥ 9%, or rise ≥ 0.5 points between tests ≥ 3 months apart
- R2 Latest BP ≥ 180/110
- R3 Haemoglobin < 7 g/dL in pregnancy (severe anaemia)
- R4 TB treatment gap: no medicine pick-up for > 14 days while on treatment
- R5 Follow-up overdue: scheduled review date passed by > 30 days
- R6 Conflicting records: different medicines for the same condition across facilities
  within 90 days

Priority order: patients with more/higher-severity flags first; ties by arrival time.

## 7. AI layer (Gemini)
- Input: only the consented FHIR records for one patient.
- Task: write short summary lines for sections 5.2–5.5. It does NOT decide red flags,
  priority or anything clinical.
- Output: strict JSON, each line with `text` and `sourceIds[]`.
- Validation: drop any line whose `sourceIds` don't exist in the input. Log dropped lines
  (used in evaluation as "unsupported statements").
- Prompt forbids: diagnosis, treatment advice, guessing missing values.
- Cache each patient's summary; regenerate only on button click (protects free quota).
- If the API fails: show the card from rules + raw structured data, with a notice.

## 8. Mock ABDM gateway (`/lib/abdm-mock`)
Mirror the real HIU flow so it can be replaced by the real API later:
- Steps: ABHA lookup → consent request → patient approval → data push → expiry.
- Consent statuses: `REQUESTED`, `GRANTED`, `DENIED`, `EXPIRED`, `REVOKED`.
- Consent request fields: purpose `CAREMGT`, requested HI types, date range, expiry
  (short, e.g. 24 hours).
- Keep all gateway calls behind one interface (`abdmClient`) so swapping is a one-file change.
- Label every mock screen clearly: "Simulated ABDM flow".

9. UI principles
Built for a busy OPD: one screen per patient, big readable text, works on desktop and tablet.
Colours always paired with text labels (never colour alone).
Plain clinical English, no jargon about AI.
Loading and error states for every network call.
No fake dashboard numbers: every count is computed from the data.
Theme (design tokens)

Matches the ChartGlance launch post. Define these once in tailwind.config and use them everywhere. No hard-coded colours. Light mode only for the prototype.

Colours

Token	Hex	Use
navy	
#0B1F4B	Headings, primary text, summary card header, top bar
navy-muted	
#3B4A6B	Secondary text
slate	
#69799E	Hints, timestamps, footer text
brand-red	
#D62839	Key emphasis and critical flags (sparingly)
blue	
#1D4ED8	Buttons, links, section labels, icons
surface	
#FFFFFF	Page background, list rows
panel	
#EEF3FF	Panels, queue background, info areas
border	
#D5E0FA	Card and row borders
border-dashed	
#9AAACF	Dashed border for "missing" rows

Severity rows (always text label + icon, never colour alone)

Level	Background	Border	Text	Used for
Critical	
#FDE8EA	
#F8CED3	
#7A0F1C, label 
#D62839	Red flags
Attention	
#FEF3E2	
#F6D9A8	
#7C2D12, label 
#B45309	Overdue follow-ups, conflicts
Missing	
#FFFFFF	dashed 
#9AAACF	
#3B4A6B	What's missing / not summarised
Normal	
#FFFFFF	
#D5E0FA	
#0B1F4B	Summary, meds, conditions

Do not use green to mean "patient is fine": no flags often just means no data.

Typography

Headings and body: Inter (fallback: system sans-serif). Headings bold/extra-bold, tight letter-spacing. Base 16px; patient names and flags 18–20px.
Row labels and badges: IBM Plex Mono, uppercase, letter-spaced, 12px (e.g. SUMMARY, CURRENT MEDS, RISK, OVERDUE, MISSING).

Components

Summary card: navy header (white title, slate-on-navy subtitle), white rounded rows below, label column in mono on the left, content on the right. Same layout as the post's briefing.
Panels: panel background, border outline, rounded-2xl corners.
Badges: outlined pill in mono caps. Simulated screens show SIMULATED ABDM FLOW; consent shows a small pill with a shield icon, e.g. with consent · expires in 23h.
Primary button: blue fill, white text. Destructive or critical actions: brand-red.
Spacing: generous; one patient per screen; no dense tables on the summary card.

## 10. Build milestones
| Day | Milestone | Done when |
|---|---|---|
| Mon 26 | Skeleton: Next.js app, personas loaded, patient list, deployed to Vercel | Live link shows patient list |
| Mon 26 | Mock consent flow | Approve/deny changes status; records appear only after GRANTED |
| Tue 27 | Rules engine + tests + priority queue | All planted flags fire; tests pass |
| Wed 28 | Gemini summary with source links + validation + cache | No unsourced lines displayed |
| Thu 29 | Summary card UI, dismissal with reason, notes | Full demo flow works. FEATURE FREEZE |
| Fri 30 | Evaluation script + bug fixes | Metrics table produced |

## 11. Evaluation
For each persona, a doctor writes must-know facts. Measure:
- Must-know facts missed by the summary
- Unsupported statements (dropped or wrong lines)
- Planted red flags caught by rules
- Time to comprehension (10-second card view + quick quiz, if doctors are available)

## 12. Working agreement for the agent
- Show a plan before writing code; wait for approval.
- One milestone per task. Small, working steps.
- Explain what changed after each task and how to test it.
- Never edit `.env*` files or commit secrets. Keep `.env.local` in `.gitignore`.
- Ask before adding dependencies, deleting files or running destructive commands.
- Keep code simple and readable; I need to explain it in my viva.
