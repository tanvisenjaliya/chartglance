"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface RawErrorCause {
  code?: string | number;
  message?: string;
}

interface RawError {
  name: string;
  message: string;
  cause?: RawErrorCause;
}

interface ServerEnv {
  apiKeyPresent: boolean;
  apiKeyLength: number;
  geminiModel: string;
  geminiFallbackModel: string;
}

interface ServerRuntime {
  executionEnvironment: string;
  nodeVersion: string;
  platform: string;
  executedOnServer: boolean;
}

interface AiCheckResponse {
  ok: boolean;
  status: number;
  modelUsed: string;
  fallbackUsed: boolean;
  attempts: number;
  text: string | null;
  error: string | null;
  rawError: RawError | null;
  requestUrlMasked: string | null;
  serverEnv: ServerEnv;
  runtime: ServerRuntime;
  durationMs: number;
}

export default function AiCheckPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiCheckResponse | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const handleTestGemini = async () => {
    setLoading(true);
    setResult(null);
    setNetworkError(null);

    try {
      const res = await fetch("/api/dev/ai-check", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to contact /api/dev/ai-check";
      setNetworkError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-panel text-navy font-sans">
      {/* Top Header */}
      <header className="bg-navy text-surface border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dev"
              className="text-xs text-slate hover:text-surface flex items-center gap-1 transition-colors"
            >
              <span>&larr;</span> Dev Dashboard
            </Link>
            <span className="text-slate text-xs">&bull;</span>
            <span className="font-mono text-xs uppercase tracking-wider text-slate">
              GEMINI API INSPECTOR &bull; PHC NAVLI
            </span>
          </div>

          <span className="font-mono text-xs uppercase tracking-wider px-3 py-1 rounded-full border border-slate/40 text-slate bg-navy/60">
            AI HEALTH CHECK
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">
            Gemini API Connectivity &amp; Diagnostics
          </h1>
          <p className="text-sm text-navy-muted mt-1">
            Test server-side REST API connectivity, verify environment variable visibility, inspect masked request URLs, and view detailed root-cause diagnostics.
          </p>
        </div>

        {/* Server Runtime & Architecture Confirmation */}
        <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-blue font-semibold">
              Execution Architecture
            </span>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
              ✓ Server-Side Execution (API Route)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-panel/60 rounded-xl border border-border space-y-1">
              <span className="font-mono uppercase text-[10px] text-slate font-bold tracking-wider block">
                Server-Side Origin
              </span>
              <p className="text-navy font-medium">
                Runs via Next.js Route Handler: <code className="bg-panel px-1.5 py-0.5 rounded text-blue font-mono">/api/dev/ai-check</code>
              </p>
              <p className="text-[11px] text-navy-muted">
                The browser never contacts Google directly. The API key is kept secure on the server and never sent to client.
              </p>
            </div>

            <div className="p-3 bg-panel/60 rounded-xl border border-border space-y-1">
              <span className="font-mono uppercase text-[10px] text-slate font-bold tracking-wider block">
                Auth &amp; Network Delivery
              </span>
              <p className="text-navy font-medium">
                URL Query Parameter: <code className="bg-panel px-1.5 py-0.5 rounded text-blue font-mono font-semibold">?key=...</code>
              </p>
              <p className="text-[11px] text-navy-muted">
                Node.js default fetch (30s ping timeout, 45s analysis timeout) with automatic 429 &amp; 503 exponential backoff retries (2s &rarr; 4s &rarr; 8s).
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Action Card */}
        <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-blue font-semibold block">
                Live Connectivity Test
              </span>
              <h2 className="text-lg font-bold text-navy mt-0.5">
                Run Diagnostic Ping
              </h2>
              <p className="text-xs text-navy-muted">
                Executes a live call from the server to the Gemini API and inspects environment variables and underlying network errors.
              </p>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleTestGemini}
              className="px-6 py-2.5 rounded-xl bg-blue hover:bg-blue/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-mono text-xs uppercase tracking-wider font-semibold transition-all shadow-sm active:scale-[0.99] flex items-center gap-2"
            >
              {loading && (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {loading ? "Testing Gemini..." : "Test Gemini"}
            </button>
          </div>

          {/* Client-to-Server Network Error */}
          {networkError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <span>&times;</span> Could not reach Next.js server route
              </p>
              <p className="font-mono">{networkError}</p>
            </div>
          )}

          {/* Test Result Display */}
          {result && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Server Environment Inspection Panel */}
              <div className="p-4 bg-panel/70 rounded-xl border border-border space-y-3">
                <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-slate block">
                  Server Environment Variables (Seen by Node.js Server)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-2.5 bg-surface rounded-lg border border-border">
                    <span className="text-[10px] text-slate uppercase block">GEMINI_API_KEY</span>
                    <span className="font-bold flex items-center gap-1">
                      {result.serverEnv.apiKeyPresent ? (
                        <span className="text-emerald-700">Present ({result.serverEnv.apiKeyLength} chars)</span>
                      ) : (
                        <span className="text-red-600">Missing (Not set)</span>
                      )}
                    </span>
                  </div>

                  <div className="p-2.5 bg-surface rounded-lg border border-border">
                    <span className="text-[10px] text-slate uppercase block">GEMINI_MODEL</span>
                    <span className="font-bold text-navy">{result.serverEnv.geminiModel}</span>
                  </div>

                  <div className="p-2.5 bg-surface rounded-lg border border-border">
                    <span className="text-[10px] text-slate uppercase block">GEMINI_FALLBACK_MODEL</span>
                    <span className="font-bold text-navy">{result.serverEnv.geminiFallbackModel}</span>
                  </div>
                </div>

                <div className="text-[11px] text-navy-muted flex items-center gap-2 pt-1">
                  <span className="font-mono font-bold text-slate">Server Runtime:</span>
                  <span>
                    {result.runtime.executionEnvironment} ({result.runtime.nodeVersion} on {result.runtime.platform})
                  </span>
                </div>
              </div>

              {/* Formed Request URL (Key Masked) */}
              {result.requestUrlMasked && (
                <div className="p-3 bg-surface rounded-xl border border-border space-y-1 text-xs">
                  <span className="font-mono text-[10px] uppercase font-bold text-slate block">
                    Formed Request URL (API Key Masked)
                  </span>
                  <div className="p-2 bg-panel rounded font-mono text-[11px] text-blue break-all">
                    {result.requestUrlMasked}
                  </div>
                </div>
              )}

              {/* Status Banner */}
              <div
                className={`p-4 rounded-xl border space-y-3 ${
                  result.ok
                    ? "bg-emerald-50/50 border-emerald-200 text-emerald-900"
                    : "bg-amber-50/60 border-amber-200 text-amber-900"
                }`}
              >
                <div className="flex items-center justify-between border-b pb-2.5 border-current/10">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        result.ok ? "bg-emerald-600" : "bg-amber-600 animate-pulse"
                      }`}
                    />
                    <span className="font-mono text-xs font-bold uppercase tracking-wider">
                      {result.ok ? "Gemini API Responded Successfully" : "Gemini Request Failed"}
                    </span>
                  </div>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface/80 border border-current/20 font-semibold">
                    HTTP {result.status}
                  </span>
                </div>

                {/* Performance & Model Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2 bg-surface/80 rounded border border-current/10">
                    <span className="text-[10px] text-slate uppercase block">Model Used</span>
                    <span className="font-bold">{result.modelUsed || "None"}</span>
                  </div>

                  <div className="p-2 bg-surface/80 rounded border border-current/10">
                    <span className="text-[10px] text-slate uppercase block">Fallback Model</span>
                    <span className="font-bold">
                      {result.fallbackUsed ? "Activated" : "Not used"}
                    </span>
                  </div>

                  <div className="p-2 bg-surface/80 rounded border border-current/10">
                    <span className="text-[10px] text-slate uppercase block">Attempts</span>
                    <span className="font-bold">{result.attempts}</span>
                  </div>

                  <div className="p-2 bg-surface/80 rounded border border-current/10">
                    <span className="text-[10px] text-slate uppercase block">Duration</span>
                    <span className="font-bold">{result.durationMs} ms</span>
                  </div>
                </div>

                {/* Successful Response */}
                {result.ok && (
                  <div className="space-y-1 text-xs">
                    <span className="font-mono text-[10px] uppercase font-bold text-slate block">
                      Gemini Response Text
                    </span>
                    <div className="p-3 bg-surface rounded-lg border border-emerald-200 font-mono text-navy font-semibold">
                      {result.text || "(empty response)"}
                    </div>
                  </div>
                )}

                {/* High-level User Notice on Failure */}
                {!result.ok && (
                  <div className="space-y-1.5 text-xs">
                    <span className="font-mono text-[10px] uppercase font-bold text-amber-800 block">
                      User-Facing Notice (Shown on Summary Card)
                    </span>
                    <div className="p-3 bg-amber-100/70 rounded-lg border border-amber-300 font-semibold text-amber-900">
                      {result.error || "AI unavailable: Gemini analysis failed, try Re-analyse in a minute"}
                    </div>
                  </div>
                )}
              </div>

              {/* Detailed Underlying Error Diagnostics (Required for root-cause troubleshooting) */}
              {!result.ok && result.rawError && (
                <div className="p-4 bg-red-50/70 border border-red-200 rounded-xl space-y-2 text-xs">
                  <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-red-900 block">
                    Underlying Error Diagnostics (Root Cause)
                  </span>

                  <div className="space-y-2 font-mono text-[11px]">
                    <div className="p-2.5 bg-surface rounded-lg border border-red-200 space-y-1">
                      <div className="text-slate">
                        <strong className="text-red-900">Error Name:</strong> {result.rawError.name}
                      </div>
                      <div className="text-slate break-all">
                        <strong className="text-red-900">Error Message:</strong> {result.rawError.message}
                      </div>
                      {result.rawError.cause && (
                        <div className="pt-1.5 border-t border-red-100 space-y-0.5">
                          {result.rawError.cause.code && (
                            <div>
                              <strong className="text-red-900">Cause Code:</strong>{" "}
                              <span className="bg-red-100 px-1 py-0.5 rounded text-red-900 font-bold">
                                {result.rawError.cause.code}
                              </span>
                            </div>
                          )}
                          {result.rawError.cause.message && (
                            <div className="text-red-800 break-all">
                              <strong className="text-red-900">Cause Message:</strong>{" "}
                              {result.rawError.cause.message}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-red-700">
                    {result.rawError.cause?.code === "ENOTFOUND"
                      ? "Note: ENOTFOUND indicates outbound DNS resolution was blocked or host is unreachable from the current server process."
                      : "Note: The above underlying Node.js error details are logged and never expose your API key."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between text-xs">
          <Link
            href="/dev"
            className="text-navy-muted hover:text-navy font-mono text-xs uppercase tracking-wider flex items-center gap-1 transition-colors"
          >
            &larr; Back to Developer Dashboard
          </Link>
          <Link
            href="/"
            className="text-blue hover:underline font-mono text-xs uppercase tracking-wider flex items-center gap-1"
          >
            Open OPD Dashboard &rarr;
          </Link>
        </div>
      </main>
    </div>
  );
}
