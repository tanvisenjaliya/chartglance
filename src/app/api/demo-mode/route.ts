import { NextResponse } from "next/server";
import { isDemoMode, toggleDemoMode } from "@/lib/demo-config";

/** GET /api/demo-mode — returns current demo mode state */
export async function GET() {
  return NextResponse.json({ demoMode: isDemoMode() });
}

/** PATCH /api/demo-mode — toggles demo mode, returns new state */
export async function PATCH() {
  const newValue = toggleDemoMode();
  return NextResponse.json({ demoMode: newValue });
}

