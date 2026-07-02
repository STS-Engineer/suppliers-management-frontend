import { useEffect, useState, useCallback, useRef } from "react";
import logoAvocarbon from "../assets/logo/logo-avocarbon.png";
import { API_URL } from "../services/supplierOnboardingAPI";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SiteOption { id_site: number; site_name: string; country?: string }

interface ContactEntry {
  full_name: string;
  role_label?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary_contact: boolean;
}

interface PlantEntry {
  id_relation: number;
  site_name: string;
  buyer_owner?: string | null;
  alias_1?: string | null;
  final_grade?: string | null;
  supplier_status?: string | null;
  supplier_scope?: string | null;
  last_evaluation_date?: string | null;
  annual_spend_value?: number | null;
  // 11 criteria
  lta?: string | null;
  quality_certification?: string | null;
  top?: string | null;
  productivity?: number | null;
  prod_lia_ins?: number | null;
  competitiveness?: number | null;
  sqma?: number | null;
  family_coverage?: number | null;
  geo_coverage?: number | null;
  cons_or_wd?: number | null;
  financial_health?: number | null;
  class_value?: number | null;
  class_score?: number | null;
  relation_contacts: ContactEntry[];
}

interface SupplierEntry {
  id_supplier_unit: number;
  supplier_name?: string | null;
  id_group?: number | null;
  group_name?: string | null;
  group_code?: string | null;
  group_owner_email?: string | null;
  city?: string | null;
  country?: string | null;
  continent?: string | null;
  area?: string | null;
  address_line?: string | null;
  website?: string | null;
  family?: string | null;
  sub_family?: string | null;
  product_line?: string | null;
  strategique: boolean;
  monopolistique: boolean;
  directed: boolean;
  plants: PlantEntry[];
  unit_contacts: ContactEntry[];
  group_contacts: ContactEntry[];
}

// ─── Criteria metadata ────────────────────────────────────────────────────────

const CRITERIA: { key: keyof PlantEntry; label: string }[] = [
  { key: "lta",                  label: "LTA"               },
  { key: "quality_certification",label: "Quality Cert."     },
  { key: "top",                  label: "T.O.P"             },
  { key: "productivity",         label: "Productivity"      },
  { key: "prod_lia_ins",         label: "Product Liability" },
  { key: "competitiveness",      label: "Competitiveness"   },
  { key: "sqma",                 label: "SQMA"              },
  { key: "family_coverage",      label: "Family Coverage"   },
  { key: "geo_coverage",         label: "Geo. Coverage"     },
  { key: "cons_or_wd",           label: "Consol. / WD"      },
  { key: "financial_health",     label: "Financial Health"  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GRADE_BG: Record<string, string> = {
  A1: "bg-emerald-500", A2: "bg-emerald-400",
  B1: "bg-sky-500",     B2: "bg-sky-400",     B3: "bg-blue-400",
  C1: "bg-amber-400",   C2: "bg-orange-400",
  D:  "bg-red-500",
};

function GradeBadge({ grade, size = "md" }: { grade?: string | null; size?: "sm" | "md" }) {
  if (!grade) return <span className="text-xs text-slate-400">—</span>;
  const bg = GRADE_BG[grade] ?? "bg-slate-400";
  const sz = size === "sm" ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-[11px]";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${bg} ${sz}`}>
      {grade}
    </span>
  );
}

function criteriaColor(val: number): string {
  if (val >= 80) return "text-emerald-600";
  if (val >= 60) return "text-sky-600";
  if (val >= 40) return "text-amber-600";
  return "text-red-500";
}

// ─── Multi-select dropdown ────────────────────────────────────────────────────

function MultiSelect({
  label, options, selected, onChange, placeholder = "All",
}: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));

  function toggle(val: string) {
    onChange(selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val]);
  }

  return (
    <div ref={ref} className="relative">
      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-left text-sm shadow-sm transition ${open ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300"}`}>
        <span className="truncate text-slate-700">
          {selected.length === 0 ? <span className="text-slate-400">{placeholder}</span>
            : selected.length === 1 ? selected[0]
            : <span>{selected.length} selected</span>}
        </span>
        <svg className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-[200px] rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-3 py-2">
            <input autoFocus type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm text-slate-700 outline-none placeholder-slate-400" />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0
              ? <p className="px-3 py-2 text-xs text-slate-400">No options</p>
              : filtered.map((opt) => (
                <label key={opt} className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50">
                  <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)}
                    className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-500" />
                  <span className="text-sm text-slate-700">{opt}</span>
                </label>
              ))}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-slate-100 px-3 py-1.5">
              <button type="button" onClick={() => onChange([])} className="text-xs font-semibold text-blue-500 hover:text-blue-600">Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Site multi-select ────────────────────────────────────────────────────────

function SiteMultiSelect({ sites, selected, onChange }: { sites: SiteOption[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = sites.filter((s) => s.site_name.toLowerCase().includes(search.toLowerCase()));

  function toggle(name: string) {
    onChange(selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name]);
  }

  return (
    <div ref={ref} className="relative">
      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Plant</p>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-left text-sm shadow-sm transition ${open ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300"}`}>
        <span className="truncate text-slate-700">
          {selected.length === 0 ? <span className="text-slate-400">All plants</span>
            : selected.length === 1 ? selected[0]
            : <span>{selected.length} plants</span>}
        </span>
        <svg className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-[220px] rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-3 py-2">
            <input autoFocus type="text" placeholder="Search plants…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm text-slate-700 outline-none placeholder-slate-400" />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.map((s) => (
              <label key={s.id_site} className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50">
                <input type="checkbox" checked={selected.includes(s.site_name)} onChange={() => toggle(s.site_name)}
                  className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-500" />
                <div>
                  <p className="text-sm text-slate-700">{s.site_name}</p>
                  {s.country && <p className="text-[11px] text-slate-400">{s.country}</p>}
                </div>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-slate-100 px-3 py-1.5">
              <button type="button" onClick={() => onChange([])} className="text-xs font-semibold text-blue-500 hover:text-blue-600">Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Contact card ─────────────────────────────────────────────────────────────

function ContactCard({ c, label }: { c: ContactEntry; label?: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
        {(c.full_name || "?")[0].toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-semibold text-slate-800 truncate">{c.full_name}</p>
          {c.is_primary_contact && (
            <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-600">Primary</span>
          )}
          {label && (
            <span className="shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
          )}
        </div>
        {c.role_label && <p className="text-xs text-slate-500">{c.role_label}</p>}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {c.email && (
            <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              {c.email}
            </a>
          )}
          {c.phone && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
              {c.phone}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Plant detail panel ───────────────────────────────────────────────────────

function CriteriaValue({ val }: { val: string }) {
  const tryNum = Number(val);
  if (!isNaN(tryNum) && val.trim() !== "") {
    const color = criteriaColor(tryNum);
    return <span className={`text-sm font-bold ${color}`}>{val}</span>;
  }
  return <span className="text-sm font-medium text-slate-700">{val}</span>;
}

function PlantDetail({ p }: { p: PlantEntry }) {
  const hasCriteria = CRITERIA.some((c) => p[c.key] != null);
  const half = Math.ceil(CRITERIA.length / 2);
  const left  = CRITERIA.slice(0, half);
  const right = CRITERIA.slice(half);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
          <div>
            <p className="font-semibold text-slate-800">{p.site_name}</p>
            {p.alias_1 && <p className="text-[11px] text-slate-400">"{p.alias_1}"</p>}
          </div>
          {p.supplier_scope && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-500">{p.supplier_scope}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {p.class_score != null && (
            <div className="text-right">
              <p className={`text-base font-black ${criteriaColor(p.class_score)}`}>{p.class_score.toFixed(1)}%</p>
              <p className="text-[9px] uppercase tracking-wider text-slate-400">Score</p>
            </div>
          )}
          <GradeBadge grade={p.final_grade} />
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-slate-100 px-4 py-3">
        {p.supplier_status && <MetaCell label="Status" value={p.supplier_status} />}
        {p.class_value != null && <MetaCell label="Class" value={`Class ${p.class_value}`} />}
        {p.last_evaluation_date && <MetaCell label="Last Evaluation" value={p.last_evaluation_date} />}
        {p.buyer_owner && <MetaCell label="Avocarbon Owner" value={p.buyer_owner} highlight />}
        {p.annual_spend_value != null && (
          <MetaCell label="Annual Spend" value={`${p.annual_spend_value.toLocaleString()}`} />
        )}
      </div>

      {/* 11 Criteria — 2-column table */}
      <div className="px-4 py-3">
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">11 Criteria</p>
        {hasCriteria ? (
          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            {[left, right].map((col, ci) => (
              <div key={ci} className="divide-y divide-slate-100">
                {col.map((c) => {
                  const val = p[c.key] as string | null | undefined;
                  return (
                    <div key={String(c.key)} className="flex items-center justify-between py-2">
                      <span className="text-xs text-slate-500">{c.label}</span>
                      {val != null
                        ? <CriteriaValue val={val} />
                        : <span className="text-xs text-slate-300">—</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No evaluation data for this plant.</p>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-t-lg px-4 py-2 text-xs font-bold transition ${active ? "border-b-2 border-blue-500 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}>
      {children}
    </button>
  );
}

function MetaCell({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      {value
        ? highlight
          ? <span className="mt-0.5 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">{value}</span>
          : <p className="mt-0.5 text-sm font-medium text-slate-700">{value}</p>
        : <p className="mt-0.5 text-sm text-slate-300">—</p>}
    </div>
  );
}

// ─── Supplier row (Unit view) ─────────────────────────────────────────────────

function SupplierRow({ s }: { s: SupplierEntry }) {
  const [open, setOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"plants" | "contacts" | "info">("plants");

  const tags = [
    s.strategique    && { label: "Strategic",    cls: "bg-violet-100 text-violet-600" },
    s.monopolistique && { label: "Monopolistic", cls: "bg-orange-100 text-orange-600" },
    s.directed       && { label: "Directed",     cls: "bg-rose-100 text-rose-600"     },
  ].filter(Boolean) as { label: string; cls: string }[];

  const allContacts = [
    ...s.unit_contacts.map((c) => ({ c, label: "Unit" })),
    ...s.group_contacts.map((c) => ({ c, label: "Group" })),
  ];
  const totalContacts = allContacts.length + s.plants.reduce((acc, p) => acc + p.relation_contacts.length, 0);

  return (
    <>
      <tr className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-blue-50/30 ${open ? "bg-blue-50/20" : ""}`}
        onClick={() => setOpen((v) => !v)}>
        {/* Supplier */}
        <td className="py-3 pl-4 pr-3">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-9 w-1 shrink-0 rounded-full"
              style={{ background: s.plants[0]?.final_grade?.startsWith("A") ? "linear-gradient(#10b981,#059669)" : s.plants[0]?.final_grade?.startsWith("B") ? "linear-gradient(#38bdf8,#0ea5e9)" : s.plants[0]?.final_grade?.startsWith("C") ? "linear-gradient(#fbbf24,#f59e0b)" : "#cbd5e1" }} />
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-semibold text-slate-900">{s.supplier_name ?? "—"}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                {s.group_name && <span className="text-[11px] text-slate-500">{s.group_name}</span>}
                {s.group_code && <span className="font-mono text-[10px] text-slate-300">{s.group_code}</span>}
              </div>
              {tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <span key={t.label} className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${t.cls}`}>{t.label}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </td>

        {/* Location */}
        <td className="px-3 py-3 text-sm text-slate-600">
          <p>{[s.city, s.country].filter(Boolean).join(", ") || "—"}</p>
          {s.continent && <p className="text-[11px] text-slate-400">{s.continent}</p>}
        </td>

        {/* Family */}
        <td className="px-3 py-3">
          <p className="text-sm font-medium text-slate-700">{s.family ?? "—"}</p>
          {s.sub_family && <p className="text-[11px] text-slate-400">{s.sub_family}</p>}
          {s.product_line && <p className="text-[11px] italic text-slate-400">{s.product_line}</p>}
        </td>

        {/* Plants */}
        <td className="px-3 py-3">
          <div className="flex flex-wrap gap-1.5">
            {s.plants.map((p) => (
              <span key={p.id_relation} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{p.site_name}
              </span>
            ))}
          </div>
        </td>

        {/* Grade */}
        <td className="px-3 py-3">
          <div className="flex flex-wrap gap-1">
            {s.plants.map((p) => <GradeBadge key={p.id_relation} grade={p.final_grade} size="sm" />)}
          </div>
        </td>

        {/* LTA */}
        <td className="px-3 py-3">
          {s.plants[0]?.lta
            ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">{s.plants[0].lta}</span>
            : <span className="text-slate-300">—</span>}
        </td>

        {/* Contacts count */}
        <td className="px-3 py-3">
          {totalContacts > 0
            ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">{totalContacts}</span>
            : <span className="text-slate-300">—</span>}
        </td>

        {/* Expand */}
        <td className="py-3 pr-4">
          <svg className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </td>
      </tr>

      {/* ── Expanded panel ─────────────────────────────────────────────── */}
      {open && (
        <tr className="bg-slate-50/30">
          <td colSpan={8} className="px-5 pb-6 pt-3">
            <div className="mb-3 flex gap-1 border-b border-slate-200">
              <TabButton active={detailTab === "plants"} onClick={() => setDetailTab("plants")}>
                Plants & Evaluation ({s.plants.length})
              </TabButton>
              <TabButton active={detailTab === "contacts"} onClick={() => setDetailTab("contacts")}>
                Contacts ({totalContacts})
              </TabButton>
              <TabButton active={detailTab === "info"} onClick={() => setDetailTab("info")}>
                Company Info
              </TabButton>
            </div>

            {/* Plants tab */}
            {detailTab === "plants" && (
              <div className="space-y-4">
                {s.plants.map((p) => <PlantDetail key={p.id_relation} p={p} />)}
              </div>
            )}

            {/* Contacts tab */}
            {detailTab === "contacts" && (
              <div className="space-y-4">
                {(s.group_owner_email || s.plants.some((p) => p.buyer_owner)) && (
                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Avocarbon Responsible</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {s.group_owner_email && (
                        <div className="flex items-center gap-2.5 rounded-xl border border-violet-100 bg-violet-50 p-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-200 text-sm font-bold text-violet-700">
                            {s.group_owner_email[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-wider text-violet-400">Group Owner</p>
                            <a href={`mailto:${s.group_owner_email}`} className="truncate text-xs font-semibold text-violet-700 hover:underline">{s.group_owner_email}</a>
                          </div>
                        </div>
                      )}
                      {s.plants.filter((p) => p.buyer_owner).map((p) => (
                        <div key={p.id_relation} className="flex items-center gap-2.5 rounded-xl border border-violet-100 bg-violet-50 p-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-200 text-sm font-bold text-violet-700">
                            {(p.buyer_owner || "?")[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-wider text-violet-400">{p.site_name} · Buyer Owner</p>
                            <p className="text-xs font-semibold text-violet-700">{p.buyer_owner}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {allContacts.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Supplier Contacts</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {allContacts.map(({ c, label }, i) => <ContactCard key={i} c={c} label={label} />)}
                    </div>
                  </div>
                )}

                {s.plants.some((p) => p.relation_contacts.length > 0) && (
                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Plant-Specific Contacts</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {s.plants.flatMap((p) =>
                        p.relation_contacts.map((c, i) => (
                          <ContactCard key={`${p.id_relation}-${i}`} c={c} label={p.site_name} />
                        ))
                      )}
                    </div>
                  </div>
                )}

                {totalContacts === 0 && (
                  <p className="text-sm text-slate-400">No contacts on record for this supplier.</p>
                )}
              </div>
            )}

            {/* Company info tab */}
            {detailTab === "info" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-4">
                  <InfoSection label="Identification">
                    <InfoRow k="Supplier Name" v={s.supplier_name} mono />
                    <InfoRow k="Group" v={s.group_name} />
                    <InfoRow k="Group Code" v={s.group_code} mono />
                  </InfoSection>
                  <InfoSection label="Location">
                    <InfoRow k="Address" v={s.address_line} />
                    <InfoRow k="City" v={s.city} />
                    <InfoRow k="Country" v={s.country} />
                    <InfoRow k="Continent" v={s.continent} />
                    <InfoRow k="Area" v={s.area} />
                  </InfoSection>
                  <InfoSection label="Contact & Web">
                    <InfoRow k="Website" v={s.website} link />
                  </InfoSection>
                </div>
                <div className="space-y-4">
                  <InfoSection label="Classification">
                    <InfoRow k="Family" v={s.family} />
                    <InfoRow k="Sub-Family" v={s.sub_family} />
                    <InfoRow k="Product Line" v={s.product_line} />
                  </InfoSection>
                  <InfoSection label="Strategic Attributes">
                    <BoolRow k="Strategic" v={s.strategique} />
                    <BoolRow k="Monopolistic" v={s.monopolistique} />
                    <BoolRow k="Directed" v={s.directed} />
                  </InfoSection>
                  <InfoSection label="Panel Relations">
                    {s.plants.map((p) => (
                      <div key={p.id_relation} className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs text-slate-600">{p.site_name}</span>
                        <GradeBadge grade={p.final_grade} size="sm" />
                      </div>
                    ))}
                  </InfoSection>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function InfoSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">{children}</div>
    </div>
  );
}

function InfoRow({ k, v, mono, link }: { k: string; v?: string | null; mono?: boolean; link?: boolean }) {
  if (!v) return null;
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2">
      <span className="shrink-0 text-xs text-slate-400">{k}</span>
      {link ? (
        <a href={v.startsWith("http") ? v : `mailto:${v}`} target="_blank" rel="noreferrer"
          className={`truncate text-xs font-medium text-blue-600 hover:underline ${mono ? "font-mono" : ""}`}>{v}</a>
      ) : (
        <span className={`truncate text-xs font-medium text-slate-700 ${mono ? "font-mono" : ""}`}>{v}</span>
      )}
    </div>
  );
}

function BoolRow({ k, v }: { k: string; v: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2">
      <span className="text-xs text-slate-400">{k}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${v ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>{v ? "Yes" : "No"}</span>
    </div>
  );
}

// ─── Group view ───────────────────────────────────────────────────────────────

interface GroupEntry {
  id_group: number;
  group_name: string;
  group_code: string;
  group_owner_email?: string | null;
  units: SupplierEntry[];
  contacts: ContactEntry[];
}

function GroupCard({ g }: { g: GroupEntry }) {
  const [open, setOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);

  const totalPlants = g.units.reduce((acc, u) => acc + u.plants.length, 0);
  const grades = g.units.flatMap((u) => u.plants.map((p) => p.final_grade)).filter(Boolean) as string[];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Group header */}
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-black text-white shadow-md">
          {(g.group_name || "?")[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-slate-900">{g.group_name}</p>
            {g.group_code && <span className="font-mono text-[11px] text-slate-400">{g.group_code}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{g.units.length} unit{g.units.length !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{totalPlants} plant{totalPlants !== 1 ? "s" : ""}</span>
            {g.group_owner_email && (
              <>
                <span>·</span>
                <span className="text-violet-600">{g.group_owner_email}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {grades.slice(0, 4).map((gr, i) => <GradeBadge key={i} grade={gr} size="sm" />)}
          {grades.length > 4 && <span className="text-xs text-slate-400">+{grades.length - 4}</span>}
          <svg className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Group contacts strip */}
      {open && g.contacts.length > 0 && (
        <div className="border-t border-slate-100 bg-violet-50/40 px-5 py-3">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Group Contacts</p>
          <div className="flex flex-wrap gap-2">
            {g.contacts.map((c, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-violet-100 bg-white px-3 py-1.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-200 text-[10px] font-bold text-violet-700">
                  {(c.full_name || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">{c.full_name}</p>
                  {c.role_label && <p className="text-[10px] text-slate-400">{c.role_label}</p>}
                </div>
                {c.email && (
                  <a href={`mailto:${c.email}`} className="ml-1 text-[10px] text-blue-500 hover:underline">{c.email}</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Units list */}
      {open && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {g.units.map((u) => {
            const isSel = selectedUnit === u.id_supplier_unit;
            return (
              <div key={u.id_supplier_unit}>
                <button type="button"
                  onClick={() => setSelectedUnit(isSel ? null : u.id_supplier_unit)}
                  className={`flex w-full items-start gap-4 px-5 py-3.5 text-left transition-colors hover:bg-blue-50/30 ${isSel ? "bg-blue-50/20" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-800">{u.group_name ?? u.supplier_name ?? "—"}</p>
                      {u.supplier_name && <span className="font-mono text-[11px] text-slate-400">{u.supplier_name}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[u.city, u.country].filter(Boolean).join(", ")}
                      {u.family && ` · ${u.family}`}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {u.plants.map((p) => (
                        <span key={p.id_relation} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{p.site_name}
                          <GradeBadge grade={p.final_grade} size="sm" />
                        </span>
                      ))}
                    </div>
                  </div>
                  <svg className={`mt-1 h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isSel ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isSel && (
                  <div className="space-y-3 border-t border-slate-100 bg-slate-50/40 px-5 py-4">
                    {u.plants.map((p) => <PlantDetail key={p.id_relation} p={p} />)}
                    {u.unit_contacts.length > 0 && (
                      <div>
                        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Unit Contacts</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {u.unit_contacts.map((c, i) => <ContactCard key={i} c={c} label="Unit" />)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
      {label}
      <button type="button" onClick={onRemove} className="ml-0.5 text-blue-500 hover:text-blue-700">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PublicDirectoryPage() {
  const [items, setItems]       = useState<SupplierEntry[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [sites, setSites]       = useState<SiteOption[]>([]);
  const [viewMode, setViewMode] = useState<"unit" | "group">("unit");

  const [familyOpts, setFamilyOpts]           = useState<string[]>([]);
  const [subFamilyOpts, setSubFamilyOpts]     = useState<string[]>([]);
  const [productLineOpts, setProductLineOpts] = useState<string[]>([]);

  const [q, setQ]                           = useState("");
  const [familySel, setFamilySel]           = useState<string[]>([]);
  const [subFamilySel, setSubFamilySel]     = useState<string[]>([]);
  const [productLineSel, setProductLineSel] = useState<string[]>([]);
  const [plantSel, setPlantSel]             = useState<string[]>([]);
  const [gradeSel, setGradeSel]             = useState<string[]>([]);
  const [country, setCountry]               = useState("");

  useEffect(() => {
    fetch(`${API_URL}/public/sites`)
      .then((r) => r.json())
      .then((j) => setSites(j.data ?? []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (q)                     params.set("q", q);
      if (familySel.length)      params.set("family", familySel.join(","));
      if (subFamilySel.length)   params.set("sub_family", subFamilySel.join(","));
      if (productLineSel.length) params.set("product_line", productLineSel.join(","));
      if (country)               params.set("country", country);
      if (plantSel.length)       params.set("plant", plantSel.join(","));
      if (gradeSel.length)       params.set("final_grade", gradeSel.join(","));
      params.set("limit", "300");

      const res  = await fetch(`${API_URL}/public/supplier-directory?${params.toString()}`);
      const json = await res.json();
      const loaded: SupplierEntry[] = json.data?.items ?? [];
      setItems(loaded);
      setTotal(json.data?.total ?? 0);

      if (!familySel.length && !subFamilySel.length && !productLineSel.length
          && !q && !country && !plantSel.length && !gradeSel.length) {
        const split = (v: string | null | undefined) =>
          (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
        setFamilyOpts([...new Set(loaded.flatMap((s) => split(s.family)))].sort());
        setSubFamilyOpts([...new Set(loaded.flatMap((s) => split(s.sub_family)))].sort());
        setProductLineOpts([...new Set(loaded.flatMap((s) => split(s.product_line)))].sort());
      }
    } catch {
      setError(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [q, familySel, subFamilySel, productLineSel, country, plantSel, gradeSel]);

  useEffect(() => {
    const t = setTimeout(fetchData, 280);
    return () => clearTimeout(t);
  }, [fetchData]);

  // ── Build group view from flat unit list ──────────────────────────────────
  const groups: GroupEntry[] = (() => {
    const map = new Map<number, GroupEntry>();
    for (const u of items) {
      const gid = u.id_group ?? -u.id_supplier_unit;
      if (!map.has(gid)) {
        map.set(gid, {
          id_group: gid,
          group_name: u.group_name ?? u.supplier_name ?? "—",
          group_code: u.group_code ?? "",
          group_owner_email: u.group_owner_email,
          units: [],
          contacts: u.group_contacts,
        });
      }
      map.get(gid)!.units.push(u);
    }
    return Array.from(map.values()).sort((a, b) => a.group_name.localeCompare(b.group_name));
  })();

  // ── Active filter chips ───────────────────────────────────────────────────
  const activeChips = [
    ...familySel.map((v)      => ({ label: `Family: ${v}`,       clear: () => setFamilySel((p)       => p.filter((x) => x !== v)) })),
    ...subFamilySel.map((v)   => ({ label: `Sub-Family: ${v}`,   clear: () => setSubFamilySel((p)    => p.filter((x) => x !== v)) })),
    ...productLineSel.map((v) => ({ label: `Product Line: ${v}`, clear: () => setProductLineSel((p)  => p.filter((x) => x !== v)) })),
    ...plantSel.map((v)       => ({ label: `Plant: ${v}`,        clear: () => setPlantSel((p)        => p.filter((x) => x !== v)) })),
    ...gradeSel.map((v)       => ({ label: `Grade: ${v}`,        clear: () => setGradeSel((p)        => p.filter((x) => x !== v)) })),
    ...(country ? [{ label: `Country: ${country}`, clear: () => setCountry("") }] : []),
    ...(q       ? [{ label: `"${q}"`,              clear: () => setQ("")        }] : []),
  ];

  const clearAll = () => {
    setQ(""); setFamilySel([]); setSubFamilySel([]); setProductLineSel([]);
    setPlantSel([]); setGradeSel([]); setCountry("");
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg,#f0f5fb 0%,#e8f0f8 50%,#f4f7fc 100%)" }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header style={{ background: "linear-gradient(120deg,#0f2744 0%,#1a3a60 60%,#0e3057 100%)" }}>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                <img src={logoAvocarbon} alt="Avocarbon" className="h-7 w-7 object-contain" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-300/70">Avocarbon</p>
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Supplier Directory</h1>
                <p className="mt-0.5 text-sm text-slate-400">Approved panel · Active suppliers · Full evaluation data</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-4 py-1.5 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />Approved Panel
              </span>
              {!loading && (
                <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white/70">
                  {total} supplier{total !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">

        {/* ── Filter panel ──────────────────────────────────────────────── */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <div className="sm:col-span-2 xl:col-span-2">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Search</p>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Supplier name or code…" value={q} onChange={(e) => setQ(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>
            <SiteMultiSelect sites={sites} selected={plantSel} onChange={setPlantSel} />
            <MultiSelect label="Family" options={familyOpts} selected={familySel} onChange={setFamilySel} placeholder="All families" />
            <MultiSelect label="Sub-Family" options={subFamilyOpts} selected={subFamilySel} onChange={setSubFamilySel} placeholder="All" />
            <MultiSelect label="Product Line" options={productLineOpts} selected={productLineSel} onChange={setProductLineSel} placeholder="All" />
            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Country</p>
              <input type="text" placeholder="e.g. Morocco" value={country} onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>
            <MultiSelect label="Grade" options={["A1","A2","B1","B2","B3","C1","C2","D"]} selected={gradeSel} onChange={setGradeSel} placeholder="All grades" />
          </div>
          {activeChips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              {activeChips.map((c) => <FilterChip key={c.label} label={c.label} onRemove={c.clear} />)}
              <button type="button" onClick={clearAll} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Clear all</button>
            </div>
          )}
        </div>

        {/* ── View toggle ───────────────────────────────────────────────── */}
        <div className="mb-4 flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {(["unit", "group"] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => setViewMode(mode)}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${viewMode === mode ? "bg-blue-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {mode === "unit" ? "By Supplier Unit" : "By Group"}
              </button>
            ))}
          </div>
          {!loading && (
            <span className="text-xs text-slate-400">
              {viewMode === "group" ? `${groups.length} group${groups.length !== 1 ? "s" : ""}` : `${total} unit${total !== 1 ? "s" : ""}`}
            </span>
          )}
        </div>

        {/* ── Content ───────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-white shadow-sm" />)}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 py-12 text-center">
            <p className="font-semibold text-red-600">Could not load directory.</p>
            <button onClick={fetchData} className="mt-1 text-sm text-red-500 underline">Retry</button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-400">No suppliers found</p>
            {activeChips.length > 0 && (
              <button onClick={clearAll} className="mt-1 text-xs text-blue-500 hover:underline">Clear filters</button>
            )}
          </div>
        ) : viewMode === "unit" ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {["Supplier", "Location", "Classification", "Plants", "Grade", "LTA", "Contacts", ""].map((h) => (
                      <th key={h} className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 first:pl-4 last:pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => <SupplierRow key={s.id_supplier_unit} s={s} />)}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
              <p className="text-xs text-slate-400">{total} supplier unit{total !== 1 ? "s" : ""} · Click any row to expand full evaluation &amp; contacts</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => <GroupCard key={g.id_group} g={g} />)}
            <p className="mt-2 text-center text-xs text-slate-400">
              {groups.length} group{groups.length !== 1 ? "s" : ""} · {total} supplier unit{total !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white/60 py-5 text-center text-[11px] text-slate-400">
        Avocarbon · Approved Supplier Directory · For internal and authorized use only
      </footer>
    </div>
  );
}
