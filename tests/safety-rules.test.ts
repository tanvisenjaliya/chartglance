import test, { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { evaluatePatientSafety } from "../src/lib/safety-rules/index";

function loadPatientBundle(patientId: string): unknown {
  const filePath = path.join(process.cwd(), "data", "records", `${patientId}.json`);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

describe("Safety Rules Engine (/lib/safety-rules)", () => {
  it("P02 triggers the severe anaemia in pregnancy check (< 7 g/dL)", () => {
    const bundle = loadPatientBundle("P02");
    const alerts = evaluatePatientSafety(bundle);

    assert.strictEqual(alerts.length, 1, "P02 should trigger exactly 1 safety alert");

    const anaemiaAlert = alerts.find((a) => a.ruleId === "R-ANAEMIA-PREGNANCY");
    assert.ok(anaemiaAlert, "P02 must trigger R-ANAEMIA-PREGNANCY");
    assert.strictEqual(anaemiaAlert.severity, "CRITICAL");
    assert.ok(
      anaemiaAlert.message.includes("6.8") && anaemiaAlert.message.includes("7"),
      `Message should include Hb value and threshold: ${anaemiaAlert.message}`
    );
    assert.ok(
      anaemiaAlert.sourceIds.includes("p02-obs-22"),
      "Source IDs must reference the severe Hb observation p02-obs-22"
    );
    assert.ok(
      anaemiaAlert.sourceIds.some((id) => id.includes("cond")),
      "Source IDs must reference the pregnancy condition"
    );
  });

  it("P01 triggers the BP (≥ 180/110) and HbA1c (≥ 9%) checks", () => {
    const bundle = loadPatientBundle("P01");
    const alerts = evaluatePatientSafety(bundle);

    assert.strictEqual(alerts.length, 2, "P01 should trigger exactly 2 safety alerts");

    // Check 1: Hypertensive crisis
    const bpAlert = alerts.find((a) => a.ruleId === "R-HYPERTENSION-CRISIS");
    assert.ok(bpAlert, "P01 must trigger R-HYPERTENSION-CRISIS");
    assert.strictEqual(bpAlert.severity, "CRITICAL");
    assert.ok(
      bpAlert.message.includes("182") && bpAlert.message.includes("112"),
      `Message should include BP values: ${bpAlert.message}`
    );
    assert.ok(
      bpAlert.sourceIds.includes("p01-obs-24"),
      "Source IDs must include systolic reading p01-obs-24"
    );
    assert.ok(
      bpAlert.sourceIds.includes("p01-obs-25"),
      "Source IDs must include diastolic reading p01-obs-25"
    );

    // Check 2: HbA1c critical
    const hba1cAlert = alerts.find((a) => a.ruleId === "R-HBA1C-CRITICAL");
    assert.ok(hba1cAlert, "P01 must trigger R-HBA1C-CRITICAL");
    assert.strictEqual(hba1cAlert.severity, "HIGH");
    assert.ok(
      hba1cAlert.message.includes("9.2"),
      `Message should include HbA1c value: ${hba1cAlert.message}`
    );
    assert.ok(
      hba1cAlert.sourceIds.includes("p01-obs-23"),
      "Source IDs must include HbA1c observation p01-obs-23"
    );
  });

  it("P03 triggers the TB treatment interruption check (> 14 days overdue)", () => {
    const bundle = loadPatientBundle("P03");
    const alerts = evaluatePatientSafety(bundle);

    assert.strictEqual(alerts.length, 1, "P03 should trigger exactly 1 safety alert");

    const tbAlert = alerts.find((a) => a.ruleId === "R-TB-TREATMENT-GAP");
    assert.ok(tbAlert, "P03 must trigger R-TB-TREATMENT-GAP");
    assert.strictEqual(tbAlert.severity, "HIGH");
    assert.ok(
      tbAlert.message.includes("overdue") && tbAlert.message.includes("14"),
      `Message must indicate overdue status: ${tbAlert.message}`
    );
    assert.ok(
      tbAlert.sourceIds.includes("p03-appt-10") || tbAlert.sourceIds.includes("p03-disp-9"),
      "Source IDs must include appointment or dispense"
    );
    assert.ok(
      tbAlert.sourceIds.includes("p03-cond-2"),
      "Source IDs must include TB condition"
    );
  });

  it("P05 triggers the cross-facility drug duplication check (same class within 90 days)", () => {
    const bundle = loadPatientBundle("P05");
    const alerts = evaluatePatientSafety(bundle);

    assert.strictEqual(alerts.length, 1, "P05 should trigger exactly 1 safety alert");

    const dupAlert = alerts.find((a) => a.ruleId === "R-MED-DUPLICATION");
    assert.ok(dupAlert, "P05 must trigger R-MED-DUPLICATION");
    assert.strictEqual(dupAlert.severity, "HIGH");
    assert.ok(
      dupAlert.message.includes("Glimepiride") &&
        dupAlert.message.includes("Gliclazide") &&
        dupAlert.message.includes("Sulfonylurea"),
      `Message should detail duplicated drugs and class: ${dupAlert.message}`
    );
    assert.ok(
      dupAlert.sourceIds.includes("p05-med-8"),
      "Source IDs must include first prescription p05-med-8"
    );
    assert.ok(
      dupAlert.sourceIds.includes("p05-med-13"),
      "Source IDs must include second prescription p05-med-13"
    );
  });

  it("A patient with no records triggers nothing", () => {
    // Empty bundle
    const emptyBundle = { resourceType: "Bundle", entry: [] };
    assert.deepStrictEqual(evaluatePatientSafety(emptyBundle), []);

    // Empty array of resources
    assert.deepStrictEqual(evaluatePatientSafety([]), []);

    // Null / undefined inputs
    assert.deepStrictEqual(evaluatePatientSafety(null), []);
    assert.deepStrictEqual(evaluatePatientSafety(undefined), []);

    // Patient P04 (only has single fever record 3 years ago, no active high-risk conditions)
    const p04Bundle = loadPatientBundle("P04");
    const p04Alerts = evaluatePatientSafety(p04Bundle);
    assert.deepStrictEqual(p04Alerts, [], "P04 has no safety flags and must trigger nothing");
  });
});
