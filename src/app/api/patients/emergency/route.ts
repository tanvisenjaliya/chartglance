import { NextRequest, NextResponse } from "next/server";
import {
  getOpdQueue,
  saveOpdQueue,
  getNextEmergencyToken,
  getAllRegistryPatients,
  PatientQueueItem,
} from "@/lib/records";
import { abdmClient } from "@/lib/abdm-mock";

/**
 * POST /api/patients/emergency
 * Registers an emergency patient with token E1, E2...
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      hasAbha,
      abhaNumber,
      abhaAddress,
      name,
      age,
      gender,
      mobileNumber,
      emergencyReason,
    } = body as {
      hasAbha: boolean;
      abhaNumber?: string;
      abhaAddress?: string;
      name: string;
      age: string | number;
      gender: "Male" | "Female" | "Other";
      mobileNumber?: string;
      emergencyReason: string;
    };

    if (!emergencyReason || !emergencyReason.trim()) {
      return NextResponse.json(
        { error: "Reason for emergency is required" },
        { status: 400 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Patient name is required (use 'Unknown' if unidentified)" },
        { status: 400 }
      );
    }

    const queue = getOpdQueue();
    const now = new Date();
    const arrivalTime = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const arrivalTimestamp = now.getTime();

    const tokenNumber = getNextEmergencyToken();
    const patientId = `emg-${now.getTime()}`;

    let hasRecords = false;
    let recordCount = 0;
    let recordsFile: string | undefined;

    if (hasAbha && (abhaNumber || abhaAddress)) {
      const registry = getAllRegistryPatients();
      const match = registry.find(
        (p) =>
          (abhaNumber && p.abhaNumber === abhaNumber) ||
          (abhaAddress && p.abhaAddress.toLowerCase() === abhaAddress.toLowerCase())
      );
      if (match) {
        hasRecords = match.hasRecords;
        recordCount = match.recordCount;
        recordsFile = match.recordsFile;
      }
    }

    const newPatient: PatientQueueItem = {
      id: patientId,
      tokenNumber,
      name: name.trim(),
      age: age || "Unknown",
      gender: gender || "Other",
      abhaNumber: hasAbha ? (abhaNumber || "") : "",
      abhaAddress: hasAbha ? (abhaAddress || "") : "",
      hasAbha: Boolean(hasAbha),
      isEmergency: true,
      emergencyReason: emergencyReason.trim(),
      mobileNumber: mobileNumber?.trim() || undefined,
      arrivalTime,
      arrivalTimestamp,
      visitType: "Emergency",
      chiefComplaint: `EMERGENCY: ${emergencyReason.trim()}`,
      complaint: emergencyReason.trim(),
      dataStatus: hasRecords ? "Records available" : "ABHA, no records",
      recordCount,
      hasRecords,
      recordsFile,
      queueStatus: "Waiting",
    };

    if (hasAbha && abhaNumber && abhaAddress) {
      try {
        abdmClient.createConsentRequest(patientId, abhaNumber, abhaAddress);
      } catch (err) {
        console.error("Auto consent creation error:", err);
      }
    }

    queue.push(newPatient);
    saveOpdQueue(queue);

    return NextResponse.json({ patient: newPatient });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to register emergency patient";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

