/**
 * ValidityStatusBar — a 3-segment stacked bar for the actionable question
 * this page exists for: of the criterion entries that HAVE validity data on
 * record, how many are expired / expiring / valid?
 *
 * This used to be paired with a separate "Documentation coverage" meter
 * (how many of the ~5,872 possible criterion×relation entries even have
 * data at all — usually a huge, not-actionable number since most criteria
 * simply aren't tracked for every relation). That number raised more
 * questions than it answered without being something a buyer/quality
 * reviewer could act on, so it's gone — just a one-line note below explains
 * the scope instead of a whole second visual.
 *
 * Palette (validated — see dataviz skill):
 * `node validate_palette.js "#e11d48,#d97706,#059669" --mode light|dark` →
 * ALL CHECKS PASS, same three hex values in both modes.
 */

import { useState } from "react";

export interface StatusDistributionCounts {
  missing: number;
  expired: number;
  expiring: number;
  valid: number;
}

const VALIDITY_SEGMENTS: {
  key: "expired" | "expiring" | "valid";
  label: string;
  fill: string;
  /** Text color for a direct label painted on this fill, picked per segment
   * so contrast clears ~3:1+ for bold label-sized text (amber is too light
   * for white text at that size; the other two aren't). */
  ink: string;
}[] = [
  { key: "expired", label: "Expired", fill: "#e11d48", ink: "#ffffff" },
  { key: "expiring", label: "Expiring", fill: "#d97706", ink: "#0a0a0a" },
  { key: "valid", label: "Valid", fill: "#059669", ink: "#ffffff" },
];

export function StatusDistributionBar({
  counts,
  onSegmentClick,
}: {
  counts: StatusDistributionCounts;
  onSegmentClick?: (key: "expired" | "expiring") => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total =
    counts.missing + counts.expired + counts.expiring + counts.valid;
  const documented = counts.expired + counts.expiring + counts.valid;

  if (total === 0 || documented === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Validity status
        </p>
        <p className="text-[11px] text-slate-400">{documented} entries</p>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-400">
        {documented} of {total} criterion×relation entries have validity data
        on record — most criteria aren't tracked for every relation, so this
        is expected, not a gap.
      </p>

      <div className="mt-2.5 flex h-6 gap-[2px] overflow-hidden rounded-full">
        {VALIDITY_SEGMENTS.map((seg) => {
          const count = counts[seg.key];
          if (count === 0) return null;
          const pct = (count / documented) * 100;
          // Only place the label inside the segment if it comfortably fits
          // -- otherwise it lives in the legend + tooltip + table.
          const fitsLabel = pct >= 12;
          const clickable =
            (seg.key === "expired" || seg.key === "expiring") &&
            !!onSegmentClick;
          return (
            <button
              key={seg.key}
              type="button"
              disabled={!clickable}
              onClick={() =>
                clickable && onSegmentClick!(seg.key as "expired" | "expiring")
              }
              onMouseEnter={() => setHovered(seg.key)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(seg.key)}
              onBlur={() => setHovered(null)}
              style={{
                width: `${pct}%`,
                backgroundColor: seg.fill,
                color: seg.ink,
              }}
              className={`group relative flex min-w-[3px] items-center justify-center text-[10px] font-bold transition-[filter] ${
                clickable
                  ? "cursor-pointer hover:brightness-110"
                  : "cursor-default"
              }`}
              title={`${seg.label}: ${count} (${pct.toFixed(1)}%)`}
            >
              {fitsLabel && (
                <span className="truncate px-1">
                  {count} · {pct.toFixed(0)}%
                </span>
              )}
              {hovered === seg.key && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg dark:bg-slate-700"
                >
                  {seg.label}: {count} ({pct.toFixed(1)}%)
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {VALIDITY_SEGMENTS.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1.5 text-[11px]">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: seg.fill }}
            />
            <span className="text-slate-500 dark:text-slate-400">
              {seg.label}
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {counts[seg.key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
