import { NextRequest, NextResponse } from "next/server";
import { abdmClient } from "@/lib/abdm-mock";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId, abhaNumber, abhaAddress } = body;

    if (!patientId || !abhaNumber || !abhaAddress) {
      return NextResponse.json(
        { error: "Missing required patient identification details" },
        { status: 400 }
      );
    }

    const consent = abdmClient.createConsentRequest(
      patientId,
      abhaNumber,
      abhaAddress
    );

    return NextResponse.json({ consent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create consent request";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
