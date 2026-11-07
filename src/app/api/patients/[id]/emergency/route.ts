import { NextRequest, NextResponse } from "next/server";
import { getOpdQueue, saveOpdQueue } from "@/lib/records";

/**
 * PATCH /api/patients/[id]/emergency
 * Body: { emergencyReason: string }
 *
 * Marks an existing queue patient as an emergency in-place.
 * Sets isEmergency = true and queueStatus = "Waiting".
 * Keeps their original token number; OpdDashboard's sortQueueLive
 * already floats emergencies to the top of the display.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const emergencyReason: string = (body?.emergencyReason ?? "").trim();

    if (!emergencyReason) {
      return NextResponse.json(
        { error: "emergencyReason is required" },
        { status: 400 }
      );
    }

    const queue = getOpdQueue();
    const idx = queue.findIndex((p) => p.id === id);

    if (idx === -1) {
      return NextResponse.json(
        { error: "Patient not found in today's queue" },
        { status: 404 }
      );
    }

    // Update in-place — keep all existing fields
    queue[idx] = {
      ...queue[idx],
      isEmergency: true,
      emergencyReason,
      queueStatus: "Waiting",
    };

    saveOpdQueue(queue);

    return NextResponse.json({ patient: queue[idx] });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to mark patient as emergency";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

