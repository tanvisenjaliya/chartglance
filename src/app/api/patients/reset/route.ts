import { NextResponse } from "next/server";
import { resetTodayQueue } from "@/lib/records";

export const dynamic = "force-dynamic";

/**
 * POST /api/patients/reset
 * Resets today's queue to its starting state: all 10 patients Waiting,
 * no emergency patients, no completed timestamps.
 * Consultation notes in data/runtime/notes.json are NOT touched.
 */
export async function POST() {
  try {
    const queue = resetTodayQueue();
    return NextResponse.json({ success: true, count: queue.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to reset queue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

