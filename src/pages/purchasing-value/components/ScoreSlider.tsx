export function ScoreSlider({
  label,
  letter,
  value,
  onChange,
}: {
  label: string;
  letter: string;
  value: number | "";
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-slate-600">
          {label} <span className="text-slate-400">({letter})</span>
        </label>
        <span className="text-xs font-bold text-blue-600 bg-blue-50 rounded px-1.5 py-0.5">
          {value || "—"} / 5
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value || 1}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-blue-600 h-1.5"
      />
      <div className="flex justify-between text-[9px] text-slate-300 mt-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
    </div>
  );
}
