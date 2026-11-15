# ChartGlance 🩺

**Rapid clinical context for high-volume primary care consultations.**

ChartGlance is an AI-augmented clinical assistant designed for Medical Officers in Indian Primary Health Centres (PHCs) and Community Health Centres (CHCs). During a typical 2–3 minute outpatient (OPD) consultation, a doctor often has zero prior knowledge of the patient, relying on faded paper slips, phone photos, or patient recall—even when longitudinal digital records exist.

ChartGlance aggregates consented health records across health facilities via the Ayushman Bharat Digital Mission (ABDM), synthesizes medical history in seconds, highlights critical safety risks and overdue follow-ups, and surfaces missing clinical data—**giving the doctor decision-ready context in a 10-second glance.**

> **Guiding Principle — Context, Not Diagnosis**:  
> ChartGlance never diagnoses, prescribes, or suggests treatments. It presents historical facts, deterministic safety alerts, and missing records so that clinical judgment remains entirely with the treating physician.

---

## ⚠️ Synthetic Data & Simulated ABDM Notice

- **Synthetic Patient Data**: All patient profiles, names, ages, conditions, and FHIR medical records are 100% synthetic, created solely for demonstration, testing, and clinical validation. No real patient health information (PHI) is used.
- **Simulated ABDM Ecosystem**: The Ayushman Bharat Digital Mission (ABDM) workflows—including ABHA verification, consent requests (HIU role), consent approval/denial, and federated Health Information Provider (HIP) record retrieval—are simulated entirely in local application logic. No external government gateways are contacted.

---

## Key Features

### 1. 10-Second Clinical Summary Card
- **Concise History Synthesis**: 2–3 short sentences ($\le 60$ words) summarizing long-term conditions, trends, and history span—**strictly omitting today's chief complaint** (which the doctor already sees).
- **Record-Backed Flags Only**: Red alerts (urgent clinical risks) and yellow alerts (sub-optimal control/warnings) derive strictly from historical records with traceable citations (`sourceIds`). Acute complaints alone never trigger flags.
- **Active Current Medications**: Filters out expired acute courses (e.g. "x 3 days", "x 5 days") and prescriptions older than 6 months without refills. Displays `"No current medicines on record"` when no active drugs exist.
- **Historical Gaps & Missing Information**: Detects long gaps without care ($>12$ months), missing allergy documentation, and absent standard screenings (e.g., annual creatinine/eye exams for diabetics).
- **Targeted Adherence Questions**: Suggests up to 3 non-diagnostic questions focused on medication adherence and record gaps.

### 2. Dual-Layer Safety & National Guideline Engine
- Runs deterministic, rule-based clinical checks derived from Indian national health programs:
  - **NP-NCD**: Hypertensive crisis ($\text{BP} \ge 180/110\text{ mmHg}$) and poor glycaemic control ($\text{HbA1c} \ge 9.0\%$).
  - **Anaemia Mukt Bharat**: Severe anaemia in pregnancy ($\text{Hb} < 7.0\text{ g/dL}$).
  - **NTEP**: Tuberculosis medication pickup interruption ($>14\text{ days}$ overdue).
  - **Pharmacotherapy Safety**: Cross-facility drug duplications (e.g., duplicate sulfonylureas within 90 days).
- Alerts are transparently labeled as `Rule`, `AI`, or `AI + rule`, allowing doctors to dismiss alerts with an audited reason.

### 3. OPD Queue Management & PHC Metrics
- **Daily Queue**: Automatically resets daily queues, generating fresh arrival tokens while preserving historical consultation notes.
- **Consultation Guardrails**: Enforces that only one patient can be "In consultation" at any given time, preventing fragmented documentation.
- **Live KPI Header**: Displays waiting patients, patients in consultation, completed visits, M : F gender ratio, vulnerable populations (Infants · Seniors), and emergency patient tracking.

### 4. Patient-Controlled Consent Architecture
- Simulates the ABDM Health Information User (HIU) role:
  - The doctor requests consent from ChartGlance.
  - The patient reviews and approves or denies the request from their personal simulated mobile phone interface (`/patient-phone`).
  - Doctors cannot bypass or self-approve consent.

### 5. Local Consultation Notes & Addendums
- Per-consultation note taking with automatic background draft saving.
- Immutable finalized notes with support for dated corrections via addendums.
- Local PHC past visits remain accessible without ABDM consent (facility-owned data).

### 6. Resilient & High-Speed AI Pipeline
- **Compact Plain-Text Serialization**: Converts dense FHIR JSON bundles into compact line-based summaries, cutting prompt token overhead by up to 70%.
- **Low-Latency Thinking Config**: Configured with low reasoning depth and targeted guideline snippets for sub-5 second responses.
- **Automated Fallback & In-Flight Timer**: Live seconds counter (`Analysing records… (x s)`) with automatic fallback to secondary models if the primary model times out or encounters capacity limits.
- **Local Response Caching**: Successful analyses are cached locally on disk (`data/runtime/ai-cache`) to ensure instant reloads.

---

## Tech Stack

| Component | Technology |
| :--- | :--- |
| **Framework** | [Next.js 14](https://nextjs.org/) (App Router, Server & Client Components) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS 3](https://tailwindcss.com/) |
| **AI / LLM** | [Google Gemini REST API](https://ai.google.dev/) (`gemini-3.5-flash-lite`, `gemini-3.8-flash`) |
| **Health Data Format** | [HL7 FHIR R4](https://hl7.org/fhir/R4/) JSON Bundles (NRCES ABDM profiles) |
| **Testing** | Node.js Test Runner (`node --test`), TypeScript strip-types loader |

---

## Project Structure

```text
chartglance/
├── data/
│   ├── patients.json              # Mock patient directory with ABHA IDs & demographics
│   ├── records/                   # Synthetic FHIR R4 bundles (P01–P05, B06–B25)
│   ├── reference/
│   │   ├── clinical-reference.md  # National clinical guidelines & alert thresholds
│   │   ├── drug-classes.json      # Drug class mapping for duplicate medication checks
│   │   └── facilities.json        # Directory of mock HIP health facilities
│   ├── runtime/                   # Local runtime storage (notes, AI cache, queue state)
│   └── consents.json              # Local store of simulated ABDM consent artifacts
│
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout and theme providers
│   │   ├── page.tsx               # Primary doctor dashboard & OPD queue
│   │   ├── patient/[id]/page.tsx  # Patient consultation view & Summary Card
│   │   ├── patient-phone/         # Simulated patient mobile phone screen for consent
│   │   ├── register/              # Patient registration & ABHA lookup
│   │   ├── dev/                   # Developer tools & queue reset utilities
│   │   └── api/                   # API routes (ABDM mock, AI check, notes, queue)
│   │
│   ├── components/
│   │   ├── SummaryCard.tsx        # 10-second clinical AI summary card
│   │   ├── OpdDashboard.tsx       # Queue table with priority alerts & filters
│   │   ├── KpiBar.tsx             # OPD statistics header (waiting, M:F, emergencies)
│   │   ├── ConsultationNoteBox.tsx# Note editor with autosave, follow-up, & addendums
│   │   ├── DoctorSidebar.tsx      # Facility details & navigation drawer
│   │   └── PreviousVisitsList.tsx # Past consultation notes at this PHC
│   │
│   └── lib/
│       ├── ai/
│       │   └── gemini-analysis.ts # Gemini REST client, prompt construction, & validation
│       ├── safety-rules/
│       │   └── index.ts           # Deterministic national clinical safety rules engine
│       ├── abdm-mock/             # In-memory ABDM gateway & consent manager
│       ├── records.ts             # FHIR bundle loaders and record sanitization
│       ├── notes-store.ts         # Consultation notes persistence layer
│       └── queue-utils.ts         # Queue sorting, reset, and single-consultation rules
│
├── tests/
│   ├── safety-rules.test.ts       # Unit tests for clinical safety rule engine
│   ├── test-clinical-personas.mjs # Integration test verifying summary rules across P01–P05
│   └── test-daily-reset-and-rules.mjs # Queue daily reset & consultation rule tests
│
├── package.json
└── tsconfig.json
```

---

## Getting Started Locally

### 1. Prerequisites
- **Node.js**: `v20.x` or higher installed
- **npm**: `v10.x` or higher

### 2. Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/chartglance.git
cd chartglance
npm install
```

### 3. Environment Configuration
Create a `.env.local` file in the root directory:

```bash
touch .env.local
```

Add your Gemini API configuration:

```env
# Google Gemini API Key (Get one from https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key_here

# Primary model (recommended: gemini-3.5-flash-lite for fastest response time)
GEMINI_MODEL=gemini-3.5-flash-lite

# Fallback model (used if primary model times out or encounters capacity limits)
GEMINI_FALLBACK_MODEL=gemini-3.8-flash
```

> **Security Note**: Never commit `.env.local` or expose your actual API keys in version control.

### 4. Running the Development Server
Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:
- **Doctor Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Simulated Patient Phone (Consent App)**: [http://localhost:3000/patient-phone](http://localhost:3000/patient-phone)
- **Developer & Diagnostics Panel**: [http://localhost:3000/dev](http://localhost:3000/dev)
- **AI Diagnostics Ping**: [http://localhost:3000/dev/ai-check](http://localhost:3000/dev/ai-check)

### 5. Running Tests
Run the deterministic safety rule test suite:

```bash
npm test
```

Run clinical persona analysis verification:

```bash
node --experimental-strip-types --import ./tests/register-loader.mjs tests/test-clinical-personas.mjs
```

---

## License

This project was built for academic and demonstration purposes. Synthetic medical data and demo configurations are provided for prototype evaluation only.
