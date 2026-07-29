export function MetricCard({
  icon,
  label,
  value,
  sub,
  subClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  subClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-white/[0.07] dark:bg-white/[0.04]">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        {icon}
        {label}
      </div>
      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
        {value}
      </p>
      {sub && (
        <p
          className={`mt-0.5 text-[10px] ${subClassName ?? "text-slate-400 dark:text-slate-500"}`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
