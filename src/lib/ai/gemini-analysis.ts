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
  }> => {
    // Note: Send key as query parameter (?key=...)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelToUse)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const maskedUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelToUse)}:generateContent?key=***`;
    console.log(`[GEMINI REQUEST] URL: ${maskedUrl}`);

    const timeoutMs = options.timeoutMs ?? 45000;

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
      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof textContent === "string") {
        return { ok: true, status: 200, text: textContent, requestUrlMasked: maskedUrl };
      }
      return { ok: false, status: 200, errorText: "Response contained no text parts", requestUrlMasked: maskedUrl };
    } catch (err: unknown) {
      const isTimeout =
        (err instanceof Error && err.name === "TimeoutError") ||
        String(err).includes("TimeoutError");
      const errName = err instanceof Error ? err.name : "Error";
      const errMsg = err instanceof Error ? err.message : String(err);

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

  // Optional fallback model: if GEMINI_FALLBACK_MODEL is set in .env.local and the main model still fails with 503, try fallback model once
  if (!result.ok && result.status === 503 && fallbackModel && fallbackModel !== mainModel) {
    console.warn(
      `[GEMINI FALLBACK] Primary model ${mainModel} failed with 503 after retries. Trying fallback model ${fallbackModel}...`
    );
    attempts++;
    const fallbackResult = await runSingleAttempt(fallbackModel);
    if (fallbackResult.ok) {
      result = fallbackResult;
      fallbackUsed = true;
      modelUsed = fallbackModel;
    } else {
      result = fallbackResult;
      fallbackUsed = true;
      modelUsed = fallbackModel;
    }
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
    };
  }

  // Determine user-friendly reason to show on card
  let errorReason = "AI unavailable: Gemini analysis failed, try Re-analyse in a minute";
  if (result.status === 429) {
    errorReason = "AI unavailable: Gemini overloaded, try Re-analyse in a minute";
  } else if (result.status === 503) {
    errorReason = fallbackUsed
      ? "AI unavailable: Gemini overloaded (primary & fallback models unavailable), try Re-analyse in a minute"
      : "AI unavailable: Gemini overloaded, try Re-analyse in a minute";
  } else if (result.isTimeout || result.status === 408) {
    errorReason = "AI unavailable: Gemini timed out, try Re-analyse in a minute";
  } else if (result.status === 401 || result.status === 403) {
    errorReason = "AI unavailable: API key rejected or unauthorized";
  } else if (result.status === 404) {
    errorReason = `AI unavailable: Model not found (${modelUsed})`;
  } else if (result.status === 0) {
    errorReason = "AI unavailable: Could not reach Gemini, check connectivity";
  } else if (result.status) {
    errorReason = `AI unavailable: Gemini error (${result.status}), try Re-analyse in a minute`;
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

  // 1. Check Cache
  if (!forceRefresh && fs.existsSync(cachePath)) {
    try {
      const raw = fs.readFileSync(cachePath, "utf-8");
      const cached = JSON.parse(raw) as AIAnalysisResult;
      cached.cached = true;
      cached.consentExpiry = consent.expiryDate;
      return cached;
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
You analyse the patient's full consented medical history alongside Indian national clinical guidelines (NP-NCD, NTEP, Anaemia Mukt Bharat, UIP, CKD).

Definitions:
- redFlag: Needs attention in this visit; risk of serious harm or rapid deterioration if missed.
- yellowFlag: Should be addressed or checked at this visit; non-urgent warning, sub-optimal control, or routine follow-up.

Strict Guardrails:
1. Use ONLY the provided patient records and reference guidelines.
2. NEVER diagnose, prescribe or recommend treatment.
3. NEVER guess missing clinical values.
4. EVERY single statement, redFlag, yellowFlag, trend, and medicine MUST cite valid sourceIds from the provided records.
5. If records are sparse or older than 12 months, state it explicitly.
6. Output MUST be strictly valid JSON matching the required schema. No Markdown wrapper outside JSON.

Worked Examples:

[Example 1 - Pregnancy with severe anaemia]
Input: 24F, ANC checkup, Hb 6.8 g/dL (p02-obs-22), G2P1 second trimester (p02-cond-13), on IFA tablets.
Ideal Output:
{
  "summary": "24-year-old pregnant woman (second trimester, G2P1) presenting for routine antenatal checkup. Records show acute drop in haemoglobin to 6.8 g/dL despite IFA therapy.",
  "summarySourceIds": ["p02-cond-13", "p02-obs-22"],
  "redFlags": [
    {
      "title": "Severe anaemia in pregnancy (Hb < 7 g/dL)",
      "reasoning": "Haemoglobin measured at 6.8 g/dL during second trimester indicates severe maternal anaemia requiring urgent parenteral iron/transfusion workup.",
      "guideline": "Anaemia Mukt Bharat / Maternal ANC Guidelines: Hb < 7.0 g/dL is severe anaemia",
      "sourceIds": ["p02-obs-22", "p02-cond-13"]
    }
  ],
  "yellowFlags": [],
  "trends": [
    { "parameter": "Haemoglobin", "trend": "10.2 -> 8.4 -> 6.8 g/dL (declining)", "sourceIds": ["p02-obs-3", "p02-obs-15", "p02-obs-22"] }
  ],
  "currentMedicines": [
    { "name": "Iron + folic acid (IFA)", "sourceIds": ["p02-med-7"] }
  ],
  "missingInformation": ["No blood group & Rh typing recorded", "No second trimester obstetric anomaly ultrasound on record"],
  "askThePatient": [
    "Are you experiencing any breathlessness, dizziness or palpitations?",
    "Have you been taking your IFA tablets daily without gastric upset?"
  ]
}

[Example 2 - Diabetes and severe hypertension]
Input: 52M, follow-up, HbA1c 9.2% (p01-obs-23), BP 182/112 (p01-obs-24, p01-obs-25), Metformin 500 BD.
Ideal Output:
{
  "summary": "52-year-old male with long-standing Type 2 Diabetes and Hypertension presenting for follow-up. Demonstrates poorly controlled glycaemia and hypertensive crisis readings on current oral regimen.",
  "summarySourceIds": ["p01-cond-2", "p01-obs-23", "p01-obs-24"],
  "redFlags": [
    {
      "title": "Hypertensive crisis (BP ≥ 180/110 mmHg)",
      "reasoning": "Latest blood pressure measured 182/112 mmHg, placing patient at immediate risk of acute cerebral, renal or cardiac events.",
      "guideline": "NP-NCD Hypertension Guidelines: BP ≥ 180/110 mmHg indicates hypertensive crisis",
      "sourceIds": ["p01-obs-24", "p01-obs-25"]
    },
    {
      "title": "Uncontrolled diabetes with HbA1c ≥ 9.0%",
      "reasoning": "HbA1c of 9.2% demonstrates severely decompensated blood glucose regulation on oral Metformin monotherapy.",
      "guideline": "NP-NCD Diabetes Guidelines: HbA1c ≥ 9.0% represents poor control requiring therapy intensification",
      "sourceIds": ["p01-obs-23"]
    }
  ],
  "yellowFlags": [],
  "trends": [
    { "parameter": "HbA1c", "trend": "7.8% -> 8.5% -> 9.2% (rising)", "sourceIds": ["p01-obs-4", "p01-obs-14", "p01-obs-23"] },
    { "parameter": "Systolic BP", "trend": "142 -> 158 -> 182 mmHg", "sourceIds": ["p01-obs-5", "p01-obs-15", "p01-obs-24"] }
  ],
  "currentMedicines": [
    { "name": "Metformin 500mg BD", "sourceIds": ["p01-med-27"] },
    { "name": "Amlodipine 5mg OD", "sourceIds": ["p01-med-28"] }
  ],
  "missingInformation": ["No serum creatinine or renal function test on record for chronic diabetic", "No record of annual diabetic eye/fundus examination"],
  "askThePatient": [
    "Have you been experiencing severe headache, blurred vision, or chest pain today?",
    "Have you missed any daily doses of Metformin or Amlodipine recently?"
  ]
}`;

      // Build simplified records representation for prompt
      const recordsSummary = entries.map((e) => {
        const r = e.resource;
        if (!r) return null;
        return {
          id: r.id,
          type: r.resourceType,
          date: r.date || r.effectiveDateTime || r.authoredOn || r.recordedDate || r.start,
          text: (r.code as { text?: string })?.text ||
            (r.medicationCodeableConcept as { text?: string })?.text ||
            (r.title as string) ||
            r.display ||
            (r.valueQuantity ? `${(r.valueQuantity as { value?: number }).value} ${(r.valueQuantity as { unit?: string }).unit || ""}` : undefined),
          note: (r.clinicalNote as string) || (r.text as { div?: string })?.div,
        };
      }).filter(Boolean);

      const userPrompt = JSON.stringify({
        patientProfile: {
          id: patientId,
          name: patientMeta.name,
          age: patientMeta.age,
          gender: patientMeta.gender,
          complaint: patientMeta.complaint || "Routine consultation",
          visitType: patientMeta.visitType || "Follow-up",
        },
        previousChartGlanceNotes: previousNotes.map((n) => ({
          id: n.id,
          date: n.date,
          doctor: n.doctorName,
          note: n.noteText,
          followUp: n.followUp,
        })),
        consentedHealthRecords: recordsSummary,
        clinicalReference: clinicalRefText,
      });

  const geminiResult = await callGemini({
    userPrompt,
    systemInstruction,
    responseMimeType: "application/json",
    temperature: 0.1,
    timeoutMs: 45000,
  });

  if (!geminiResult.ok) {
    aiFailed = true;
    failureNotice = geminiResult.error;
  } else if (geminiResult.text) {
    try {
      rawAiResponse = JSON.parse(geminiResult.text);
    } catch (jsonErr) {
      aiFailed = true;
      failureNotice = "AI unavailable: Invalid JSON format returned by Gemini";
      console.error("[GEMINI ERROR] Failed to parse JSON response:", jsonErr);
    }
  } else {
    aiFailed = true;
    failureNotice = "AI unavailable: Empty response from Gemini";
  }

  // 5. Validation & Safety Net
  const droppedLines: Array<{ patientId: string; item: unknown; reason: string }> = [];

  const filterValidSourceIds = (ids?: string[]): string[] => {
    if (!Array.isArray(ids)) return [];
    return ids.filter((id) => typeof id === "string" && validIds.has(id));
  };

  // Process AI Summary
  let summary = rawAiResponse?.summary || "Clinical summary based on consented records.";
  let summarySourceIds = filterValidSourceIds(rawAiResponse?.summarySourceIds);
  if (rawAiResponse?.summary && summarySourceIds.length === 0 && validIds.size > 0) {
    droppedLines.push({
      patientId,
      item: { summary: rawAiResponse.summary },
      reason: "Summary cited no valid sourceIds",
    });
  }

  // Process AI Red Flags
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

  // Process AI Yellow Flags
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

  // Process Current Medicines
  const currentMedicines: AIMedicineItem[] = [];
  if (Array.isArray(rawAiResponse?.currentMedicines)) {
    for (const med of rawAiResponse.currentMedicines) {
      const valid = filterValidSourceIds(med.sourceIds);
      if (valid.length > 0 && med.name) {
        currentMedicines.push({
          name: med.name,
          sourceIds: valid,
        });
      } else {
        droppedLines.push({
          patientId,
          item: med,
          reason: "Medicine dropped: missing valid sourceIds or name",
        });
      }
    }
  }

  // Missing Information & Questions
  let missingInformation = Array.isArray(rawAiResponse?.missingInformation)
    ? rawAiResponse.missingInformation.filter((s) => typeof s === "string" && s.trim().length > 0)
    : [];

  let askThePatient = Array.isArray(rawAiResponse?.askThePatient)
    ? rawAiResponse.askThePatient.slice(0, 3).filter((s) => typeof s === "string" && s.trim().length > 0)
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

    // Extract basic medicines from MedicationRequests
    if (currentMedicines.length === 0) {
      for (const e of entries) {
        const r = e.resource;
        if (r && r.resourceType === "MedicationRequest") {
          const medName = ((r.medicationCodeableConcept as { text?: string })?.text) || "Medication";
          currentMedicines.push({ name: medName, sourceIds: [r.id as string] });
        }
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
  };

  // 8. Cache result
  try {
    fs.writeFileSync(cachePath, JSON.stringify(finalResult, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write AI cache:", err);
  }

  return finalResult;
}
