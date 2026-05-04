import type { ReactNode } from "react";
import clsx from "clsx";
import type { SupplierClass, SupplierStatus } from "../data/mockData";

type SectionCardProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

type KPIProps = {
  label: string;
  value: string;
  helper: string;
  tone?: "default" | "success" | "warning" | "danger";
};

const statusClassMap: Record<SupplierStatus, string> = {
  Active:
    "border-emerald-200/80 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  "On Hold":
    "border-rose-200/80 bg-rose-50 text-rose-700 ring-1 ring-rose-100",
  Exit: "border-slate-200 bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  "Can Quote":
    "border-amber-200/80 bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  "Can Quote & Deliver":
    "border-emerald-200/80 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  "Business On Hold":
    "border-rose-200/80 bg-rose-50 text-rose-700 ring-1 ring-rose-100",
  "Pending Self-Assessment":
    "border-slate-200 bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  "Pending Committee":
    "border-amber-200/80 bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  "Pending COMEX":
    "border-amber-200/80 bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  "Under Qualification":
    "border-sky-200/80 bg-sky-50 text-sky-700 ring-1 ring-sky-100",
};

const classClassMap: Record<SupplierClass, string> = {
  A: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
  B: "border-sky-200/80 bg-sky-50 text-sky-700",
  C: "border-amber-200/80 bg-amber-50 text-amber-700",
  D: "border-rose-200/80 bg-rose-50 text-rose-700",
};

const kpiToneMap: Record<NonNullable<KPIProps["tone"]>, string> = {
  default:
    "from-white via-[#f8fbff] to-[#eef5ff] text-slate-900 before:from-[#0f2744]",
  success:
    "from-emerald-50 via-white to-emerald-100/70 text-emerald-950 before:from-emerald-500",
  warning:
    "from-amber-50 via-white to-amber-100/70 text-amber-950 before:from-amber-500",
  danger:
    "from-rose-50 via-white to-rose-100/70 text-rose-950 before:from-rose-500",
};

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
  contentClassName = "",
}: SectionCardProps) {
  return (
    <section
      className={clsx(
        "overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,255,0.94))] shadow-[0_24px_60px_rgba(15,23,42,0.08)]",
        "dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(10,18,30,0.84))]",
        className,
      )}
    >
      <div className="flex flex-col gap-4 border-b border-slate-200/70 px-5 py-5 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#10233f] dark:text-white sm:text-xl">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-300">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={clsx("p-5 sm:p-6", contentClassName)}>{children}</div>
    </section>
  );
}

export function KPI({ label, value, helper, tone = "default" }: KPIProps) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-[26px] border border-white/80 bg-gradient-to-br p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:to-transparent",
        "dark:border-white/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 dark:text-white",
        kpiToneMap[tone],
      )}
    >
      <div className="text-sm font-medium text-slate-500 dark:text-slate-300">
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
        {value}
      </div>
      <div className="mt-2 text-sm text-slate-500 dark:text-slate-300">
        {helper}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: SupplierStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
        statusClassMap[status],
      )}
    >
      {status}
    </span>
  );
}

export function ClassBadge({ value }: { value: SupplierClass }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
        classClassMap[value],
      )}
    >
      Class {value}
    </span>
  );
}

export function ProgressBar({
  value,
  label,
}: {
  value: number;
  label?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div aria-label={label ?? `Progress ${safeValue}%`} className="w-full">
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/80">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#22c55e_0%,#3b82f6_55%,#0f2744_100%)]"
          style={{ width: `${safeValue}%` }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={safeValue}
        />
      </div>
    </div>
  );
}
