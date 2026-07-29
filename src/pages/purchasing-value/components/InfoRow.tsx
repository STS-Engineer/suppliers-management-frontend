export function InfoRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value?: string | null;
  valueClassName?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex gap-3 border-b border-slate-50 px-4 py-2 last:border-0 dark:border-white/[0.05]">
      <span className="w-36 shrink-0 pt-0.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <span
        className={`break-all text-sm ${valueClassName ?? "text-slate-700 dark:text-slate-200"}`}
      >
        {value}
      </span>
    </div>
  );
}
