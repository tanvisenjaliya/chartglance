import { NextResponse } from "next/server";
import { getOpdQueue, getClinicFacility } from "@/lib/records";
import { callGemini } from "@/lib/ai/gemini-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Weather data fetched from Open-Meteo (no API key needed). */
interface WeatherData {
  temp: number;
  code: number;
  maxTemp: number;
  minTemp: number;
}

/** Shape of the JSON this route returns. */
export interface BriefingRouteResponse {
  ok: boolean;
  briefing?: {
    welcomeLine: string;
    weatherLine: string;
    seasonLine: string;
    queueGlimpse: string;
    modelUsed: string;
    generatedAt: string;
  };
  weather: WeatherData | null;
  doctor: string;
  facility: string;
  date: { iso: string; weekday: string; formatted: string };
  error?: string;
}

/** Fetches current weather + today's max/min from Open-Meteo for Anand, Gujarat. */
async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=22.56&longitude=72.95" +
      "&current=temperature_2m,weathercode" +
      "&daily=temperature_2m_max,temperature_2m_min" +
      "&timezone=Asia%2FKolkata" +
      "&forecast_days=1";

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.warn(`[WELCOME/BRIEFING] Open-Meteo returned HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    return {
      temp: data.current?.temperature_2m ?? 0,
      code: data.current?.weathercode ?? 0,
      maxTemp: data.daily?.temperature_2m_max?.[0] ?? 0,
      minTemp: data.daily?.temperature_2m_min?.[0] ?? 0,
    };
  } catch (err) {
    console.warn("[WELCOME/BRIEFING] Weather fetch failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Returns age-bucket label for a patient age string like "5y", "72y". */
function ageBucket(age: string | number): "infant" | "child" | "adult" | "senior" {
  const ageStr = String(age);
  const years = parseInt(ageStr, 10);
  if (isNaN(years)) return "adult";
  if (years < 2) return "infant";
  if (years < 15) return "child";
  if (years >= 60) return "senior";
  return "adult";
}

export async function GET() {
  const startMs = Date.now();

  // ── 1. Date/time in India ────────────────────────────────────────────────
  const now = new Date();
  const isoNow = now.toISOString();
  const indiaFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const indiaTimeFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const indiaHourFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
  });
  const weekdayFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
  });

  const formattedDate = indiaFormatter.format(now);
  const formattedTime = indiaTimeFormatter.format(now);
  const weekday = weekdayFormatter.format(now);
  const indiaHour = parseInt(indiaHourFormatter.format(now), 10);
  const timeOfDay =
    indiaHour >= 5 && indiaHour < 12
      ? "morning"
      : indiaHour >= 12 && indiaHour < 17
      ? "afternoon"
      : indiaHour >= 17 && indiaHour < 21
      ? "evening"
      : "night";

  // ── 2. Doctor + facility ─────────────────────────────────────────────────
  const DOCTOR_NAME = "Dr. Aditi Sharma";
  const facility = getClinicFacility();
  const facilityLabel = `${facility.facilityName}, ${facility.district}`;

  // ── 3. Weather (parallel with queue load) ───────────────────────────────
  const [weather] = await Promise.all([fetchWeather()]);

  // ── 4. Anonymised queue summary ──────────────────────────────────────────
  const queue = getOpdQueue();
  const summary = {
    total: queue.length,
    new: queue.filter((p) => p.visitType === "New Visit").length,
    followUp: queue.filter((p) => p.visitType === "Follow-up").length,
    emergency: queue.filter((p) => p.isEmergency || p.visitType === "Emergency").length,
    ageGroups: { infant: 0, child: 0, adult: 0, senior: 0 },
    sex: { M: 0, F: 0, O: 0 } as Record<string, number>,
    complaints: queue
      .map((p) => p.chiefComplaint || p.complaint || "")
      .filter(Boolean)
      .slice(0, 30), // cap to avoid huge prompts
  };
  for (const p of queue) {
    const bucket = ageBucket(p.age);
    summary.ageGroups[bucket] = (summary.ageGroups[bucket] || 0) + 1;
    const g = p.gender === "M" || p.gender === "Male" ? "M" : p.gender === "F" || p.gender === "Female" ? "F" : "O";
    summary.sex[g] = (summary.sex[g] || 0) + 1;
  }

  // ── 5. Build Gemini prompt ───────────────────────────────────────────────
  const weatherDesc = weather
    ? `${weather.temp}°C, WMO weather code ${weather.code}, today's high ${weather.maxTemp}°C / low ${weather.minTemp}°C`
    : "Weather data unavailable";

  const systemInstruction = `You are a helpful assistant for a PHC (Primary Health Centre) doctor in Anand, Gujarat, India.
Output ONLY valid JSON matching the given schema. No markdown, no explanation.

Field rules:
- welcomeLine: ≤ 20 words. Warm, professional. Reflects the ${timeOfDay} and weather. Address the doctor by name.
- weatherLine: exactly one sentence using ONLY the numbers provided. Never invent or guess weather values.
- seasonLine: ≤ 35 words. Name the current season in Anand and ONE practical health pattern PHC doctors typically see this season.
- queueGlimpse: 2–4 sentences, 50–70 words max. Factual summary of today's patient mix: complaint themes, follow-up vs new ratio, age groups (children/seniors/pregnancies/emergencies). No patient names, no ABHA numbers, no diagnoses, no medical advice.`;

  const userPrompt = `Date and time: ${formattedDate}, ${formattedTime} IST (${timeOfDay})
Doctor: ${DOCTOR_NAME}
Facility: ${facilityLabel}
Weather in Anand: ${weatherDesc}

Queue summary (${summary.total} patients):
  - New visits: ${summary.new}, Follow-ups: ${summary.followUp}, Emergencies: ${summary.emergency}
  - Age groups: ${summary.ageGroups.infant} infants (<2y), ${summary.ageGroups.child} children (2–14y), ${summary.ageGroups.adult} adults, ${summary.ageGroups.senior} seniors (60+y)
  - Sex: ${summary.sex.M || 0} male / ${summary.sex.F || 0} female / ${summary.sex.O || 0} other
  - Complaint text samples (no names): ${summary.complaints.join("; ")}`;

  const responseSchema = {
    type: "object",
    properties: {
      welcomeLine: { type: "string" },
      weatherLine: { type: "string" },
      seasonLine: { type: "string" },
      queueGlimpse: { type: "string" },
    },
    required: ["welcomeLine", "weatherLine", "seasonLine", "queueGlimpse"],
  };

  // ── 6. Call Gemini ───────────────────────────────────────────────────────
  const geminiResult = await callGemini({
    userPrompt,
    systemInstruction,
    responseMimeType: "application/json",
    temperature: 0.7,
    maxOutputTokens: 350,
    timeoutMs: 25000,
    responseSchema,
  });

  const durationMs = Date.now() - startMs;
  const success = geminiResult.ok;

  console.log(
    `[WELCOME/BRIEFING] model=${geminiResult.modelUsed} duration=${durationMs}ms ` +
      `success=${success} grounding=false` +
      (success ? "" : ` error=${geminiResult.error?.slice(0, 80)}`)
  );

  const dateInfo = {
    iso: isoNow,
    weekday,
    formatted: formattedDate,
  };

  if (!geminiResult.ok || !geminiResult.text) {
    const response: BriefingRouteResponse = {
      ok: false,
      weather,
      doctor: DOCTOR_NAME,
      facility: facilityLabel,
      date: dateInfo,
      error: geminiResult.error || "AI call failed",
    };
    return NextResponse.json(response);
  }

  let parsed: { welcomeLine: string; weatherLine: string; seasonLine: string; queueGlimpse: string } | null = null;
  try {
    const cleaned = geminiResult.text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("[WELCOME/BRIEFING] JSON parse failed");
    const response: BriefingRouteResponse = {
      ok: false,
      weather,
      doctor: DOCTOR_NAME,
      facility: facilityLabel,
      date: dateInfo,
      error: "Invalid JSON from AI",
    };
    return NextResponse.json(response);
  }

  const response: BriefingRouteResponse = {
    ok: true,
    briefing: {
      welcomeLine: parsed!.welcomeLine,
      weatherLine: parsed!.weatherLine,
      seasonLine: parsed!.seasonLine,
      queueGlimpse: parsed!.queueGlimpse,
      modelUsed: geminiResult.modelUsed,
      generatedAt: new Date().toISOString(),
    },
    weather,
    doctor: DOCTOR_NAME,
    facility: facilityLabel,
    date: dateInfo,
  };
  return NextResponse.json(response);
}
