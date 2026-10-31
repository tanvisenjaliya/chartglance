"use client";

import { useState, useEffect } from "react";

/**
 * DemoModeBanner — shows current Demo Mode state and provides a toggle.
 * When Demo Mode is ON: all random delays and facility failures are disabled.
 */
export default function DemoModeBanner() {
  const [demoMode, setDemoMode] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetch("/api/demo-mode")
      .then((r) => r.json())
      .then((d) => setDemoMode(d.demoMode))
      .catch(() => setDemoMode(false));
  }, []);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await fetch("/api/demo-mode", { method: "PATCH" });
      if (res.ok) {
        const d = await res.json();
        setDemoMode(d.demoMode);
      }
    } finally {
      setToggling(false);
    }
  };

  // Don't render until state is known (avoids flicker)
  if (demoMode === null) return null;

  return (
    <div
      className={`w-full px-6 py-2 flex items-center justify-between text-xs transition-colors ${
        demoMode
          ? "bg-amber-50 border-b border-amber-200 text-amber-900"
          : "bg-panel border-b border-border text-slate"
      }`}
    >
      <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
        <div className="flex items-center gap-2">
          {demoMode ? (
            <>
              <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                DEMO MODE
              </span>
              <span className="text-amber-800 text-[11px]">
                Random delays &amp; facility failures are <strong>disabled</strong> — responses are instant and deterministic.
              </span>
            </>
          ) : (
            <>
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate">
                LIVE SIMULATION
              </span>
              <span className="text-[11px] text-slate">
                Realistic delays active — consent resolves in 20–90 s, records arrive facility by facility.
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={toggling}
          className={`shrink-0 flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-mono uppercase tracking-wider font-semibold transition-colors ${
            demoMode
              ? "border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200"
              : "border-border bg-surface text-slate hover:bg-border/60"
          } disabled:opacity-50`}
          aria-label="Toggle Demo Mode"
        >
          {/* Toggle switch visual */}
          <span
            className={`relative inline-flex items-center w-7 h-4 rounded-full transition-colors ${
              demoMode ? "bg-amber-500" : "bg-slate/30"
            }`}
          >
            <span
              className={`absolute w-3 h-3 rounded-full bg-white shadow transition-transform ${
                demoMode ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </span>
          {toggling ? "…" : demoMode ? "On" : "Off"}
        </button>
      </div>
    </div>
  );
}

