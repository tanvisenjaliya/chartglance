import { NextRequest, NextResponse } from "next/server";
import { abdmClient } from "@/lib/abdm-mock";

export async function GET(
  req: NextRequest,
  { params }: { params: { patientId: string } }
) {
  try {
    const { patientId } = params;
    const consent = abdmClient.getConsent(patientId);
    const recordsData = abdmClient.fetchRecords(patientId);

    return NextResponse.json({
      consent,
      recordsData,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to retrieve consent record";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
