import { NextResponse } from "next/server";
import { callGemini } from "@/lib/ai/gemini-analysis";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleAiCheck();
}

export async function POST() {
  return handleAiCheck();
}

async function handleAiCheck() {
  const startTime = Date.now();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const primaryModel = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim() || null;

  const serverEnv = {
    apiKeyPresent: Boolean(apiKey),
    apiKeyLength: apiKey ? apiKey.length : 0, // Never send value
    geminiModel: primaryModel,
    geminiFallbackModel: fallbackModel || "(not set)",
  };

  const runtime = {
    executionEnvironment: "Node.js Server Runtime (Next.js Route Handler)",
    nodeVersion: process.version,
    platform: process.platform,
    executedOnServer: true,
  };

  const result = await callGemini({
    userPrompt: "Respond with the single word: OK",
    temperature: 0.1,
    timeoutMs: 30000,
  });

  const durationMs = Date.now() - startTime;

  return NextResponse.json({
    ok: result.ok,
    status: result.status,
    modelUsed: result.modelUsed,
    fallbackUsed: result.fallbackUsed,
    attempts: result.attempts,
    text: result.text || null,
    error: result.error || null,
    rawError: result.rawError || null,
    requestUrlMasked: result.requestUrlMasked || null,
    serverEnv,
    runtime,
    durationMs,
  });
}
