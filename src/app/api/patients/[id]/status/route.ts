import { NextRequest, NextResponse } from "next/server";
import { updatePatientQueueStatus } from "@/lib/records";

/**
 * PATCH /api/patients/[id]/status
 * Body: { status: "Waiting" | "In consultation" | "Done" }
 * Updates a patient's queueStatus in today's active queue.
 * Rejects with 409 if another patient is already in consultation.
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

    const result = updatePatientQueueStatus(
      id,
      status as "Waiting" | "In consultation" | "Done"
    );

    if (!result.ok) {
      if (result.conflict) {
        return NextResponse.json(
          {
            error: result.error,
            activePatient: result.activePatient,
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ patient: result.patient });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update patient status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
