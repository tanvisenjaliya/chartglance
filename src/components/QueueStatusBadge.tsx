interface QueueStatusBadgeProps {
  status: "Waiting" | "In consultation" | "Done";
  /** If true, renders a compact inline pill. Default is full-size badge. */
  compact?: boolean;
}

/**
 * Visual badge for a patient's queue lifecycle status.
 * Always pairs icon + text label — never colour alone (per SPEC §9).
 */
export default function QueueStatusBadge({
  status,
  compact = false,
}: QueueStatusBadgeProps) {
  const base = compact
    ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-wider font-semibold"
    : "inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-xs uppercase tracking-wider font-semibold";

  if (status === "Waiting") {
    return (
      <span
        className={`${base} border border-border bg-panel text-slate`}
        title="Patient is waiting to be seen"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate/60 shrink-0" />
        Waiting
      </span>
    );
  }

  if (status === "In consultation") {
    return (
      <span
        className={`${base} border border-amber-300 bg-amber-50 text-amber-800`}
        title="Patient is currently in consultation"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
        In consultation
      </span>
    );
  }

  // Done
  return (
    <span
      className={`${base} border border-border bg-surface text-navy-muted`}
      title="Consultation complete"
    >
      <svg
        className="w-3 h-3 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 13l4 4L19 7"
        />
      </svg>
      Done
    </span>
  );
}

