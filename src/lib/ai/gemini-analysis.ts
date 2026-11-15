import fs from "fs";
import path from "path";
import { evaluatePatientSafety } from "@/lib/safety-rules";
import { getPatientRecordBundle } from "@/lib/records";
import { notesStore } from "@/lib/notes-store";
import { abdmClient } from "@/lib/abdm-mock";

export interface AIAnalysisFlag {
  title: string;
  reasoning: string;
  guideline?: string;
  sourceIds: string[];
  sourceLabel: "AI + rule" | "AI" | "Rule";
}

export interface AITrendItem {
  parameter: string;
  trend: string;
  sourceIds: string[];
}

export interface AIMedicineItem {
  name: string;
  sourceIds: string[];
}

export interface AIAnalysisResult {
  patientId: string;
  consentId: string;
  generatedAt: string;
  cached: boolean;
  aiFailed?: boolean;
  failureNotice?: string;
  summary: string;
  summarySourceIds: string[];
  redFlags: AIAnalysisFlag[];
  yellowFlags: AIAnalysisFlag[];
  trends: AITrendItem[];
  currentMedicines: AIMedicineItem[];
  missingInformation: string[];
  askThePatient: string[];
  facilitiesUsed: string[];
  dateRange: { from?: string; to?: string };
  consentExpiry?: string;
  modelUsed?: string;
  promptTokens?: number;
}

const RUNTIME_DIR = path.join(process.cwd(), "data", "runtime");
const CACHE_DIR = path.join(RUNTIME_DIR, "ai-cache");
const ANALYSIS_LOG_FILE = path.join(RUNTIME_DIR, "analysis-log.json");
const DROPPED_LINES_FILE = path.join(RUNTIME_DIR, "dropped-lines.json");

function ensureRuntimeDirs() {
  if (!fs.existsSync(RUNTIME_DIR)) fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function appendJsonLog(filePath: string, entry: unknown) {
  try {
    ensureRuntimeDirs();
    let logs: unknown[] = [];
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        logs = JSON.parse(raw);
        if (!Array.isArray(logs)) logs = [];
      } catch {
        logs = [];
      }
    }
    logs.push(entry);
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to append runtime log:", filePath, err);
  }
}

/**
 * Extracts only the clinical guideline sections relevant to the patient's conditions/history.
 * Minimises prompt tokens while providing exact national thresholds.
 */
function getRelevantClinicalReference(recordsText: string, complaint = ""): string {
  const combined = `${recordsText} ${complaint}`.toLowerCase();
  const sections: string[] = [];

  const hasDiabetes =
    combined.includes("diabet") ||
    combined.includes("t2dm") ||
    combined.includes("glucose") ||
    combined.includes("sugar") ||
    combined.includes("hba1c") ||
    combined.includes("metformin") ||
    combined.includes("glimepiride") ||
    combined.includes("gliclazide");

  const hasHTN =
    combined.includes("hyperten") ||
    combined.includes("bp") ||
    combined.includes("blood pressure") ||
    combined.includes("amlodipine") ||
    combined.includes("telmisartan");

  const hasTB =
    combined.includes("tb") ||
    combined.includes("tuberculosis") ||
    combined.includes("cough") ||
    combined.includes("sputum") ||
    combined.includes("hrze") ||
    combined.includes("nikshay");

  const hasAnaemiaOrPreg =
    combined.includes("pregnant") ||
    combined.includes("pregnancy") ||
    combined.includes("anc") ||
    combined.includes("anaemia") ||
    combined.includes("anemia") ||
    combined.includes("haemoglobin") ||
    combined.includes("hb ") ||
    combined.includes("ifa");

  const hasRenalOrElderly =
    combined.includes("creatinine") ||
    combined.includes("egfr") ||
    combined.includes("ckd") ||
    combined.includes("kidney") ||
    combined.includes("renal") ||
    combined.includes("elderly") ||
    combined.includes("giddiness") ||
    combined.includes("gliclazide") ||
    combined.includes("glimepiride");

  if (hasDiabetes) {
    sections.push(
      "NP-NCD Diabetes: Target HbA1c < 7.0%. Sub-optimal (7.0–8.9%) is Yellow Alert. Poor control (HbA1c ≥ 9.0% or rise ≥ 0.5% in ≥ 3mo) or FBG ≥ 200 mg/dL is Red Alert (intensify therapy / review compliance)."
    );
  }
  if (hasHTN) {
    sections.push(
      "NP-NCD Hypertension: Target BP < 140/90 mmHg. Stage 2 HTN (160–179 / 100–109 mmHg) is Yellow Alert. Hypertensive Urgency/Crisis (BP ≥ 180 or ≥ 110 mmHg) is Red Alert (immediate rest, oral anti-hypertensive, screen for organ damage)."
    );
  }
  if (hasTB) {
    sections.push(
      "NTEP Tuberculosis: Monthly FDC pickup schedule. 1–13 days overdue is Yellow Alert. > 14 days overdue without supply is Red Alert (immediate active home-tracing via ASHA/STS). Positive sputum smear at end of Intensive Phase is Red Alert."
    );
  }
  if (hasAnaemiaOrPreg) {
    sections.push(
      "Anaemia Mukt Bharat / Maternal ANC: Pregnant target Hb ≥ 11.0 g/dL. Moderate anaemia (7.0–9.9 g/dL) is Yellow Alert. Severe anaemia (< 7.0 g/dL in pregnancy) is Red Alert requiring urgent parenteric iron / transfusion workup."
    );
  }
  if (hasRenalOrElderly) {
    sections.push(
      "CKD & Pharmacotherapy Safety: Conflicting duplicate sulfonylureas (e.g. Glimepiride + Gliclazide) or Metformin in renal impairment is Red Alert (severe hypoglycaemia / lactic acidosis risk). Annual serum creatinine test indicated for diabetic/elderly patients."
    );
  }

  if (sections.length === 0) {
    sections.push(
      "National Clinical Guidelines: BP ≥ 180/110 mmHg is Red Alert; HbA1c ≥ 9.0% is Red Alert; Severe anaemia Hb < 7.0 g/dL is Red Alert; TB pickup > 14d overdue is Red Alert."
    );
  }

  return sections.join("\n\n");
}

/**
 * Formats a FHIR resource entry into a compact single-line plain text string:
 * "[<id>] YYYY-MM-DD · <Facility> · <Type> · Dx: <Condition> · <Lab>: <Value> · Rx: <Drug> · Note: <Text>"
 */
function formatCompactRecordItem(
  e: { resource?: Record<string, unknown> },
  orgMap: Map<string, string>
): string {
  const r = e.resource;
  if (!r) return "";

  const id = (r.id as string) || "rec";
  const type = (r.resourceType as string) || "Record";
  const date = (r.date || r.effectiveDateTime || r.authoredOn || r.recordedDate || r.start || "") as string;

  // Resolve facility
  let facility = "";
  const authorRef =
    ((r.author as Array<{ reference?: string }>)?.[0]?.reference) ||
    ((r.recorder as { reference?: string })?.reference) ||
    ((r.custodian as { reference?: string })?.reference) ||
    ((r.performer as Array<{ reference?: string }>)?.[0]?.reference);
  if (authorRef) {
    const orgId = authorRef.replace(/^Organization\//, "");
    facility = orgMap.get(orgId) || orgMap.get(authorRef) || "";
  }

  const parts: string[] = [`[${id}]`];
  if (date) parts.push(date);
  if (facility) parts.push(facility);
  parts.push(type);

  if (type === "Condition") {
    const code = (r.code as { text?: string })?.text;
    if (code) parts.push(`Dx: ${code}`);
  }

  if (type === "MedicationRequest") {
    const med = (r.medicationCodeableConcept as { text?: string })?.text;
    const dosage = (r.dosageInstruction as Array<{ text?: string }>)?.[0]?.text;
    if (med) parts.push(`Rx: ${med}${dosage ? ` ${dosage}` : ""}`);
  }

  if (type === "Observation") {
    const labName = (r.code as { text?: string })?.text;
    let val = "";
    if (r.valueQuantity) {
      const q = r.valueQuantity as { value?: number; unit?: string };
      val = `${q.value ?? ""} ${q.unit || ""}`.trim();
    } else if (r.valueString) {
      val = r.valueString as string;
    }
    if (labName || val) parts.push(`${labName || "Obs"}: ${val}`);
  }

  if (type === "DiagnosticReport") {
    const title = (r.code as { text?: string })?.text || (r.title as string);
    const conclusion = r.conclusion as string;
    if (title) parts.push(`Report: ${title}`);
    if (conclusion) parts.push(`Conclusion: ${conclusion}`);
  }

  let rawNote =
    (r.clinicalNote as string) ||
    ((r.text as { div?: string })?.div) ||
    ((r.note as Array<{ text?: string }>)?.[0]?.text);
  if (rawNote) {
    const cleanedNote = rawNote
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanedNote) {
      parts.push(`Note: ${cleanedNote.slice(0, 160)}`);
    }
  }

  return parts.join(" · ");
}

/**
 * Loads clinical reference guide markdown text.
 */
function getClinicalReferenceText(): string {
  try {
    const filePath = path.join(process.cwd(), "data", "reference", "clinical-reference.md");
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  } catch {
    // Ignore
  }
  return "Clinical Reference: NP-NCD (BP >= 180/110, HbA1c >= 9%), NTEP (TB pickup > 14d overdue), AMB (Hb < 7 in pregnancy).";
}

/**
 * Extracts all valid resource and note IDs from input records.
 */
function collectAllValidIds(
  bundle: Record<string, unknown> | null,
  previousNotes: Array<{ id: string }>
): Set<string> {
  const ids = new Set<string>();
  if (bundle && Array.isArray(bundle.entry)) {
    for (const item of bundle.entry) {
      const res = (item as { resource?: { id?: string } })?.resource;
      if (res?.id) ids.add(res.id);
    }
  }
  for (const n of previousNotes) {
    if (n.id) ids.add(n.id);
  }
  return ids;
}

export interface GeminiCallOptions {
  userPrompt: string;
  systemInstruction?: string;
  responseMimeType?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  modelOverride?: string;
}

export interface GeminiRawError {
  name: string;
  message: string;
  cause?: {
    code?: string | number;
    message?: string;
  };
}

export interface GeminiCallResult {
  ok: boolean;
  status: number;
  text?: string;
  error?: string;
  rawError?: GeminiRawError;
  requestUrlMasked?: string;
  modelUsed: string;
  fallbackUsed: boolean;
  attempts: number;
  promptTokens?: number;
}

/**
 * Executes a call to the Gemini REST API using query parameter auth (?key=...).
 * Retries on 429 and 503 up to 3 times (waiting 2s, 4s, 8s).
 * Tries GEMINI_FALLBACK_MODEL once if main model still fails with 503 and fallback is configured.
 * Never logs the full URL with API key.
 */
export async function callGemini(options: GeminiCallOptions): Promise<GeminiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      status: 401,
      error: "AI unavailable: GEMINI_API_KEY is not configured in .env.local",
      modelUsed: "",
      fallbackUsed: false,
      attempts: 0,
    };
  }

  const sanitizeLog = (text: string) => {
    if (!text) return "";
    return text.split(apiKey).join("[REDACTED_API_KEY]");
  };

  const mainModel = options.modelOverride || process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim();

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: options.userPrompt }],
      },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.1,
      maxOutputTokens: options.maxOutputTokens ?? 1500,
      thinkingConfig: { thinkingLevel: "low" },
      ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
    },
  };

  if (options.systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  const runSingleAttempt = async (modelToUse: string): Promise<{
    ok: boolean;
    status: number;
    text?: string;
    errorText?: string;
    rawError?: GeminiRawError;
    requestUrlMasked: string;
    isTimeout?: boolean;
    promptTokens?: number;
  }> => {
    // Note: Send key as query parameter (?key=...)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelToUse)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const maskedUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelToUse)}:generateContent?key=***`;
    console.log(`[GEMINI REQUEST] URL: ${maskedUrl}`);

    const timeoutMs = options.timeoutMs ?? 30000;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        // Log endpoint WITHOUT key
        console.error(`[GEMINI ERROR] Model: ${modelToUse} | HTTP Status: ${res.status} ${res.statusText || ""}`);
        if (errBody) {
          console.error(`[GEMINI ERROR] Response Body: ${sanitizeLog(errBody)}`);
        }
        return { ok: false, status: res.status, errorText: errBody, requestUrlMasked: maskedUrl };
      }

      const data = await res.json();
      const promptTokens = data.usageMetadata?.promptTokenCount as number | undefined;
      const parts = data.candidates?.[0]?.content?.parts as Array<{ text?: string; thought?: boolean }> | undefined;
      const textParts = parts?.filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text);
      const textContent = textParts && textParts.length > 0 ? textParts.join("") : parts?.[0]?.text;
      if (typeof textContent === "string") {
        return { ok: true, status: 200, text: textContent, promptTokens, requestUrlMasked: maskedUrl };
      }
      return { ok: false, status: 200, errorText: "Response contained no text parts", requestUrlMasked: maskedUrl };
    } catch (err: unknown) {
      const errName = err instanceof Error ? err.name : "Error";
      const errMsg = err instanceof Error ? err.message : String(err);
      const causeCode = (err as { cause?: { code?: string | number } })?.cause?.code;
      const isTimeout =
        errName === "TimeoutError" ||
        errName === "AbortError" ||
        errMsg.toLowerCase().includes("timeout") ||
        errMsg.toLowerCase().includes("aborted") ||
        String(causeCode || "").toUpperCase().includes("TIMEOUT");

      let causeInfo: { code?: string | number; message?: string } | undefined = undefined;
      if (err instanceof Error && (err as { cause?: unknown }).cause) {
        const c = (err as { cause?: unknown }).cause;
        if (typeof c === "object" && c !== null) {
          causeInfo = {
            code: (c as { code?: string | number }).code,
            message: sanitizeLog((c as { message?: string }).message || String(c)),
          };
        } else {
          causeInfo = {
            message: sanitizeLog(String(c)),
          };
        }
      }

      const rawErr: GeminiRawError = {
        name: errName,
        message: sanitizeLog(errMsg),
        cause: causeInfo,
      };

      console.error(
        `[GEMINI ERROR] Model: ${modelToUse} | Exception: ${sanitizeLog(errMsg)} | Cause: ${JSON.stringify(causeInfo || {})}`
      );
      return {
        ok: false,
        status: isTimeout ? 408 : 0,
        errorText: errMsg,
        rawError: rawErr,
        requestUrlMasked: maskedUrl,
        isTimeout,
      };
    }
  };

  const retryDelays = [2000, 4000, 8000];
  let attempts = 0;

  // Initial attempt on main model
  attempts++;
  let result = await runSingleAttempt(mainModel);

  // Retries automatically on 503 and 429 errors: up to 3 attempts, waiting 2, 4 and 8 seconds
  while (!result.ok && (result.status === 429 || result.status === 503) && attempts <= retryDelays.length) {
    const delay = retryDelays[attempts - 1];
    console.warn(
      `[GEMINI RETRY] HTTP ${result.status} from ${mainModel}. Waiting ${delay / 1000}s before retry (attempt ${attempts + 1})...`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    attempts++;
    result = await runSingleAttempt(mainModel);
  }

  let fallbackUsed = false;
  let modelUsed = mainModel;

  // Fallback model: if GEMINI_FALLBACK_MODEL is set and main model fails with 503 or times out (30s), try fallback model once with a 30s limit
  if (!result.ok && (result.status === 503 || result.isTimeout || result.status === 408) && fallbackModel && fallbackModel !== mainModel) {
    const triggerReason = result.isTimeout || result.status === 408 ? "timed out (30s)" : `failed with HTTP ${result.status}`;
    console.warn(
      `[GEMINI FALLBACK] Primary model ${mainModel} ${triggerReason}. Trying fallback model ${fallbackModel} once with 30s limit...`
    );
    attempts++;
    const fallbackResult = await runSingleAttempt(fallbackModel);
    result = fallbackResult;
    fallbackUsed = true;
    modelUsed = fallbackModel;
  }

  if (result.ok && typeof result.text === "string") {
    return {
      ok: true,
      status: 200,
      text: result.text,
      requestUrlMasked: result.requestUrlMasked,
      modelUsed,
      fallbackUsed,
      attempts,
      promptTokens: result.promptTokens,
    };
  }

  // Determine user-friendly reason to show on card, including specific reason and model tried
  let errorReason = `AI unavailable: Gemini analysis failed [Model tried: ${modelUsed}], try Re-analyse in a minute`;
  if (result.status === 429) {
    errorReason = `AI unavailable: Gemini overloaded [Model tried: ${modelUsed}], try Re-analyse in a minute`;
  } else if (result.status === 503) {
    errorReason = fallbackUsed
      ? `AI unavailable: Gemini overloaded (primary & fallback models unavailable) [Model tried: ${modelUsed}], try Re-analyse in a minute`
      : `AI unavailable: Gemini overloaded [Model tried: ${modelUsed}], try Re-analyse in a minute`;
  } else if (result.isTimeout || result.status === 408) {
    errorReason = `AI unavailable: Gemini timed out (30s) [Model tried: ${modelUsed}], try Re-analyse in a minute`;
  } else if (result.status === 401 || result.status === 403) {
    errorReason = `AI unavailable: API key rejected or unauthorized [Model tried: ${modelUsed}]`;
  } else if (result.status === 404) {
    errorReason = `AI unavailable: Model not found [Model tried: ${modelUsed}]`;
  } else if (result.status === 0) {
    errorReason = `AI unavailable: Could not reach Gemini (network error) [Model tried: ${modelUsed}], check connectivity`;
  } else if (result.status) {
    errorReason = `AI unavailable: Gemini error (${result.status}) [Model tried: ${modelUsed}], try Re-analyse in a minute`;
  }

  return {
    ok: false,
    status: result.status,
    error: errorReason,
    rawError: result.rawError,
    requestUrlMasked: result.requestUrlMasked,
    modelUsed,
    fallbackUsed,
    attempts,
  };
}

/**
 * Generates or retrieves cached AI analysis for a consented patient.
 */
export async function getOrGenerateAnalysis(
  patientId: string,
  patientMeta: { name: string; age: string | number; gender: string; complaint?: string; visitType?: string },
  forceRefresh = false
): Promise<AIAnalysisResult> {
  ensureRuntimeDirs();

  const consent = abdmClient.getConsent(patientId);
  if (!consent || consent.status !== "GRANTED") {
    throw new Error("Consent not granted. Health records remain locked.");
  }

  const consentId = consent.id || `consent-${patientId}`;
  const cachePath = path.join(CACHE_DIR, `${patientId}-${consentId}.json`);

  // 1. Check Cache: never serve failed analyses from cache, and forceRefresh clears stale cache
  if (forceRefresh && fs.existsSync(cachePath)) {
    try {
      fs.unlinkSync(cachePath);
    } catch {
      // Ignore
    }
  }

  if (!forceRefresh && fs.existsSync(cachePath)) {
    try {
      const raw = fs.readFileSync(cachePath, "utf-8");
      const cached = JSON.parse(raw) as AIAnalysisResult;
      // Only return successful analyses from cache
      if (!cached.aiFailed) {
        cached.cached = true;
        cached.consentExpiry = consent.expiryDate;
        return cached;
      } else {
        // Discard stale failure cache file
        try {
          fs.unlinkSync(cachePath);
        } catch {
          // Ignore
        }
      }
    } catch {
      // Re-run on cache read error
    }
  }

  const startTime = Date.now();

  // 2. Load Patient Data & Consent Records
  const bundle = getPatientRecordBundle(patientId);
  const previousNotes = notesStore.getNotes(patientId);
  const clinicalRefText = getClinicalReferenceText();

  // Identify valid source IDs
  const validIds = collectAllValidIds(bundle, previousNotes);

  // If no records at all
  const entries = (bundle?.entry as Array<{ resource?: Record<string, unknown> }>) || [];
  if (entries.length === 0 && previousNotes.length === 0) {
    const emptyResult: AIAnalysisResult = {
      patientId,
      consentId,
      generatedAt: new Date().toISOString(),
      cached: false,
      summary: "Patient has verified ABHA consent, but no prior clinical records were found in the health information network.",
      summarySourceIds: [],
      redFlags: [],
      yellowFlags: [],
      trends: [],
      currentMedicines: [],
      missingInformation: ["No prior clinical records found across linked health facilities."],
      askThePatient: ["Have you been treated at any other clinic or hospital recently?", "Do you take any daily medications?"],
      facilitiesUsed: [],
      dateRange: {},
      consentExpiry: consent.expiryDate,
    };
    fs.writeFileSync(cachePath, JSON.stringify(emptyResult, null, 2), "utf-8");
    return emptyResult;
  }

  // Gather facility names and dates for footer metadata
  const facilitiesSet = new Set<string>();
  const datesList: string[] = [];
  for (const e of entries) {
    const res = e.resource;
    if (!res) continue;
    if (res.resourceType === "Composition") {
      const d = (res.date as string);
      if (d) datesList.push(d);
    }
    if (res.resourceType === "Organization") {
      const name = (res.name as string);
      if (name) facilitiesSet.add(name);
    }
  }
  datesList.sort();

  // 3. Fallback Safety Net Rules (Deterministic)
  const safetyAlerts = bundle ? evaluatePatientSafety(bundle) : [];

  // 4. Call Gemini AI with strict guardrails, prompt schema, and worked examples
  let rawAiResponse: {
    summary?: string;
    summarySourceIds?: string[];
    redFlags?: Array<{ title?: string; reasoning?: string; guideline?: string; sourceIds?: string[] }>;
    yellowFlags?: Array<{ title?: string; reasoning?: string; guideline?: string; sourceIds?: string[] }>;
    trends?: Array<{ parameter?: string; trend?: string; sourceIds?: string[] }>;
    currentMedicines?: Array<{ name?: string; sourceIds?: string[] }>;
    missingInformation?: string[];
    askThePatient?: string[];
  } | null = null;

  let aiFailed = false;
  let failureNotice: string | undefined;

  const systemInstruction = `You are an experienced Primary Health Centre (PHC) medical officer's clinical assistant in rural India.
You analyse the patient's consented medical history alongside Indian national clinical guidelines (NP-NCD, NTEP, Anaemia Mukt Bharat, CKD).

Definitions:
- redFlag: Needs attention in this visit; risk of serious harm or rapid deterioration if missed.
- yellowFlag: Should be addressed or checked at this visit; non-urgent warning or sub-optimal control.

Strict Guardrails & Section Rules:
1. SUMMARY: Exactly 2–3 short sentences, maximum 60 words, synthesizing the patient's history from the records: key conditions, important trends, recent events, and span of history on record. NEVER repeat or mention today's chief complaint (the doctor can already see it).
2. RED & YELLOW FLAGS: Must come strictly from the past records (prior lab values, historical trends, gaps in treatment, missed follow-ups, clinical notes). NEVER create a flag from today's complaint alone. If nothing in the records qualifies, return empty arrays ("redFlags": [], "yellowFlags": []).
3. CURRENT MEDICINES: Include ONLY active chronic maintenance medicines likely still being taken. STRICTLY EXCLUDE: short courses (e.g. "x 3 days", "x 5 days", acute antibiotics/analgesics) once their duration has passed, and medicines older than 6 months with no repeat prescription. If none qualify, return [].
4. MISSING INFORMATION: Gaps in the recorded medical history, NOT today's examination. Examples: no records in the last 12 months, no allergy documentation, or expected tests absent for the patient's conditions or age (e.g. no kidney function test for a diabetic, no BP or blood sugar screening on record for adults over 30).
5. ASK THE PATIENT: Up to 3 questions to fill gaps in the history or verify adherence/compliance. NEVER ask questions aimed at diagnosing today's complaint.
6. CITE SOURCE IDS: Every statement, flag, trend, and medicine MUST cite valid sourceIds from the provided records.
7. Output MUST be strictly valid JSON matching the schema. No Markdown wrapper outside JSON.

Worked Example:
Input: 52M, follow-up, HbA1c 9.2% (p01-obs-23), BP 182/112 (p01-obs-24), Metformin 500 BD (p01-med-27, chronic maintenance).
Ideal Output:
{
  "summary": "52-year-old male with long-standing Type 2 Diabetes and Hypertension documented across 2 years of primary health records. Serial readings demonstrate worsening glycaemic control culminating in HbA1c 9.2% and a hypertensive crisis reading of 182/112 mmHg on oral monotherapy.",
  "summarySourceIds": ["p01-cond-2", "p01-obs-23", "p01-obs-24"],
  "redFlags": [
    {
      "title": "Hypertensive crisis (BP ≥ 180/110 mmHg)",
      "reasoning": "Historical blood pressure measured 182/112 mmHg in prior records, placing patient at immediate risk of acute cerebral, renal or cardiac events.",
      "guideline": "NP-NCD Hypertension Guidelines: BP ≥ 180/110 mmHg indicates hypertensive crisis",
      "sourceIds": ["p01-obs-24"]
    },
    {
      "title": "Uncontrolled diabetes (HbA1c ≥ 9.0%)",
      "reasoning": "Prior HbA1c of 9.2% demonstrates severely decompensated blood glucose regulation on oral Metformin monotherapy.",
      "guideline": "NP-NCD Diabetes Guidelines: HbA1c ≥ 9.0% represents poor control requiring therapy intensification",
      "sourceIds": ["p01-obs-23"]
    }
  ],
  "yellowFlags": [],
  "trends": [
    { "parameter": "HbA1c", "trend": "7.8% -> 8.5% -> 9.2% (rising)", "sourceIds": ["p01-obs-4", "p01-obs-14", "p01-obs-23"] }
  ],
  "currentMedicines": [
    { "name": "Metformin 500mg BD", "sourceIds": ["p01-med-27"] }
  ],
  "missingInformation": [
    "No serum creatinine or renal function test on record for chronic diabetic",
    "No documented annual diabetic eye or fundus examination"
  ],
  "askThePatient": [
    "Have you been taking your daily Metformin regularly without missing doses?",
    "Do you take any other daily medicines or home remedies not listed in these records?"
  ]
}`;

  // Build organization map for facility names
  const orgMap = new Map<string, string>();
  for (const e of entries) {
    const r = e.resource;
    if (r && r.resourceType === "Organization" && r.id) {
      orgMap.set(r.id as string, (r.name as string) || (r.id as string));
    }
  }

  // Convert entries to compact one-line plain text strings
  const compactRecords = entries
    .filter(
      (e) =>
        e.resource &&
        e.resource.resourceType !== "Organization" &&
        e.resource.resourceType !== "Patient"
    )
    .map((e) => formatCompactRecordItem(e, orgMap))
    .filter(Boolean);

  // Filter clinical reference down to only relevant sections
  const relevantGuidelines = getRelevantClinicalReference(
    compactRecords.join(" "),
    patientMeta.complaint
  );

  const notesText = previousNotes
    .map(
      (n) =>
        `[${n.id}] ${n.date} · ${n.doctorName}: ${n.noteText}${
          n.followUp ? ` (Follow-up: ${n.followUp})` : ""
        }`
    )
    .join("\n");

  const userPrompt = `Patient: ${patientMeta.name}, ${patientMeta.age} ${patientMeta.gender} · Visit: ${
    patientMeta.visitType || "Follow-up"
  } · Complaint: ${patientMeta.complaint || "Routine consultation"}

Consented Medical Records (one per line):
${compactRecords.map((line) => `- ${line}`).join("\n")}
${notesText ? `\nPrevious Consultation Notes:\n${notesText}` : ""}

Relevant Clinical Reference Guidelines:
${relevantGuidelines}

Content Rules to follow strictly:
- SUMMARY: 2–3 short sentences, maximum 60 words. Summarize history from records only. DO NOT repeat or echo today's chief complaint.
- RED & YELLOW FLAGS: Must derive strictly from past records/labs/trends. NEVER create a flag from today's complaint alone. If nothing qualifies, return [].
- CURRENT MEDICINES: Include only active chronic maintenance drugs likely still being taken. Exclude short courses whose duration has passed (e.g. x 3d, x 5d) and meds older than 6 months without repeat. If none qualify, return [].
- MISSING INFORMATION: Identify gaps in historical records (e.g. no records in 12m, no allergy data, missing annual diabetic renal/eye tests), NOT today's physical examination.
- ASK THE PATIENT: Up to 3 questions to fill history gaps or check adherence. NO questions diagnosing today's complaint.

Respond strictly with valid JSON schema (keys: summary, summarySourceIds, redFlags, yellowFlags, trends, currentMedicines, missingInformation, askThePatient). Cite valid sourceIds for every item.`;

  const geminiResult = await callGemini({
    userPrompt,
    systemInstruction,
    responseMimeType: "application/json",
    temperature: 0.1,
    maxOutputTokens: 1500,
    timeoutMs: 30000,
  });

  if (!geminiResult.ok) {
    aiFailed = true;
    failureNotice = geminiResult.error;
  } else if (geminiResult.text) {
    try {
      const cleaned = geminiResult.text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
      rawAiResponse = JSON.parse(cleaned);
    } catch (jsonErr) {
      aiFailed = true;
      failureNotice = `AI unavailable: Invalid JSON format returned [Model tried: ${geminiResult.modelUsed}], try Re-analyse in a minute`;
      console.error("[GEMINI ERROR] Failed to parse JSON response:", jsonErr);
    }
  } else {
    aiFailed = true;
    failureNotice = `AI unavailable: Empty response from Gemini [Model tried: ${geminiResult.modelUsed}], try Re-analyse in a minute`;
  }

  // 5. Validation & Safety Net
  const droppedLines: Array<{ patientId: string; item: unknown; reason: string }> = [];

  const filterValidSourceIds = (ids?: string[]): string[] => {
    if (!Array.isArray(ids)) return [];
    return ids.filter((id) => typeof id === "string" && validIds.has(id));
  };

  // Build map of medication records for recency and course duration validation
  const medRecordsMap = new Map<string, { date?: string; dosageText?: string; name: string }>();
  for (const e of entries) {
    const r = e.resource;
    if (r && r.resourceType === "MedicationRequest") {
      const id = (r.id as string) || "";
      const date = (r.authoredOn || r.date || r.effectiveDateTime || "") as string;
      const dosageText = ((r.dosageInstruction as Array<{ text?: string }>)?.[0]?.text) || "";
      const name = ((r.medicationCodeableConcept as { text?: string })?.text) || "";
      if (id) {
        medRecordsMap.set(id, { date, dosageText, name: name.toLowerCase() });
      }
    }
  }

  const isMedicationActive = (med: { name?: string; sourceIds?: string[] }): boolean => {
    if (!med.name || med.name === "No current medicines on record") return false;
    const now = Date.now();
    const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;

    for (const sid of med.sourceIds || []) {
      const record = medRecordsMap.get(sid);
      if (!record || !record.date) continue;

      const recDate = new Date(record.date).getTime();
      const ageMs = now - recDate;

      // Exclude if older than 6 months (180 days)
      if (ageMs > sixMonthsMs) {
        return false;
      }

      // Exclude acute short courses once duration has passed (e.g. "x 3 days", "x 5 days", "for 7 days")
      const dosage = (record.dosageText || "").toLowerCase();
      const matchDays = dosage.match(/(?:x|for)\s*(\d+)\s*(?:d|day|days)/i);
      if (matchDays) {
        const days = parseInt(matchDays[1], 10);
        const durationMs = days * 24 * 60 * 60 * 1000;
        if (ageMs > durationMs) {
          return false;
        }
      }
    }
    return true;
  };

  // 1. Process & Validate AI Summary: 2-3 short sentences, max 60 words, no complaint repeating
  let summary = rawAiResponse?.summary || "Clinical summary based on consented records.";
  
  // Remove echoes of today's complaint
  if (patientMeta.complaint) {
    const compText = patientMeta.complaint.trim().toLowerCase();
    const complaintRegex = new RegExp(
      `(?:presents?|presenting|admitted|visited)\\s+(?:with|for|complaining of|due to)?\\s*${compText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[.,;]?`,
      "gi"
    );
    summary = summary.replace(complaintRegex, "").replace(/\s{2,}/g, " ").trim();
  }

  // Enforce maximum 60 words
  const summaryWords = summary.split(/\s+/).filter(Boolean);
  if (summaryWords.length > 60) {
    const truncated = summaryWords.slice(0, 60).join(" ");
    const lastPunct = Math.max(truncated.lastIndexOf("."), truncated.lastIndexOf("!"));
    if (lastPunct > 25) {
      summary = truncated.slice(0, lastPunct + 1);
    } else {
      summary = truncated + "...";
    }
  }

  let summarySourceIds = filterValidSourceIds(rawAiResponse?.summarySourceIds);
  if (rawAiResponse?.summary && summarySourceIds.length === 0 && validIds.size > 0) {
    droppedLines.push({
      patientId,
      item: { summary: rawAiResponse.summary },
      reason: "Summary cited no valid sourceIds",
    });
  }

  // 2. Process AI Red Flags: must cite records, never complaint alone
  const aiRedFlags: AIAnalysisFlag[] = [];
  if (Array.isArray(rawAiResponse?.redFlags)) {
    for (const flag of rawAiResponse.redFlags) {
      const valid = filterValidSourceIds(flag.sourceIds);
      if (valid.length > 0 && flag.title) {
        aiRedFlags.push({
          title: flag.title.trim(),
          reasoning: flag.reasoning || "",
          guideline: flag.guideline,
          sourceIds: valid,
          sourceLabel: "AI",
        });
      } else {
        droppedLines.push({
          patientId,
          item: flag,
          reason: "Red flag dropped: missing valid sourceIds or title",
        });
      }
    }
  }

  // 3. Process AI Yellow Flags: must cite records, never complaint alone
  const yellowFlags: AIAnalysisFlag[] = [];
  if (Array.isArray(rawAiResponse?.yellowFlags)) {
    for (const flag of rawAiResponse.yellowFlags) {
      const valid = filterValidSourceIds(flag.sourceIds);
      if (valid.length > 0 && flag.title) {
        yellowFlags.push({
          title: flag.title.trim(),
          reasoning: flag.reasoning || "",
          guideline: flag.guideline,
          sourceIds: valid,
          sourceLabel: "AI",
        });
      } else {
        droppedLines.push({
          patientId,
          item: flag,
          reason: "Yellow flag dropped: missing valid sourceIds or title",
        });
      }
    }
  }

  // Process Trends
  const trends: AITrendItem[] = [];
  if (Array.isArray(rawAiResponse?.trends)) {
    for (const t of rawAiResponse.trends) {
      const valid = filterValidSourceIds(t.sourceIds);
      if (valid.length > 0 && t.parameter && t.trend) {
        trends.push({
          parameter: t.parameter,
          trend: t.trend,
          sourceIds: valid,
        });
      } else {
        droppedLines.push({
          patientId,
          item: t,
          reason: "Trend dropped: missing valid sourceIds or parameter",
        });
      }
    }
  }

  // 4. Process Current Medicines: exclude short courses past duration & meds > 6 months
  const currentMedicines: AIMedicineItem[] = [];
  if (Array.isArray(rawAiResponse?.currentMedicines)) {
    for (const med of rawAiResponse.currentMedicines) {
      const valid = filterValidSourceIds(med.sourceIds);
      if (valid.length > 0 && med.name && isMedicationActive({ name: med.name, sourceIds: valid })) {
        currentMedicines.push({
          name: med.name,
          sourceIds: valid,
        });
      } else {
        droppedLines.push({
          patientId,
          item: med,
          reason: "Medicine dropped: expired short course, >6 months old, or missing valid sourceIds",
        });
      }
    }
  }

  // If no active medicines qualify, provide "No current medicines on record"
  if (currentMedicines.length === 0) {
    currentMedicines.push({
      name: "No current medicines on record",
      sourceIds: [],
    });
  }

  // 5. Missing Information: filter out directives for today's physical exam
  let missingInformation = Array.isArray(rawAiResponse?.missingInformation)
    ? rawAiResponse.missingInformation
        .filter((s) => typeof s === "string" && s.trim().length > 0)
        .filter((s) => !/^(?:examine|auscultate|check|measure|conduct physical|assess patient today)/i.test(s.trim()))
    : [];

  // 6. Ask the Patient: up to 3 questions for history gaps / adherence, no diagnostic symptom probing
  let askThePatient = Array.isArray(rawAiResponse?.askThePatient)
    ? rawAiResponse.askThePatient
        .filter((s) => typeof s === "string" && s.trim().length > 0)
        .slice(0, 3)
    : [];

  // Log dropped lines
  for (const dropped of droppedLines) {
    appendJsonLog(DROPPED_LINES_FILE, {
      ...dropped,
      timestamp: new Date().toISOString(),
    });
  }

  // 6. Merge Safety Rules with AI Red Flags & Label
  // "AI + rule", "AI", or "Rule"
  const finalRedFlags: AIAnalysisFlag[] = [];
  const matchedRuleIds = new Set<string>();

  for (const aiFlag of aiRedFlags) {
    // Check if any safety rule matches the sourceIds of this AI flag
    const matchingRule = safetyAlerts.find((ruleAlert) =>
      ruleAlert.sourceIds.some((id) => aiFlag.sourceIds.includes(id))
    );

    if (matchingRule) {
      matchedRuleIds.add(matchingRule.ruleId);
      finalRedFlags.push({
        ...aiFlag,
        sourceLabel: "AI + rule",
        guideline: aiFlag.guideline || matchingRule.programme,
      });
    } else {
      finalRedFlags.push(aiFlag);
    }
  }

  // Add unmatched safety rules as "Rule" flags
  for (const ruleAlert of safetyAlerts) {
    if (!matchedRuleIds.has(ruleAlert.ruleId)) {
      finalRedFlags.unshift({
        title: ruleAlert.ruleName,
        reasoning: ruleAlert.message,
        guideline: ruleAlert.programme,
        sourceIds: ruleAlert.sourceIds,
        sourceLabel: "Rule",
      });
    }
  }

  // If AI completely failed, provide deterministic baseline summary and extract meds/trends from bundle
  if (aiFailed) {
    summary = `Clinical summary based on ${entries.length} consented records at ${facilitiesSet.size || 1} health facilities.`;
    summarySourceIds = Array.from(validIds).slice(0, 3);

    // Extract active medicines from MedicationRequests respecting recency
    if (currentMedicines.length === 0 || (currentMedicines.length === 1 && currentMedicines[0].name === "No current medicines on record")) {
      const activeFallback: AIMedicineItem[] = [];
      for (const e of entries) {
        const r = e.resource;
        if (r && r.resourceType === "MedicationRequest") {
          const medName = ((r.medicationCodeableConcept as { text?: string })?.text) || "Medication";
          if (isMedicationActive({ name: medName, sourceIds: [r.id as string] })) {
            activeFallback.push({ name: medName, sourceIds: [r.id as string] });
          }
        }
      }
      currentMedicines.length = 0;
      if (activeFallback.length > 0) {
        currentMedicines.push(...activeFallback);
      } else {
        currentMedicines.push({ name: "No current medicines on record", sourceIds: [] });
      }
    }

    if (missingInformation.length === 0) {
      missingInformation = ["AI synthesis unavailable: review complete records in left panel."];
    }
    if (askThePatient.length === 0) {
      askThePatient = ["How are your current symptoms today?", "Have you taken all prescribed medications regularly?"];
    }
  }

  const timeTakenMs = Date.now() - startTime;

  // 7. Log Analysis
  appendJsonLog(ANALYSIS_LOG_FILE, {
    patientId,
    consentId,
    timestamp: new Date().toISOString(),
    timeTakenMs,
    aiFailed,
    redFlagsCount: finalRedFlags.length,
    yellowFlagsCount: yellowFlags.length,
    labels: {
      "AI + rule": finalRedFlags.filter((f) => f.sourceLabel === "AI + rule").length,
      "AI": finalRedFlags.filter((f) => f.sourceLabel === "AI").length + yellowFlags.length,
      "Rule": finalRedFlags.filter((f) => f.sourceLabel === "Rule").length,
    },
    droppedCount: droppedLines.length,
  });

  const finalResult: AIAnalysisResult = {
    patientId,
    consentId,
    generatedAt: new Date().toISOString(),
    cached: false,
    aiFailed,
    failureNotice,
    summary,
    summarySourceIds,
    redFlags: finalRedFlags,
    yellowFlags,
    trends,
    currentMedicines,
    missingInformation,
    askThePatient,
    facilitiesUsed: Array.from(facilitiesSet),
    dateRange: {
      from: datesList[0],
      to: datesList[datesList.length - 1],
    },
    consentExpiry: consent.expiryDate,
    modelUsed: geminiResult.modelUsed,
    promptTokens: geminiResult.promptTokens,
  };

  // 8. Cache result: only cache successful AI analyses; never cache failures
  if (!aiFailed) {
    try {
      fs.writeFileSync(cachePath, JSON.stringify(finalResult, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to write AI cache:", err);
    }
  } else {
    // If a cache file exists from previous run, remove it
    if (fs.existsSync(cachePath)) {
      try {
        fs.unlinkSync(cachePath);
      } catch {
        // Ignore
      }
    }
  }

  return finalResult;
}
