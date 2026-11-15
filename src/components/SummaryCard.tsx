"use client";

import { useState, useEffect } from "react";
import { AIAnalysisResult } from "@/lib/ai/gemini-analysis";

interface SummaryCardProps {
  analysis: AIAnalysisResult | null;
  loading: boolean;
  hasAbha: boolean;
  consentStatus: "NOT_REQUESTED" | "REQUESTED" | "GRANTED" | "DENIED" | "EXPIRED" | "REVOKED";
  consentExpiry?: string;
  hasRecords: boolean;
  onRefresh: () => void;
  onHighlightSource?: (sourceIds: string[]) => void;
  activeHighlightedIds?: string[];
}

export default function SummaryCard({
  analysis,
  loading,
  hasAbha,
  consentStatus,
  consentExpiry,
  hasRecords,
  onRefresh,
  onHighlightSource,
  activeHighlightedIds = [],
}: SummaryCardProps) {
  // Accordion state to expand reasoning/guidelines for flags
  const [expandedFlags, setExpandedFlags] = useState<Record<string, boolean>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!loading) {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(0);
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [loading]);

  const toggleFlag = (key: string) => {
    setExpandedFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSourceClick = (sourceIds?: string[]) => {
    if (sourceIds && sourceIds.length > 0 && onHighlightSource) {
      onHighlightSource(sourceIds);
    }
  };

  // State 1: No ABHA
  if (!hasAbha) {
    return (
      <aside className="sticky top-6 bg-surface rounded-2xl border border-border shadow-sm overflow-hidden p-6 text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-slate/10 flex items-center justify-center mx-auto text-slate text-lg font-bold">
          !
        </div>
        <h3 className="text-sm font-bold text-navy uppercase font-mono tracking-wider">
          No ABHA Linked
        </h3>
        <p className="text-xs text-navy-muted leading-relaxed">
          This patient was admitted under emergency intake without an ABHA identity.
          Clinical history summary is unavailable until an ABHA account is linked.
        </p>
      </aside>
    );
  }

  // State 2: Records Locked (No Consent, Denied, or Expired)
  if (consentStatus === "NOT_REQUESTED" || consentStatus === "DENIED" || consentStatus === "EXPIRED" || consentStatus === "REVOKED") {
    return (
      <aside className="sticky top-6 bg-surface rounded-2xl border border-border shadow-sm overflow-hidden p-6 text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-panel flex items-center justify-center mx-auto text-navy text-lg">
          <svg className="w-5 h-5 text-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-sm font-bold text-navy uppercase font-mono tracking-wider">
          Records Locked (No Active Consent)
        </h3>
        <p className="text-xs text-navy-muted leading-relaxed">
          {consentStatus === "DENIED"
            ? "Patient declined the ABDM consent request. Health records remain locked."
            : consentStatus === "EXPIRED"
            ? "Previous ABDM consent window has expired. Records are locked."
            : "Patient consent required to request federated health records and generate AI clinical summary."}
        </p>
      </aside>
    );
  }

  // State 3: Consent Pending
  if (consentStatus === "REQUESTED") {
    return (
      <aside className="sticky top-6 bg-surface rounded-2xl border border-amber-300 shadow-sm overflow-hidden p-6 text-center space-y-3 bg-amber-50/40">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto text-amber-600 animate-spin">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <h3 className="text-sm font-bold text-amber-900 uppercase font-mono tracking-wider">
          Consent Pending
        </h3>
        <p className="text-xs text-amber-800 leading-relaxed">
          Awaiting approval on the patient&apos;s phone (or simulated patient app). Records will automatically load upon approval.
        </p>
      </aside>
    );
  }

  // State 4: Analysing (Skeleton Loader)
  if (loading) {
    return (
      <aside className="sticky top-6 bg-surface rounded-2xl border border-border shadow-sm overflow-hidden animate-pulse">
        <div className="bg-navy px-5 py-3.5 border-b border-border flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-surface font-bold">
            10-Second Summary Card
          </span>
          <span className="text-[11px] font-mono text-blue-200 animate-pulse">
            Analysing records… ({elapsedSeconds} s)
          </span>
        </div>
        <div className="p-5 space-y-5">
          <div className="space-y-2">
            <div className="h-3 bg-slate/20 rounded w-1/4" />
            <div className="h-4 bg-slate/15 rounded w-full" />
            <div className="h-4 bg-slate/15 rounded w-5/6" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-red-200 rounded w-1/3" />
            <div className="h-10 bg-red-50 rounded-xl border border-red-200" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-amber-200 rounded w-1/3" />
            <div className="h-10 bg-amber-50 rounded-xl border border-amber-200" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-slate/20 rounded w-1/4" />
            <div className="h-6 bg-slate/10 rounded w-full" />
          </div>
        </div>
      </aside>
    );
  }

  // State 5: No Records Found
  if (!hasRecords && (!analysis || (analysis.redFlags.length === 0 && analysis.yellowFlags.length === 0 && analysis.trends.length === 0 && analysis.currentMedicines.length === 0))) {
    return (
      <aside className="sticky top-6 bg-surface rounded-2xl border border-border shadow-sm overflow-hidden p-6 text-center space-y-3">
        <h3 className="text-sm font-bold text-navy uppercase font-mono tracking-wider">
          No Prior Records Found
        </h3>
        <p className="text-xs text-navy-muted leading-relaxed">
          Consent is active, but zero clinical records were returned from linked facilities in the network.
        </p>
      </aside>
    );
  }

  if (!analysis) return null;

  // Compute remaining hours on consent
  let hoursRemaining = 24;
  if (consentExpiry || analysis.consentExpiry) {
    const expDate = new Date(consentExpiry || analysis.consentExpiry!);
    const diff = expDate.getTime() - Date.now();
    hoursRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60)));
  }

  return (
    <aside className="sticky top-6 bg-surface rounded-2xl border border-border shadow-md overflow-hidden flex flex-col max-h-[calc(100vh-4rem)]">
      {/* Top Header per Section 9 */}
      <div className="bg-navy px-5 py-3.5 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue" />
          <h2 className="font-mono text-xs uppercase tracking-wider text-surface font-bold">
            10-Second Summary Card
          </h2>
          {analysis.modelUsed && (
            <span className="font-mono text-[10px] text-blue-200 bg-white/10 px-2 py-0.5 rounded border border-white/10 truncate max-w-[150px]">
              {analysis.modelUsed}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="text-[11px] font-mono text-blue-200 hover:text-white uppercase tracking-wider flex items-center gap-1 transition-colors"
          title="Re-run AI clinical analysis against fresh records"
        >
          <span>&#x21bb;</span> Re-analyse
        </button>
      </div>

      {/* Fallback Notice if AI failed */}
      {analysis.aiFailed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center gap-2 shrink-0">
          <span className="font-bold text-amber-700">Notice:</span>
          <span>{analysis.failureNotice || "AI analysis failed. Showing deterministic safety rules."}</span>
        </div>
      )}

      {/* Scrollable Content Body in STRICT ORDER */}
      <div className="overflow-y-auto p-5 space-y-5 text-xs text-navy divide-y divide-border/60">
        {/* 1. SUMMARY */}
        <section className="space-y-1.5 pt-0">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-slate">
              SUMMARY
            </span>
            {analysis.summarySourceIds?.length > 0 && (
              <button
                type="button"
                onClick={() => handleSourceClick(analysis.summarySourceIds)}
                className="text-[10px] font-mono text-blue hover:underline"
              >
                {analysis.summarySourceIds.length} source{analysis.summarySourceIds.length === 1 ? "" : "s"} &rarr;
              </button>
            )}
          </div>
          <p className="text-xs leading-relaxed text-navy font-medium">
            {analysis.summary}
          </p>
        </section>

        {/* 2. RED FLAGS (Red Alert Style) */}
        {analysis.redFlags.length > 0 && (
          <section className="space-y-2 pt-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-brand-red flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-red animate-pulse" />
                RED FLAGS ({analysis.redFlags.length})
              </span>
              <span className="text-[10px] text-slate font-mono uppercase">Immediate Attention</span>
            </div>

            <div className="space-y-2">
              {analysis.redFlags.map((flag, idx) => {
                const key = `red-${idx}`;
                const isExpanded = Boolean(expandedFlags[key]);
                const isHighlighted = flag.sourceIds.some((id) => activeHighlightedIds.includes(id));

                return (
                  <div
                    key={key}
                    className={`rounded-xl border p-3 transition-all ${
                      isHighlighted
                        ? "bg-red-100 border-brand-red ring-2 ring-brand-red shadow-sm"
                        : "bg-[#FDE8EA] border-[#F8CED3] text-[#7A0F1C]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => toggleFlag(key)}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-[#7A0F1C]">
                            {flag.title}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                              flag.sourceLabel === "AI + rule"
                                ? "bg-red-200 text-red-900 border border-red-300"
                                : flag.sourceLabel === "Rule"
                                ? "bg-slate-200 text-slate-900 border border-slate-300"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {flag.sourceLabel}
                          </span>
                        </div>
                      </div>

                      {flag.sourceIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleSourceClick(flag.sourceIds)}
                          className="shrink-0 text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/70 border border-red-200 hover:bg-white text-red-800 font-semibold"
                          title="Highlight source record"
                        >
                          View source &rarr;
                        </button>
                      )}
                    </div>

                    {/* Reasoning and Guideline Dropdown */}
                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-red-200/80 text-[11px] space-y-1.5 animate-in fade-in">
                        {flag.reasoning && (
                          <p className="text-navy-muted leading-relaxed">
                            {flag.reasoning}
                          </p>
                        )}
                        {flag.guideline && (
                          <div className="text-[10px] font-mono text-red-900 flex items-center gap-1">
                            <span className="font-bold">Guideline:</span>
                            <span>{flag.guideline}</span>
                          </div>
                        )}
                        <div className="text-[10px] font-mono text-slate">
                          Source IDs: {flag.sourceIds.join(", ")}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. YELLOW FLAGS (Amber Attention Style) */}
        {analysis.yellowFlags.length > 0 && (
          <section className="space-y-2 pt-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-[#B45309] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#B45309]" />
                YELLOW FLAGS ({analysis.yellowFlags.length})
              </span>
              <span className="text-[10px] text-slate font-mono uppercase">Check At Visit</span>
            </div>

            <div className="space-y-2">
              {analysis.yellowFlags.map((flag, idx) => {
                const key = `yellow-${idx}`;
                const isExpanded = Boolean(expandedFlags[key]);
                const isHighlighted = flag.sourceIds.some((id) => activeHighlightedIds.includes(id));

                return (
                  <div
                    key={key}
                    className={`rounded-xl border p-3 transition-all ${
                      isHighlighted
                        ? "bg-amber-100 border-amber-500 ring-2 ring-amber-400 shadow-sm"
                        : "bg-[#FEF3E2] border-[#F6D9A8] text-[#7C2D12]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => toggleFlag(key)}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-[#7C2D12]">
                            {flag.title}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            {flag.sourceLabel}
                          </span>
                        </div>
                      </div>

                      {flag.sourceIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleSourceClick(flag.sourceIds)}
                          className="shrink-0 text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/70 border border-amber-200 hover:bg-white text-amber-900 font-semibold"
                          title="Highlight source record"
                        >
                          View source &rarr;
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-amber-200/80 text-[11px] space-y-1.5 animate-in fade-in">
                        {flag.reasoning && (
                          <p className="text-navy-muted leading-relaxed">
                            {flag.reasoning}
                          </p>
                        )}
                        {flag.guideline && (
                          <div className="text-[10px] font-mono text-amber-900 flex items-center gap-1">
                            <span className="font-bold">Guideline:</span>
                            <span>{flag.guideline}</span>
                          </div>
                        )}
                        <div className="text-[10px] font-mono text-slate">
                          Source IDs: {flag.sourceIds.join(", ")}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 4. TRENDS */}
        {analysis.trends.length > 0 && (
          <section className="space-y-2 pt-4">
            <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-slate block">
              TRENDS
            </span>
            <div className="space-y-1.5">
              {analysis.trends.map((t, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSourceClick(t.sourceIds)}
                  className="p-2.5 rounded-xl border border-border bg-panel/40 hover:bg-panel transition-colors cursor-pointer flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-navy">{t.parameter}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-blue font-bold">{t.trend}</span>
                    <span className="text-[10px] font-mono text-slate">&rarr;</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. CURRENT MEDS */}
        <section className="space-y-2 pt-4">
          <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-slate block">
            CURRENT MEDS
          </span>
          {analysis.currentMedicines.length > 0 &&
          analysis.currentMedicines[0].name !== "No current medicines on record" ? (
            <div className="space-y-1.5">
              {analysis.currentMedicines.map((med, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSourceClick(med.sourceIds)}
                  className="p-2 rounded-lg border border-border bg-surface hover:bg-panel/40 cursor-pointer flex items-center justify-between text-xs"
                >
                  <span className="font-medium text-navy">{med.name}</span>
                  {med.sourceIds?.length > 0 && (
                    <span className="text-[10px] font-mono text-slate">
                      {med.sourceIds.length} ref{med.sourceIds.length === 1 ? "" : "s"} &rarr;
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate italic p-2 rounded-lg border border-dashed border-border/80 bg-panel/30">
              No current medicines on record
            </p>
          )}
        </section>

        {/* 6. MISSING (Dashed Border per Section 9) */}
        {analysis.missingInformation.length > 0 && (
          <section className="space-y-2 pt-4">
            <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-slate block">
              MISSING / GAPS
            </span>
            <div className="p-3 rounded-xl border-2 border-dashed border-[#9AAACF] bg-white space-y-1.5">
              {analysis.missingInformation.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-[#3B4A6B]">
                  <span className="text-slate">&bull;</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 7. ASK THE PATIENT */}
        {analysis.askThePatient.length > 0 && (
          <section className="space-y-2 pt-4">
            <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-blue block">
              ASK THE PATIENT
            </span>
            <div className="space-y-2">
              {analysis.askThePatient.map((question, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl border border-blue/20 bg-blue/5 text-xs text-navy flex items-start gap-2 font-medium"
                >
                  <span className="font-bold text-blue font-mono">Q{idx + 1}:</span>
                  <span>{question}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 8. FOOTER */}
      <footer className="mt-auto px-5 py-3 border-t border-border bg-panel/60 text-[11px] text-slate space-y-1 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Sources: {analysis.facilitiesUsed.join(", ") || "PHC Navli (demo)"}
            {analysis.modelUsed && ` · Model: ${analysis.modelUsed}`}
          </span>
          <span className="font-mono text-navy font-semibold">
            Consent: {hoursRemaining}h remaining
          </span>
        </div>
        <p className="text-[10px] text-navy-muted italic">
          AI-assisted analysis: verify against source records before clinical decisions.
        </p>
      </footer>
    </aside>
  );
}
