import { NextResponse } from "next/server";
import { getOpdQueue } from "@/lib/records";

export const dynamic = "force-dynamic";

export async function GET() {
  const queue = getOpdQueue();
  return NextResponse.json(queue);
}
