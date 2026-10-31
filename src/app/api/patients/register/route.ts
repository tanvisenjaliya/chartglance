import { NextRequest, NextResponse } from "next/server";
import {
  getOpdQueue,
  saveOpdQueue,
  getNextTokenNumber,
  getAllRegistryPatients,
  PatientQueueItem,
} from "@/lib/records";

/**
 * POST /api/patients/register
 *
 * Adds a patient into today's queue (data/todays-queue.json)
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
      age: string | number;
      gender: "Male" | "Female" | "Other" | "M" | "F" | "O";
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

    // Check if already in queue
    if (id && queue.some((p) => p.id === id)) {
      return NextResponse.json(
        { error: "Patient is already in today's OPD queue" },
        { status: 409 }
      );
    }

    const now = new Date();
    const arrivalTime = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    // Lookup original registry patient to retain any villages or facility lists
    const registry = getAllRegistryPatients();
    const regPatient = registry.find((p) => p.id === id);

    const newPatient: PatientQueueItem = {
      id: id || `P-${Date.now()}`,
      tokenNumber: getNextTokenNumber(),
      name,
      age,
      gender,
      abhaNumber,
      abhaAddress,
      arrivalTime,
      visitType: regPatient?.visitType || "Follow-up",
      chiefComplaint,
      complaint: chiefComplaint,
      dataStatus: hasRecords ? "Records available" : "ABHA, no records",
      recordCount: recordCount ?? 0,
      hasRecords: hasRecords ?? false,
      village: regPatient?.village,
      district: regPatient?.district,
      state: regPatient?.state,
      facilities: regPatient?.facilities,
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
