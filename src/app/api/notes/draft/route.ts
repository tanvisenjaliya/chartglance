import { NextRequest, NextResponse } from "next/server";
import { notesStore, FollowUpPeriod } from "@/lib/notes-store";

/**
 * POST /api/notes/draft
 * Body: { patientId: string, noteText: string, followUp: FollowUpPeriod }
 * Autosaves the draft note.
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

    notesStore.saveDraft({
      patientId,
      noteText: noteText || "",
      followUp: followUp || "none",
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to autosave draft";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

