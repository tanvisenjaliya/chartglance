import { NextRequest, NextResponse } from "next/server";
import { notesStore, FollowUpPeriod } from "@/lib/notes-store";
import { getClinicFacility, getOpdQueue, saveOpdQueue } from "@/lib/records";

/**
 * GET /api/notes?patientId=<id>
 * Returns past notes (newest first) and draft if available.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    const notes = notesStore.getNotes(patientId);
    const draft = notesStore.getDraft(patientId);

    return NextResponse.json({ notes, draft });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load notes";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/notes
 * Saves a finalized consultation note, clears the draft,
 * and marks the patient's queueStatus to "Done".
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId, noteText, followUp } = body as {
      patientId: string;
      noteText: string;
      followUp: FollowUpPeriod;
    };

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    const clinic = getClinicFacility();
    const now = new Date();
    const dateFormatted = now.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timeFormatted = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const note = notesStore.saveNote({
      patientId,
      date: dateFormatted,
      time: timeFormatted,
      doctorName: "Dr. Aditi Sharma",
      facilityName: clinic.facilityName,
      noteText: noteText || "(Consultation completed without notes)",
      followUp: followUp || "none",
    });

    // Mark patient as Done in todays-queue
    const queue = getOpdQueue();
    const pIdx = queue.findIndex((p) => p.id === patientId);
    if (pIdx !== -1) {
      queue[pIdx] = {
        ...queue[pIdx],
        queueStatus: "Done",
      };
      saveOpdQueue(queue);
    }

    return NextResponse.json({ note, success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save note";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

