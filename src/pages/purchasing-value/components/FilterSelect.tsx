export function FilterSelect({
  label,
  value,
  onChange,
  options,
  values,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  values?: string[];
}) {
  const isActive = value !== "All";
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`text-[10px] font-semibold ${isActive ? "text-blue-600" : "text-slate-400"}`}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`max-w-[160px] cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold outline-none focus:border-blue-400 ${isActive ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300" : "border-slate-200 bg-white text-slate-700 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-slate-300"}`}
      >
        {options.map((opt, i) => (
          <option key={opt} value={values ? values[i] : opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
