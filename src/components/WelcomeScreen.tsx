"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWelcome } from "@/lib/welcome-context";
import { getTodayKey } from "@/lib/client-storage";
import type { BriefingRouteResponse } from "@/app/api/welcome/briefing/route";
import type { FestivalRouteResponse } from "@/app/api/welcome/festival/route";

// ─── Types ──────────────────────────────────────────────────────────────────

type BriefingData = NonNullable<BriefingRouteResponse["briefing"]>;
type WeatherData = NonNullable<BriefingRouteResponse["weather"]>;
type FestivalData = NonNullable<FestivalRouteResponse["festival"]>;

// ─── Weather icon map (WMO codes) ────────────────────────────────────────────

function weatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌦️";
  if (code <= 99) return "⛈️";
  return "🌡️";
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

const LS_SHOWN_PREFIX = "chartglance_welcome_";
const LS_BRIEFING_PREFIX = "chartglance_welcome_briefing_";
const LS_FESTIVAL_PREFIX = "chartglance_welcome_festival_";

function lsGet(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string): void {
  try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
}
function lsRemove(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

function getCachedBriefing(dateKey: string): BriefingRouteResponse | null {
  const raw = lsGet(LS_BRIEFING_PREFIX + dateKey);
  if (!raw) return null;
  try { return JSON.parse(raw) as BriefingRouteResponse; } catch { return null; }
}
function setCachedBriefing(dateKey: string, data: BriefingRouteResponse): void {
  lsSet(LS_BRIEFING_PREFIX + dateKey, JSON.stringify(data));
}
function getCachedFestival(dateKey: string): FestivalRouteResponse | null {
  const raw = lsGet(LS_FESTIVAL_PREFIX + dateKey);
  if (!raw) return null;
  try { return JSON.parse(raw) as FestivalRouteResponse; } catch { return null; }
}
function setCachedFestival(dateKey: string, data: FestivalRouteResponse): void {
  lsSet(LS_FESTIVAL_PREFIX + dateKey, JSON.stringify(data));
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-white/10 ${className}`}
      aria-hidden="true"
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const router = useRouter();
  const { _register } = useWelcome();

  const [visible, setVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);

  // Briefing state
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [briefingError, setBriefingError] = useState(false);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [doctor, setDoctor] = useState("Dr. Aditi Sharma");
  const [facilityLine, setFacilityLine] = useState("");
  const [dateInfo, setDateInfo] = useState<{ weekday: string; formatted: string } | null>(null);

  // Festival state
  const [festivalLoading, setFestivalLoading] = useState(true);
  const [festival, setFestival] = useState<FestivalData | null>(null);

  // Typing animation
  const [typedGreeting, setTypedGreeting] = useState("");
  const [typingDone, setTypingDone] = useState(false);

  const dateKeyRef = useRef(getTodayKey());
  const fetchingRef = useRef(false);

  // ── Greeting computation ─────────────────────────────────────────────────
  const getGreeting = useCallback((name: string) => {
    const hour = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    ).getHours();
    const tod =
      hour >= 5 && hour < 12 ? "morning"
      : hour >= 12 && hour < 17 ? "afternoon"
      : hour >= 17 && hour < 21 ? "evening"
      : "night";
    return `Good ${tod}, ${name}`;
  }, []);

  // ── Data fetch ───────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (forceRefresh: boolean) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    const dateKey = dateKeyRef.current;

    // Check cache (unless forced)
    if (!forceRefresh) {
      const cachedB = getCachedBriefing(dateKey);
      const cachedF = getCachedFestival(dateKey);
      if (cachedB) {
        setBriefingLoading(false);
        if (cachedB.ok && cachedB.briefing) {
          setBriefing(cachedB.briefing);
          setBriefingError(false);
        } else {
          setBriefingError(true);
        }
        if (cachedB.weather) setWeather(cachedB.weather);
        if (cachedB.doctor) setDoctor(cachedB.doctor);
        if (cachedB.facility) setFacilityLine(cachedB.facility);
        if (cachedB.date) setDateInfo(cachedB.date);
      }
      if (cachedF) {
        setFestivalLoading(false);
        if (cachedF.ok && cachedF.festival) {
          setFestival(cachedF.festival);
        }
      }
      // If both are cached, we're done
      if (cachedB && cachedF) {
        fetchingRef.current = false;
        return;
      }
    } else {
      // Clear caches
      lsRemove(LS_BRIEFING_PREFIX + dateKey);
      lsRemove(LS_FESTIVAL_PREFIX + dateKey);
      setBriefingLoading(true);
      setBriefingError(false);
      setBriefing(null);
      setWeather(null);
      setFestivalLoading(true);
      setFestival(null);
    }

    // Fire both in parallel
    const [briefingRes, festivalRes] = await Promise.allSettled([
      fetch("/api/welcome/briefing").then((r) => r.json() as Promise<BriefingRouteResponse>),
      fetch("/api/welcome/festival").then((r) => r.json() as Promise<FestivalRouteResponse>),
    ]);

    // Handle briefing result
    if (briefingRes.status === "fulfilled") {
      const data = briefingRes.value;
      setCachedBriefing(dateKey, data);
      if (data.ok && data.briefing) {
        setBriefing(data.briefing);
        setBriefingError(false);
      } else {
        setBriefingError(true);
      }
      if (data.weather) setWeather(data.weather);
      if (data.doctor) setDoctor(data.doctor);
      if (data.facility) setFacilityLine(data.facility);
      if (data.date) setDateInfo(data.date);
    } else {
      setBriefingError(true);
    }
    setBriefingLoading(false);

    // Handle festival result
    if (festivalRes.status === "fulfilled") {
      const data = festivalRes.value;
      setCachedFestival(dateKey, data);
      if (data.ok && data.festival) {
        setFestival(data.festival);
      }
    }
    setFestivalLoading(false);

    fetchingRef.current = false;
  }, []);

  // ── Open handler (registered in context) ─────────────────────────────────
  const openScreen = useCallback((forceRefresh: boolean) => {
    setVisible(true);
    setIsFading(false);
    fetchAll(forceRefresh);
  }, [fetchAll]);

  useEffect(() => {
    _register(openScreen);
  }, [_register, openScreen]);

  // ── Typing animation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fullGreeting = getGreeting(doctor);
    if (rm) {
      setTypedGreeting(fullGreeting);
      setTypingDone(true);
      return;
    }
    setTypedGreeting("");
    setTypingDone(false);
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      setTypedGreeting(fullGreeting.slice(0, idx));
      if (idx >= fullGreeting.length) {
        clearInterval(interval);
        setTypingDone(true);
      }
    }, 42);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, doctor]);

  // ── Auto-show on mount (once per day) ────────────────────────────────────
  useEffect(() => {
    const shownToday = lsGet(LS_SHOWN_PREFIX + dateKeyRef.current) === "1";
    if (!shownToday) {
      setVisible(true);
      fetchAll(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Dismiss ───────────────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    lsSet(LS_SHOWN_PREFIX + dateKeyRef.current, "1");
    setIsFading(true);
    setTimeout(() => setVisible(false), 400);
    router.push("/");
  }, [router]);

  // ── Computed display values ───────────────────────────────────────────────
  const dateDisplay = (() => {
    if (dateInfo) {
      return `${dateInfo.weekday}, ${dateInfo.formatted.replace(/ \d{4}$/, "")}`;
    }
    const now = new Date();
    return now.toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long",
      timeZone: "Asia/Kolkata",
    });
  })();

  if (!visible) return null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className={`fixed inset-0 z-[9998] bg-[#12204A] flex flex-col overflow-y-auto transition-opacity duration-400 ease-out ${
        isFading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ fontFamily: "var(--font-inter, system-ui, sans-serif)" }}
    >
      {/* ── Centred content column ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-[40rem] space-y-6">

          {/* Logo mark */}
          <div className="flex justify-center">
            <svg
              viewBox="0 0 1024 1024"
              width="40"
              height="40"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect width="1024" height="1024" rx="220" fill="#12204A" />
              <path
                d="M704 320 A271 271 0 1 0 704 704"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="88"
                strokeLinecap="round"
              />
              <path
                d="M352 527 H432 L478 415 L543 640 L590 527 H720"
                fill="none"
                stroke="#6E95FF"
                strokeWidth="56"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="752" cy="528" r="48" fill="#E04646" />
            </svg>
          </div>

          {/* Greeting */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight min-h-[2.5rem]">
              {typedGreeting}
              {!typingDone && (
                <span
                  className="inline-block w-[2px] h-[1.1em] bg-[#6E95FF] ml-0.5 align-middle"
                  style={{ animation: "welcomeCursorBlink 0.9s step-end infinite" }}
                  aria-hidden="true"
                />
              )}
            </h1>
            <p className="mt-1 text-sm text-[#6E95FF] font-medium">
              {dateDisplay}
              {facilityLine ? ` · ${facilityLine}` : ""}
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10" />

          {/* Briefing lines */}
          <div className="space-y-3">
            {briefingLoading ? (
              <>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </>
            ) : briefingError ? (
              <div className="space-y-2">
                <p className="text-sm text-white/50">
                  Briefing unavailable ·{" "}
                  <button
                    onClick={() => fetchAll(true)}
                    className="text-[#6E95FF] underline hover:text-white transition-colors"
                  >
                    Retry
                  </button>
                </p>
                {weather && (
                  <p className="text-sm text-white/70">
                    {weatherIcon(weather.code)} {weather.temp}°C · High {weather.maxTemp}° / Low{" "}
                    {weather.minTemp}°
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* welcomeLine */}
                {briefing?.welcomeLine && (
                  <p className="text-base text-white leading-relaxed">{briefing.welcomeLine}</p>
                )}

                {/* weatherLine */}
                {briefing?.weatherLine && weather && (
                  <p className="text-sm text-white/80 leading-relaxed">
                    <span className="mr-1" aria-hidden="true">
                      {weatherIcon(weather.code)}
                    </span>
                    {briefing.weatherLine}
                  </p>
                )}

                {/* seasonLine */}
                {briefing?.seasonLine && (
                  <p className="text-sm text-white/70 leading-relaxed">{briefing.seasonLine}</p>
                )}
              </>
            )}

            {/* Festival line */}
            {festivalLoading && !briefingLoading && (
              <Skeleton className="h-4 w-2/3" />
            )}
            {!festivalLoading && festival && (
              <p className="text-sm font-medium" style={{ color: "#6E95FF" }}>
                <span className="mr-1" aria-hidden="true">🎉</span>
                {festival.name} in {festival.daysAway === 0 ? "today" : festival.daysAway === 1 ? "1 day" : `${festival.daysAway} days`}
                {festival.healthNote ? (
                  <span className="text-white/60 font-normal"> · {festival.healthNote}</span>
                ) : null}
              </p>
            )}
          </div>

          {/* Queue glimpse box */}
          <div
            className="rounded-xl border border-[#6E95FF]/30 px-4 py-3 space-y-1"
            style={{ background: "rgba(110,149,255,0.08)" }}
          >
            <p
              className="text-[11px] font-mono uppercase tracking-widest mb-2"
              style={{ color: "#6E95FF" }}
            >
              Today&apos;s Queue
            </p>
            {briefingLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-5/6" />
                <Skeleton className="h-3.5 w-4/6" />
              </div>
            ) : briefingError ? (
              <p className="text-sm text-white/50">
                Queue briefing unavailable ·{" "}
                <button
                  onClick={() => fetchAll(true)}
                  className="text-[#6E95FF] underline hover:text-white transition-colors"
                >
                  Retry
                </button>
              </p>
            ) : (
              <p className="text-sm text-white/80 leading-relaxed">
                {briefing?.queueGlimpse}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {/* AI tag + red dot */}
            <span className="flex items-center gap-1 text-[11px] text-white/40">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: "#E04646" }}
                aria-hidden="true"
              />
              AI-generated · verify before use
            </span>

            {briefing && (
              <span className="text-[11px] text-white/30">
                Generated by {briefing.modelUsed} at{" "}
                {new Date(briefing.generatedAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Kolkata",
                })}
              </span>
            )}

            <button
              onClick={() => {
                fetchingRef.current = false;
                fetchAll(true);
              }}
              className="text-[11px] text-[#6E95FF] underline hover:text-white transition-colors ml-auto"
            >
              Refresh briefing
            </button>
          </div>

          {/* CTA button */}
          <button
            onClick={dismiss}
            className="w-full py-3.5 rounded-xl text-base font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: "#6E95FF" }}
          >
            Start today&apos;s OPD →
          </button>
        </div>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes welcomeCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
