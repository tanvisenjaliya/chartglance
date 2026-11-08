import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  getOpdQueue,
  saveOpdQueue,
  resetTodayQueue,
  buildFreshDailyQueue,
} from "../src/lib/records.ts";
import { notesStore } from "../src/lib/notes-store.ts";

async function runTests() {
  console.log("=== Testing Queue Rules & Daily Reset ===");

  // 1. Test Daily Reset
  console.log("\n[Test 1] Testing resetTodayQueue()...");

  // Ensure mock consultation note exists
  const testPatientId = "P01";
  notesStore.saveNote({
    patientId: testPatientId,
    noteText: "Test consultation note for reset verification",
    followUp: "14 days",
    doctorName: "Dr. Aditi Sharma",
    facility: "PHC Navli",
  });
  const notesBefore = notesStore.getNotes(testPatientId);
  assert.ok(notesBefore.length > 0, "Consultation note should exist before reset");

  // Mutate current queue to simulate an active day (1 in consult, 1 done, rest waiting)
  let queue = resetTodayQueue();
  queue[0].queueStatus = "In consultation";
  queue[1].queueStatus = "Done";
  queue[1].completedTimestamp = Date.now();
  saveOpdQueue(queue);

  let modifiedQueue = getOpdQueue();
  const inConsultBefore = modifiedQueue.filter((p) => p.queueStatus === "In consultation").length;
  const doneBefore = modifiedQueue.filter((p) => p.queueStatus === "Done").length;
  assert.strictEqual(inConsultBefore, 1, "Should have 1 in consultation before reset");
  assert.strictEqual(doneBefore, 1, "Should have 1 done before reset");

  // Run Reset
  const resetResult = resetTodayQueue();
  assert.strictEqual(resetResult.length, 10, "Reset queue must have 10 patients");

  const waitingAfter = resetResult.filter((p) => p.queueStatus === "Waiting").length;
  const inConsultAfter = resetResult.filter((p) => p.queueStatus === "In consultation").length;
  const doneAfter = resetResult.filter((p) => p.queueStatus === "Done").length;
  const emergenciesAfter = resetResult.filter((p) => p.isEmergency).length;

  assert.strictEqual(waitingAfter, 10, "All 10 patients must be Waiting after reset");
  assert.strictEqual(inConsultAfter, 0, "0 patients must be In consultation after reset");
  assert.strictEqual(doneAfter, 0, "0 patients must be Done after reset");
  assert.strictEqual(emergenciesAfter, 0, "0 emergency patients in fresh queue");

  // Verify notes are preserved
  const notesAfter = notesStore.getNotes(testPatientId);
  assert.strictEqual(notesAfter.length, notesBefore.length, "Consultation notes must be preserved after reset");
  console.log("✔ resetTodayQueue() successfully restored all 10 patients to Waiting with notes preserved.");

  // 2. Test New Day Initialization
  console.log("\n[Test 2] Testing fresh date queue generation (simulating 2026-11-08)...");
  const testDate = "2026-11-08";
  const newDayQueue = buildFreshDailyQueue(testDate);
  assert.strictEqual(newDayQueue.length, 10, "New day queue must have 10 patients");

  const newDayWaiting = newDayQueue.filter((p) => p.queueStatus === "Waiting").length;
  const newDayInConsult = newDayQueue.filter((p) => p.queueStatus === "In consultation").length;
  const newDayDone = newDayQueue.filter((p) => p.queueStatus === "Done").length;

  assert.strictEqual(newDayWaiting, 10, "Every patient on new date must be Waiting");
  assert.strictEqual(newDayInConsult, 0, "0 in consultation on new date");
  assert.strictEqual(newDayDone, 0, "0 done on new date");

  // Verify P01-P05 are included
  const ids = new Set(newDayQueue.map((p) => p.id));
  for (const id of ["P01", "P02", "P03", "P04", "P05"]) {
    assert.ok(ids.has(id), `New date queue must contain ${id}`);
  }

  // Verify tokens are OPD-01 through OPD-10
  for (let i = 0; i < 10; i++) {
    const expectedToken = `OPD-${String(i + 1).padStart(2, "0")}`;
    assert.strictEqual(newDayQueue[i].tokenNumber, expectedToken, `Patient ${i + 1} must have token ${expectedToken}`);
  }

  // Cleanup simulated date queue file
  const simulatedFilePath = path.join(process.cwd(), "data", "runtime", `queue-${testDate}.json`);
  if (fs.existsSync(simulatedFilePath)) {
    fs.unlinkSync(simulatedFilePath);
  }
  console.log("✔ New day generation correctly produces 10 Waiting patients with tokens in arrival order.");

  // 3. Test Single In-Consultation Enforcement in API
  console.log("\n[Test 3] Testing single in-consultation constraint...");
  const { updatePatientQueueStatus } = await import("../src/lib/records.ts");

  // Ensure queue is reset first
  resetTodayQueue();

  const activeQ = getOpdQueue();
  const patientA = activeQ[0];
  const patientB = activeQ[1];

  // Set patientA to "In consultation" -> should succeed
  const resA = updatePatientQueueStatus(patientA.id, "In consultation");
  assert.strictEqual(resA.ok, true, "Patient A should successfully enter consultation");
  assert.strictEqual(resA.patient.queueStatus, "In consultation");

  // Attempt to set patientB to "In consultation" -> should fail with conflict
  const resB = updatePatientQueueStatus(patientB.id, "In consultation");
  assert.strictEqual(resB.ok, false, "Patient B must fail to enter consultation");
  assert.strictEqual(resB.conflict, true, "Conflict flag must be true");
  assert.strictEqual(resB.error, "Finish the current consultation first", "Error message must match requirement");
  assert.strictEqual(resB.activePatient.id, patientA.id, "Active patient id must point to patient A");
  assert.strictEqual(resB.activePatient.name, patientA.name, "Active patient name must match patient A");
  console.log("✔ Single in-consultation constraint enforced: returns conflict with 'Finish the current consultation first' pointing to active patient.");

  // Clean reset today's queue back to clean state
  resetTodayQueue();
  console.log("\n✔ All tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
