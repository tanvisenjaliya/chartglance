import { NextRequest, NextResponse } from "next/server";
import { getOpdQueue, saveOpdQueue } from "@/lib/records";

/**
 * PATCH /api/patients/[id]/status
 * Body: { status: "Waiting" | "In consultation" | "Done" }
 * Updates a single patient's queueStatus in patients.json.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { status } = body as { status: string };

    if (!["Waiting", "In consultation", "Done"].includes(status)) {
      return NextResponse.json(
        { error: `Invalid status: ${status}` },
        { status: 400 }
      );
    }

    const queue = getOpdQueue();
    const idx = queue.findIndex((p) => p.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    queue[idx] = {
      ...queue[idx],
      queueStatus: status as "Waiting" | "In consultation" | "Done",
    };
    saveOpdQueue(queue);

    return NextResponse.json({ patient: queue[idx] });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update patient status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

