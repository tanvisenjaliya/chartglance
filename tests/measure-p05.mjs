import { getPatientRecordBundle } from "../src/lib/records.ts";
import { notesStore } from "../src/lib/notes-store.ts";
import { abdmClient } from "../src/lib/abdm-mock/index.ts";
import fs from "fs";
import path from "path";

// Load .env.local
const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf-8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    const val = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

async function measureP05() {
  const patientId = "P05";
  const patientMeta = {
    name: "Kantilal Shah",
    age: 60,
    gender: "Male",
    complaint: "Routine review, feels giddiness occasionally",
    visitType: "Follow-up",
  };

  const bundle = getPatientRecordBundle(patientId);
  const previousNotes = notesStore.getNotes(patientId);
  const clinicalRefPath = path.join(process.cwd(), "data", "reference", "clinical-reference.md");
  const clinicalRefText = fs.readFileSync(clinicalRefPath, "utf-8");

  const entries = (bundle?.entry) || [];
  const recordsSummary = entries.map((e) => {
    const r = e.resource;
    if (!r) return null;
    return {
      id: r.id,
      type: r.resourceType,
      date: r.date || r.effectiveDateTime || r.authoredOn || r.recordedDate || r.start,
      text: (r.code)?.text ||
        (r.medicationCodeableConcept)?.text ||
        r.title ||
        r.display ||
        (r.valueQuantity ? `${r.valueQuantity.value} ${r.valueQuantity.unit || ""}` : undefined),
      note: r.clinicalNote || r.text?.div,
    };
  }).filter(Boolean);

  const userPrompt = JSON.stringify({
    patientProfile: {
      id: patientId,
      name: patientMeta.name,
      age: patientMeta.age,
      gender: patientMeta.gender,
      complaint: patientMeta.complaint,
      visitType: patientMeta.visitType,
    },
    previousChartGlanceNotes: previousNotes,
    consentedHealthRecords: recordsSummary,
    clinicalReference: clinicalRefText,
  });

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

  const promptChars = userPrompt.length + systemInstruction.length;
  console.log(`Prompt Characters: ${promptChars} (userPrompt: ${userPrompt.length}, systemInstruction: ${systemInstruction.length})`);

  // Count tokens using countTokens API
  const countUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:countTokens?key=${encodeURIComponent(apiKey)}`;
  const countRes = await fetch(countUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] },
      ],
    }),
  });

  const countData = await countRes.json();
  console.log("countTokens API response:", JSON.stringify(countData));
  const totalTokens = countData.totalTokens;
  console.log(`Prompt Tokens: ${totalTokens}`);

  // Determine current thinking configuration
  const thinkingLevel = "unconfigured (default model behavior / full deliberation)";
  console.log(`Thinking Level: ${thinkingLevel}`);

  // Measure time taken for generateContent call
  const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  console.log("Sending generateContent request for P05...");
  const start = Date.now();
  let timeTakenMs = 0;
  let status = 0;
  let responseData = null;

  try {
    const genRes = await fetch(generateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });
    timeTakenMs = Date.now() - start;
    status = genRes.status;
    responseData = await genRes.json();
  } catch (err) {
    timeTakenMs = Date.now() - start;
    console.log(`Generate call ended with error after ${timeTakenMs}ms:`, err.message);
  }

  console.log(`HTTP Status: ${status}`);
  console.log(`Time Taken: ${timeTakenMs}ms (${(timeTakenMs / 1000).toFixed(2)}s)`);
  if (responseData) {
    console.log("Response candidate text length:", responseData.candidates?.[0]?.content?.parts?.[0]?.text?.length || 0);
  }
}

measureP05().catch(console.error);
