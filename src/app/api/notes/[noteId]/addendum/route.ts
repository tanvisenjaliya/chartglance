import { NextRequest, NextResponse } from "next/server";
import { notesStore } from "@/lib/notes-store";
import { getClinicFacility } from "@/lib/records";

/**
 * POST /api/notes/[noteId]/addendum
 * Appends a dated, attributed addendum to a finalized note.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const { noteId } = params;
    const body = await req.json();
    const { text } = body as { text: string };

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Addendum text is required" }, { status: 400 });
    }

    const clinic = getClinicFacility();
    const updatedNote = notesStore.addAddendum(noteId, {
      text: text.trim(),
      doctorName: "Dr. Aditi Sharma",
      facilityName: clinic.facilityName,
    });

    if (!updatedNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ note: updatedNote });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to add addendum";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

