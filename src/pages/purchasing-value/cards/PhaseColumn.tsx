import { CircleDot } from "lucide-react";
import type { Opp } from "../types";
import { PHASE_CONFIG } from "../constants";
import { OppCard } from "./OppCard";

export function PhaseColumn({
  phase,
  opps,
  onSelect,
  onRefresh,
  onDeleted,
  onDuplicated,
  userEmail,
  compact = false,
}: {
  phase: string;
  opps: Opp[];
  onSelect: (o: Opp) => void;
  onRefresh?: (o: Opp) => void;
  onDeleted?: (opportunityId: number) => void;
  onDuplicated?: (o: Opp) => void;
  userEmail?: string;
  compact?: boolean;
}) {
  const cfg = PHASE_CONFIG[phase] ?? { color: "text-slate-500", desc: "" };
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <CircleDot size={13} className={cfg.color} />
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100">
            {phase}
          </p>
          <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">
            {cfg.desc}
          </p>
        </div>
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">
          {opps.length}
        </span>
      </div>
      <div className="max-h-[calc(100vh-280px)] overflow-y-auto space-y-1.5 pr-0.5 [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.200)_transparent] dark:[scrollbar-color:rgba(255,255,255,0.1)_transparent]">
        {opps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-[11px] text-slate-400 dark:border-white/[0.1] dark:text-slate-600">
            Empty
          </div>
        ) : (
          opps.map((o) => (
            <OppCard
              key={o.opportunity_id}
              opp={o}
              onClick={() => onSelect(o)}
              onRefresh={onRefresh}
              onDeleted={onDeleted}
              onDuplicated={onDuplicated}
              userEmail={userEmail}
              compact={compact}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------
