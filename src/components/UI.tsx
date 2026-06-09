import type { ReactNode } from "react";
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
  "On Hold": "border-rose-200/80 bg-rose-50 text-rose-700 ring-1 ring-rose-100",
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
    "from-white via-[#f7f9fb] to-[#eef2f6] text-slate-900 before:from-[#173a5c]",
  success:
    "from-[#f4fbf7] via-white to-[#e7f4ec] text-emerald-950 before:from-[#1f8a5b]",
  warning:
    "from-[#fcf8f0] via-white to-[#f6ebd9] text-amber-950 before:from-[#b7791f]",
  danger:
    "from-[#fdf5f5] via-white to-[#f8e3e3] text-rose-950 before:from-[#c24141]",
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

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
      className={cn(
        "overflow-hidden rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.96))] shadow-[0_16px_36px_rgba(15,23,42,0.06)]",
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
      <div className={cn("p-5 sm:p-6", contentClassName)}>{children}</div>
    </section>
  );
}

export function KPI({ label, value, helper, tone = "default" }: KPIProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-gradient-to-br p-5 shadow-[0_14px_32px_rgba(15,23,42,0.06)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:to-transparent",
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
      className={cn(
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
      className={cn(
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

type PageIntroProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children?: ReactNode;
};

type MetricCardProps = {
  label: string;
  value: ReactNode;
  helper?: string;
};

type PillTone = "neutral" | "brand" | "success" | "warning" | "danger";
type InlineAlertTone = "info" | "warning" | "danger";

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  children,
}: PageIntroProps) {
  return (
    <section className="relative -mx-4 overflow-hidden bg-[#0f2744] px-6 py-5 text-white shadow-[0_4px_24px_rgba(15,23,42,0.18)] sm:-mx-6">
      {/* Subtle radial accent */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.22),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(14,165,233,0.12),transparent_50%)]" />

      <div className="relative mx-auto flex w-full items-start justify-between gap-4">
        {/* Left — eyebrow + title + description */}
        <div className="flex min-w-0 items-start gap-4">
          <div className="mt-1 hidden h-9 w-0.5 flex-shrink-0 rounded-full bg-gradient-to-b from-sky-400 to-blue-600 sm:block" />
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-300/80">
                {eyebrow}
              </p>
            ) : null}
            <h2 className="mt-0.5 text-2xl font-bold tracking-tight text-white">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-300/90">
              {description}
            </p>
          </div>
        </div>

        {/* Right — actions */}
        {actions ? (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2.5">
            {actions}
          </div>
        ) : null}
      </div>

      {children ? (
        <div className="relative mt-5 w-full">{children}</div>
      ) : null}
    </section>
  );
}

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white/88 px-5 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] backdrop-blur dark:border-white/10 dark:bg-slate-950/40">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#10233f] dark:text-white">
        {value}
      </div>
      {helper ? (
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-300">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export function InlineAlert({
  title,
  message,
  tone = "danger",
  action,
}: {
  title: string;
  message: ReactNode;
  tone?: InlineAlertTone;
  action?: ReactNode;
}) {
  const toneMap: Record<InlineAlertTone, string> = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-rose-200 bg-rose-50 text-rose-900",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneMap[tone]}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <div className="mt-1 text-sm">{message}</div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function Pill({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: PillTone;
}) {
  const toneMap: Record<PillTone, string> = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    brand: "border-sky-200 bg-sky-50 text-sky-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
        toneMap[tone],
      )}
    >
      {text}
    </span>
  );
}

export function KeyValueRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-b-0 dark:border-white/10">
      <span className="text-sm text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-slate-800 dark:text-slate-100">
        {value || "-"}
      </span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/72 px-6 py-12 text-center shadow-[0_12px_24px_rgba(15,23,42,0.03)] dark:border-white/10 dark:bg-slate-950/30">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
        {description}
      </p>
    </div>
  );
}
