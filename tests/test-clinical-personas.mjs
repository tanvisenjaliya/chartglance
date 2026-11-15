import { getOrGenerateAnalysis } from "../src/lib/ai/gemini-analysis.ts";
import { abdmClient } from "../src/lib/abdm-mock/index.ts";
import fs from "fs";
import path from "path";

// Load .env.local
try {
  const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf-8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      const val = match[2].trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch (e) {
  console.error("Could not load .env.local:", e);
}

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

async function countPromptTokens(text) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:countTokens?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text }] }],
      }),
    });
    const data = await res.json();
    return data.totalTokens || 0;
  } catch {
    return 0;
  }
}

async function testPersona(patientId, meta) {
  console.log(`\n==================================================`);
  console.log(`Testing ${meta.name} (${patientId})`);
  console.log(`Condition: ${meta.complaint}`);
  console.log(`==================================================`);

  // Ensure consent is granted in mock ABDM
  let consent = abdmClient.getConsent(patientId);
  if (!consent || consent.status !== "GRANTED") {
    try {
      abdmClient.approveConsent(patientId);
    } catch {
      abdmClient.createConsentRequest(patientId, "91-5555-1234-5678", `${patientId.toLowerCase()}@sbx`);
      abdmClient.approveConsent(patientId);
    }
  }

  // Clear cache for fresh call
  const start = Date.now();
  let analysis = null;
  let errorMsg = null;

  try {
    analysis = await getOrGenerateAnalysis(patientId, meta, true);
  } catch (err) {
    errorMsg = err.message;
  }

  const durationMs = Date.now() - start;
  const succeeded = Boolean(analysis && !analysis.aiFailed);
  const modelUsed = analysis?.modelUsed || (analysis?.aiFailed ? "(failed)" : model);

  // Measure prompt tokens by building the user prompt equivalent or sample text
  console.log(`Duration: ${durationMs} ms (${(durationMs / 1000).toFixed(2)}s)`);
  console.log(`Status: ${succeeded ? "SUCCESS" : "FAILED"}`);
  console.log(`Model Used: ${modelUsed}`);
  console.log(`Prompt Tokens: ${analysis?.promptTokens ?? "N/A"}`);

  if (succeeded) {
    const wordCount = (analysis.summary || "").trim().split(/\s+/).filter(Boolean).length;
    console.log(`Summary (${wordCount} words): ${analysis.summary}`);
    console.log(`Red Flags (${analysis.redFlags.length}):`);
    analysis.redFlags.forEach((f, i) => console.log(`  [${i+1}] ${f.text} (sources: ${f.sourceIds?.join(", ")})`));
    console.log(`Yellow Flags (${analysis.yellowFlags.length}):`);
    analysis.yellowFlags.forEach((f, i) => console.log(`  [${i+1}] ${f.text} (sources: ${f.sourceIds?.join(", ")})`));
    console.log(`Current Meds (${analysis.currentMedicines.length}):`);
    analysis.currentMedicines.forEach((m, i) => console.log(`  [${i+1}] ${m.name} (sources: ${m.sourceIds?.join(", ")})`));
    console.log(`Missing Info (${analysis.missingInformation?.length || 0}):`);
    analysis.missingInformation?.forEach((m, i) => console.log(`  [${i+1}] ${m}`));
    console.log(`Ask the Patient (${analysis.askThePatient?.length || 0}):`);
    analysis.askThePatient?.forEach((q, i) => console.log(`  [${i+1}] ${q}`));
  } else {
    console.log(`Failure Notice: ${analysis?.failureNotice || errorMsg}`);
  }

  return {
    patientId,
    name: meta.name,
    succeeded,
    modelUsed,
    durationMs,
    promptTokens: analysis?.promptTokens ?? null,
    failureNotice: analysis?.failureNotice || errorMsg || null,
    summary: analysis?.summary,
    redFlags: analysis?.redFlags?.length || 0,
    yellowFlags: analysis?.yellowFlags?.length || 0,
  };
}

async function main() {
  const personas = [
    {
      id: "P01",
      meta: {
        name: "Ramesh Patel",
        age: 52,
        gender: "Male",
        complaint: "Type 2 Diabetes Mellitus & Hypertension follow-up",
        visitType: "Follow-up",
      },
    },
    {
      id: "P02",
      meta: {
        name: "Hetal Parmar",
        age: 24,
        gender: "Female",
        complaint: "Antenatal routine checkup (2nd trimester)",
        visitType: "Follow-up",
      },
    },
    {
      id: "P03",
      meta: {
        name: "Shankar Meena",
        age: 38,
        gender: "Male",
        complaint: "Pulmonary Tuberculosis treatment review",
        visitType: "Follow-up",
      },
    },
    {
      id: "P04",
      meta: {
        name: "Manjula Rathod",
        age: 45,
        gender: "Female",
        complaint: "High fever with chills and joint pain for 3 days",
        visitType: "New",
      },
    },
    {
      id: "P05",
      meta: {
        name: "Kantilal Shah",
        age: 60,
        gender: "Male",
        complaint: "Routine review, feels giddiness occasionally",
        visitType: "Follow-up",
      },
    },
  ];

  const results = [];
  for (const p of personas) {
    const res = await testPersona(p.id, p.meta);
    results.push(res);
  }

  console.log(`\n==================================================`);
  console.log(`FINAL REPORT SUMMARY`);
  console.log(`==================================================`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
