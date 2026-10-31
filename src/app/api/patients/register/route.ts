import { NextRequest, NextResponse } from "next/server";
import {
  getOpdQueue,
  saveOpdQueue,
  getNextTokenNumber,
  PatientQueueItem,
} from "@/lib/records";

/**
 * POST /api/patients/register
 *
 * Body:
 * {
 *   id: string;           // from background-patients (bg-XX) or "unknown"
 *   name: string;
 *   age: number;
 *   gender: "Male" | "Female" | "Other";
 *   abhaNumber: string;
 *   abhaAddress: string;
 *   hasRecords: boolean;
 *   recordCount: number;
 *   chiefComplaint: string;
 * }
 *
 * Appends the patient to patients.json and returns the new entry.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      id,
      name,
      age,
      gender,
      abhaNumber,
      abhaAddress,
      hasRecords,
      recordCount,
      chiefComplaint,
    } = body as {
      id: string;
      name: string;
      age: number;
      gender: "Male" | "Female" | "Other";
      abhaNumber: string;
      abhaAddress: string;
      hasRecords: boolean;
      recordCount: number;
      chiefComplaint: string;
    };

    if (!name || !abhaNumber || !chiefComplaint) {
      return NextResponse.json(
        { error: "name, abhaNumber, and chiefComplaint are required" },
        { status: 400 }
      );
    }

    const queue = getOpdQueue();

    // Don't duplicate: if this id (bg patient) is already in the queue, reject
    if (id && queue.find((p) => p.id === id)) {
      return NextResponse.json(
        { error: "Patient is already in today's queue" },
        { status: 409 }
      );
    }

    const now = new Date();
    const arrivalTime = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const newPatient: PatientQueueItem = {
      id: id || `reg-${Date.now()}`,
      tokenNumber: getNextTokenNumber(),
      name,
      age,
      gender,
      abhaNumber,
      abhaAddress,
      arrivalTime,
      visitType: "New Visit",
      chiefComplaint,
      dataStatus: hasRecords
        ? "Records available"
        : abhaNumber && abhaNumber !== "—"
        ? "ABHA, no records"
        : "No ABHA",
      recordCount: recordCount ?? 0,
      hasRecords: hasRecords ?? false,
      queueStatus: "Waiting",
    };

    queue.push(newPatient);
    saveOpdQueue(queue);

    return NextResponse.json({ patient: newPatient });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to register patient";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

