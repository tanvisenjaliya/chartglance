import { NextRequest, NextResponse } from "next/server";
import { getOpdQueue, saveOpdQueue, getAllRegistryPatients } from "@/lib/records";
import { abdmClient } from "@/lib/abdm-mock";

/**
 * POST /api/patients/[id]/link-abha
 * Links an ABHA account to a patient who arrived without ABHA.
 *
 * Body: { abhaNumber: string, abhaAddress: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { abhaNumber, abhaAddress } = body as {
      abhaNumber: string;
      abhaAddress: string;
    };

    if (!abhaNumber || !abhaAddress) {
      return NextResponse.json(
        { error: "Both ABHA number and ABHA address are required" },
        { status: 400 }
      );
    }

    const queue = getOpdQueue();
    const idx = queue.findIndex((p) => p.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: "Patient not found in queue" }, { status: 404 });
    }

    const patient = queue[idx];

    // Check registry to see if there is a match with existing records
    const registry = getAllRegistryPatients();
    const match = registry.find(
      (p) =>
        p.abhaNumber === abhaNumber ||
        p.abhaAddress.toLowerCase() === abhaAddress.toLowerCase()
    );

    const hasRecords = match ? match.hasRecords : false;
    const recordCount = match ? match.recordCount : 0;
    const recordsFile = match ? match.recordsFile : undefined;

    const updatedPatient = {
      ...patient,
      abhaNumber,
      abhaAddress,
      hasAbha: true,
      hasRecords,
      recordCount,
      recordsFile,
      dataStatus: (hasRecords ? "Records available" : "ABHA, no records") as "Records available" | "ABHA, no records",
    };

    // Auto-create consent request now that ABHA is linked
    try {
      abdmClient.createConsentRequest(id, abhaNumber, abhaAddress);
    } catch (err) {
      console.error("Consent auto-request failed on ABHA link:", err);
    }

    queue[idx] = updatedPatient;
    saveOpdQueue(queue);

    return NextResponse.json({ patient: updatedPatient });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to link ABHA";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

