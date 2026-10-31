import { NextRequest, NextResponse } from "next/server";
import { getAllRegistryPatients, getOpdQueue } from "@/lib/records";

/**
 * POST /api/abdm/lookup
 * Body: { query: string }  — ABHA number or ABHA address
 *
 * Looks up any of the 25 registered patients from data/patients.json.
 * Flags if the patient is already in today's active queue.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query: string = (body?.query ?? "").trim();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const registry = getAllRegistryPatients();
    const qLower = query.toLowerCase();

    // Clean comparison: handle hyphenated or plain numbers
    const cleanDigits = query.replace(/[^\d]/g, "");

    const match = registry.find((p) => {
      const pAbhaClean = p.abhaNumber.replace(/[^\d]/g, "");
      return (
        p.abhaNumber === query ||
        (cleanDigits.length >= 10 && pAbhaClean === cleanDigits) ||
        p.abhaAddress.toLowerCase() === qLower ||
        p.id.toLowerCase() === qLower
      );
    });

    if (!match) {
      return NextResponse.json(
        { error: "ABHA not found in mock ABDM registry." },
        { status: 404 }
      );
    }

    const todayQueue = getOpdQueue();
    const alreadyInQueue = todayQueue.some(
      (qp) => qp.id === match.id || qp.abhaNumber === match.abhaNumber
    );

    return NextResponse.json({
      patient: {
        id: match.id,
        name: match.name,
        age: match.age,
        gender: match.gender,
        abhaNumber: match.abhaNumber,
        abhaAddress: match.abhaAddress,
        recordCount: match.recordCount,
        hasRecords: match.hasRecords,
        recordFacilities: match.facilities || [],
        village: match.village,
        district: match.district,
        recordSummary: match.hasRecords
          ? `${match.recordCount} linked health record(s) on file.`
          : "No linked digital health records found.",
      },
      alreadyInQueue,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
