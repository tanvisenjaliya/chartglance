import { getOrGenerateAnalysis } from "../src/lib/ai/gemini-analysis.ts";
import { abdmClient } from "../src/lib/abdm-mock/index.ts";
import fs from "fs";
import path from "path";

// Ensure env variables from .env.local are loaded if not present
if (!process.env.GEMINI_API_KEY) {
  try {
    const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf-8");
    for (const line of envFile.split("\n")) {
      const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        const val = match[2].trim().replace(/^['"]|['"]$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (e) {
    console.error("Could not load .env.local:", e);
  }
}

async function testPatient(patientId, meta) {
  console.log(`\n========================================`);
  console.log(`Testing Analysis for ${meta.name} (${patientId})`);
  console.log(`========================================`);

  // Ensure consent is granted in mock ABDM
  let consent = abdmClient.getConsent(patientId);
  if (!consent || consent.status !== "GRANTED") {
    console.log(`Setting mock consent to GRANTED for ${patientId}...`);
    try {
      abdmClient.approveConsent(patientId);
    } catch {
      abdmClient.createConsentRequest(patientId, "91-5555-1234-5678", `${patientId.toLowerCase()}@sbx`);
      abdmClient.approveConsent(patientId);
    }
  }

  const start = Date.now();
  try {
    const result = await getOrGenerateAnalysis(patientId, meta, true);
    const duration = Date.now() - start;

    console.log(`Duration: ${duration} ms (${(duration / 1000).toFixed(2)}s)`);
    console.log(`AI Succeeded: ${!result.aiFailed}`);
    if (result.aiFailed) {
      console.log(`Failure Notice: ${result.failureNotice}`);
    } else {
      console.log(`Model Used: ${result.modelUsed || process.env.GEMINI_MODEL}`);
      console.log(`Summary: ${result.summary}`);
      console.log(`Red Flags Count: ${result.redFlags.length}`);
      console.log(`Yellow Flags Count: ${result.yellowFlags.length}`);
      console.log(`Trends Count: ${result.trends.length}`);
      console.log(`Medicines Count: ${result.currentMedicines.length}`);
    }
    return {
      patientId,
      name: meta.name,
      succeeded: !result.aiFailed,
      model: result.modelUsed || process.env.GEMINI_MODEL,
      durationMs: duration,
      summary: result.summary,
      failureNotice: result.failureNotice,
    };
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`Error during analysis:`, err);
    return {
      patientId,
      name: meta.name,
      succeeded: false,
      model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      durationMs: duration,
      error: err.message,
    };
  }
}

async function main() {
  const p01 = await testPatient("P01", {
    name: "Ramesh Patel",
    age: 52,
    gender: "Male",
    complaint: "Type 2 Diabetes & Hypertension follow-up",
    visitType: "Follow-up",
  });

  const p02 = await testPatient("P02", {
    name: "Hetal Parmar",
    age: 24,
    gender: "Female",
    complaint: "Antenatal routine checkup (2nd trimester)",
    visitType: "Follow-up",
  });

  console.log("\n========================================");
  console.log("FINAL RESULTS SUMMARY");
  console.log("========================================");
  console.log(JSON.stringify({ p01, p02 }, null, 2));
}

main();

