import { NextRequest, NextResponse } from "next/server";
import { abdmClient } from "@/lib/abdm-mock";

export async function POST(
  req: NextRequest,
  { params }: { params: { patientId: string; action: string } }
) {
  try {
    const { patientId, action } = params;

    let consent;
    if (action === "approve") {
      consent = abdmClient.approveConsent(patientId);
    } else if (action === "deny") {
      consent = abdmClient.denyConsent(patientId);
    } else if (action === "expire") {
      consent = abdmClient.expireConsent(patientId);
    } else if (action === "reset") {
      abdmClient.resetConsent(patientId);
      return NextResponse.json({ success: true, status: "NOT_REQUESTED" });
    } else {
      return NextResponse.json(
        { error: `Invalid consent action: ${action}` },
        { status: 400 }
      );
    }

    const recordsData = abdmClient.fetchRecords(patientId);

    return NextResponse.json({
      consent,
      recordsData,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process consent action";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
