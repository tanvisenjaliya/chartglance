import { NextRequest, NextResponse } from "next/server";
import { getOpdQueue, getAllRegistryPatients } from "@/lib/records";
import { getOrGenerateAnalysis } from "@/lib/ai/gemini-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: { patientId: string } }
) {
  return handleAnalysis(req, params.patientId);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { patientId: string } }
) {
  return handleAnalysis(req, params.patientId);
}

async function handleAnalysis(req: NextRequest, patientId: string) {
  try {
    const refresh = req.nextUrl.searchParams.get("refresh") === "true";

    // Lookup patient demographic metadata
    const queue = getOpdQueue();
    let patient = queue.find((p) => p.id === patientId);

    if (!patient) {
      const registry = getAllRegistryPatients();
      patient = registry.find((p) => p.id === patientId);
    }

    const patientMeta = {
      name: patient?.name || "Patient",
      age: patient?.age || "Adult",
      gender: patient?.gender || "Unknown",
      complaint: patient?.chiefComplaint || patient?.complaint,
      visitType: patient?.visitType || "Follow-up",
    };

    const analysis = await getOrGenerateAnalysis(patientId, patientMeta, refresh);

    return NextResponse.json(analysis);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI analysis failed";
    const status = message.includes("Consent not granted") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

