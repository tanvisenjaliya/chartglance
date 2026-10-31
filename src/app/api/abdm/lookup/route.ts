import { NextRequest, NextResponse } from "next/server";
import { lookupByAbha } from "@/lib/background-patients";
import { getOpdQueue } from "@/lib/records";

/**
 * POST /api/abdm/lookup
 * Body: { query: string }  — ABHA number or ABHA address
 *
 * Searches background patient registry + the 5 demo personas currently in the queue.
 * Returns the matched patient record or 404.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query: string = (body?.query ?? "").trim();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // 1. Check background patients
    const bgMatch = lookupByAbha(query);
    if (bgMatch) {
      return NextResponse.json({ patient: bgMatch, source: "registry" });
    }

    // 2. Also check the 5 demo personas (already in queue) by their ABHA fields
    const queue = getOpdQueue();
    const qLower = query.toLowerCase();
    const personaMatch = queue.find(
      (p) =>
        p.abhaNumber === query ||
        p.abhaAddress.toLowerCase() === qLower
    );
    if (personaMatch) {
      // Return a compatible shape
      return NextResponse.json({
        patient: {
          id: personaMatch.id,
          name: personaMatch.name,
          age: personaMatch.age,
          gender: personaMatch.gender,
          abhaNumber: personaMatch.abhaNumber,
          abhaAddress: personaMatch.abhaAddress,
          recordCount: personaMatch.recordCount,
          hasRecords: personaMatch.hasRecords,
          recordFacilities: [],
          recordSummary: personaMatch.hasRecords
            ? `${personaMatch.recordCount} record(s) on file.`
            : "No linked digital health records found.",
        },
        source: "queue",
        alreadyInQueue: true,
      });
    }

    return NextResponse.json({ error: "ABHA not found in mock registry" }, { status: 404 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

