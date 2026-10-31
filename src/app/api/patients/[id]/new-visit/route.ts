import { NextRequest, NextResponse } from "next/server";
import { getOpdQueue, saveOpdQueue, getNextTokenNumber } from "@/lib/records";

/**
 * POST /api/patients/[id]/new-visit
 * Puts a previously completed ("Done") patient back in the queue as a new visit.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { complaint } = body as { complaint?: string };

    const queue = getOpdQueue();
    const idx = queue.findIndex((p) => p.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: "Patient not found in queue" }, { status: 404 });
    }

    const patient = queue[idx];
    const now = new Date();
    const newArrival = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const updatedPatient = {
      ...patient,
      tokenNumber: getNextTokenNumber(),
      queueStatus: "Waiting" as const,
      visitType: "Follow-up" as const,
      arrivalTime: newArrival,
      chiefComplaint: complaint || patient.chiefComplaint || "Follow-up consultation",
      complaint: complaint || patient.complaint || "Follow-up consultation",
    };

    queue[idx] = updatedPatient;
    saveOpdQueue(queue);

    return NextResponse.json({ patient: updatedPatient });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to start new visit";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

