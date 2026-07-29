import { useState } from "react";
import { ChevronRight } from "lucide-react";

export function FormSection({
  title,
  defaultOpen = true,
  accent,
  highlight,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  accent?: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`rounded-xl border bg-white ${highlight ? "border-2 border-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]" : "border-slate-200"}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span
          className={`text-[10px] font-bold uppercase tracking-widest ${highlight ? "text-rose-600" : (accent ?? "text-slate-400")}`}
        >
          {title}
        </span>
        <ChevronRight
          size={14}
          className={`text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}
