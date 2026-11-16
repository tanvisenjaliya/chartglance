import { NextResponse } from "next/server";
import { callGemini } from "@/lib/ai/gemini-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export interface FestivalRouteResponse {
  ok: boolean;
  festival?: {
    name: string;
    date: string;        // YYYY-MM-DD, validated
    healthNote: string;
    daysAway: number;
  };
  groundingUsed: boolean;
  modelUsed: string;
  reason?: "grounding_unavailable" | "date_out_of_range" | "not_found" | "ai_error" | "parse_error";
}

/** Returns YYYY-MM-DD string for today in Asia/Kolkata timezone. */
function todayIndia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Midnight UTC for a YYYY-MM-DD string. */
function parseDate(str: string): Date {
  return new Date(`${str}T00:00:00Z`);
}

export async function GET() {
  const startMs = Date.now();
  const todayStr = todayIndia();
  const todayDate = parseDate(todayStr);
  const cutoffDate = new Date(todayDate.getTime() + 14 * 24 * 60 * 60 * 1000);

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";

  const userPrompt = `Today's date is ${todayStr} (India Standard Time).

What is the next festival, public holiday, or significant cultural observance celebrated in Gujarat, India,
that falls within the next 14 days (from ${todayStr} to ${new Date(cutoffDate.getTime() - 1).toISOString().slice(0, 10)} inclusive)?

Use Google Search to find the accurate date. Return ONLY a JSON object with these fields:
{
  "name": "<festival or holiday name>",
  "date": "<YYYY-MM-DD>",
  "healthNote": "<one sentence, max 20 words: a practical health note for a PHC doctor, or empty string if none>"
}

If nothing falls within 14 days, return: { "name": "", "date": "", "healthNote": "" }
Never guess dates without searching. Return raw JSON only, no markdown.`;

  // Use Google Search grounding tool
  const geminiResult = await callGemini({
    userPrompt,
    temperature: 0.1,
    maxOutputTokens: 200,
    timeoutMs: 25000,
    modelOverride: model,
    tools: [{ googleSearch: {} }],
  });

  const durationMs = Date.now() - startMs;
  const groundingUsed = geminiResult.groundingUsed ?? false;

  if (!geminiResult.ok || !geminiResult.text) {
    console.log(
      `[WELCOME/FESTIVAL] model=${geminiResult.modelUsed} duration=${durationMs}ms ` +
        `success=false grounding=${groundingUsed} reason=ai_error`
    );
    const response: FestivalRouteResponse = {
      ok: false,
      groundingUsed,
      modelUsed: geminiResult.modelUsed,
      reason: "ai_error",
    };
    return NextResponse.json(response);
  }

  // Grounding gate: if Gemini answered without searching, reject
  if (!groundingUsed) {
    console.log(
      `[WELCOME/FESTIVAL] model=${geminiResult.modelUsed} duration=${durationMs}ms ` +
        `success=false grounding=false reason=grounding_unavailable`
    );
    const response: FestivalRouteResponse = {
      ok: false,
      groundingUsed: false,
      modelUsed: geminiResult.modelUsed,
      reason: "grounding_unavailable",
    };
    return NextResponse.json(response);
  }

  // Parse the JSON
  let parsed: { name?: string; date?: string; healthNote?: string } | null = null;
  try {
    const cleaned = geminiResult.text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.log(
      `[WELCOME/FESTIVAL] model=${geminiResult.modelUsed} duration=${durationMs}ms ` +
        `success=false grounding=${groundingUsed} reason=parse_error`
    );
    const response: FestivalRouteResponse = {
      ok: false,
      groundingUsed,
      modelUsed: geminiResult.modelUsed,
      reason: "parse_error",
    };
    return NextResponse.json(response);
  }

  // "Nothing found" case
  if (!parsed?.name || !parsed?.date) {
    console.log(
      `[WELCOME/FESTIVAL] model=${geminiResult.modelUsed} duration=${durationMs}ms ` +
        `success=false grounding=${groundingUsed} reason=not_found`
    );
    const response: FestivalRouteResponse = {
      ok: false,
      groundingUsed,
      modelUsed: geminiResult.modelUsed,
      reason: "not_found",
    };
    return NextResponse.json(response);
  }

  // Validate date: must parse and fall within [today, today+14d)
  const festivalDate = parseDate(parsed.date);
  const isValidDate = !isNaN(festivalDate.getTime());
  const isInRange = isValidDate && festivalDate >= todayDate && festivalDate < cutoffDate;

  if (!isInRange) {
    console.log(
      `[WELCOME/FESTIVAL] model=${geminiResult.modelUsed} duration=${durationMs}ms ` +
        `success=false grounding=${groundingUsed} reason=date_out_of_range ` +
        `returnedDate=${parsed.date}`
    );
    const response: FestivalRouteResponse = {
      ok: false,
      groundingUsed,
      modelUsed: geminiResult.modelUsed,
      reason: "date_out_of_range",
    };
    return NextResponse.json(response);
  }

  const daysAway = Math.round((festivalDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

  console.log(
    `[WELCOME/FESTIVAL] model=${geminiResult.modelUsed} duration=${durationMs}ms ` +
      `success=true grounding=${groundingUsed} festival="${parsed.name}" date=${parsed.date} daysAway=${daysAway}`
  );

  const response: FestivalRouteResponse = {
    ok: true,
    festival: {
      name: parsed.name,
      date: parsed.date,
      healthNote: parsed.healthNote || "",
      daysAway,
    },
    groundingUsed,
    modelUsed: geminiResult.modelUsed,
  };
  return NextResponse.json(response);
}
