import { NextResponse } from "next/server";
import { getOpdQueue } from "@/lib/records";

export async function GET() {
  const queue = getOpdQueue();
  return NextResponse.json(queue);
}
