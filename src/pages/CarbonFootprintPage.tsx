import { useEffect, useRef, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Leaf,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { InlineAlert, PageIntro } from "../components/UI";
import supplierAPI from "../services/supplierOnboardingAPI";
import type { CarbonFootprintRecord } from "../types/onboarding";

const PAGE_SIZE = 50;

// ── Formula engine ──────────────────────────────────────────────────────────
const PROD_SCORE: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
};

function norm(s?: string | null) {
  return (s ?? "").trim().toLowerCase();
}

function calcTransportImpact(
  origin?: string | null,
  siteLoc?: string | null,
  supCont?: string | null,
  siteCont?: string | null,
): number | null {
  if (!origin && !siteLoc && !supCont && !siteCont) return null;
  if (norm(origin) !== "" && norm(origin) === norm(siteLoc)) return 0;
  if (norm(supCont) !== "" && norm(supCont) === norm(siteCont)) return 1;
  return 2;
}

function calcGlobalFpImpact(
  prodGrade?: string | null,
  transport?: number | null,
  pond?: string | number | null,
): number | null {
  const score = PROD_SCORE[(prodGrade ?? "").toUpperCase()];
  if (score == null || transport == null || pond == null) return null;
  const pondNum = Number(pond);
  if (isNaN(pondNum)) return null;
  return Math.round((score + transport) * pondNum * 10) / 10;
}

function applyFormulas(d: DraftRow): DraftRow {
  const transport = calcTransportImpact(
    d.supplier_origin,
    d.site_location,
    d.supplier_continent,
    d.site_continent,
  );
  const global_fp = calcGlobalFpImpact(
    d.production_fp_grade,
    transport,
    d.weighted_footprint,
  );
  return { ...d, transport_impact: transport, global_fp_impact: global_fp };
}

// ── Types ────────────────────────────────────────────────────────────────────
interface DraftRow {
  year: string;
  purchase_amount: string;
  weighted_footprint: string;
  production_fp_grade: string;
  carbon_fp_grade: string;
  supplier_origin: string;
  supplier_continent: string;
  site_location: string;
  site_continent: string;
  transport_impact: number | null;
  global_fp_impact: number | null;
}

const EMPTY_DRAFT: DraftRow = {
  year: "",
  purchase_amount: "",
  weighted_footprint: "",
  production_fp_grade: "",
  carbon_fp_grade: "",
  supplier_origin: "",
  supplier_continent: "",
  site_location: "",
  site_continent: "",
  transport_impact: null,
  global_fp_impact: null,
};

function recordToDraft(r: CarbonFootprintRecord): DraftRow {
  return applyFormulas({
    year: r.year != null ? String(r.year) : "",
    purchase_amount: r.purchase_amount != null ? String(r.purchase_amount) : "",
    weighted_footprint:
      r.weighted_footprint != null ? String(r.weighted_footprint) : "",
    production_fp_grade: r.production_fp_grade ?? "",
    carbon_fp_grade: r.carbon_fp_grade ?? "",
    supplier_origin: r.supplier_origin ?? "",
    supplier_continent: r.supplier_continent ?? "",
    site_location: r.site_location ?? "",
    site_continent: r.site_continent ?? "",
    transport_impact: null,
    global_fp_impact: null,
  });
}

function draftToPayload(d: DraftRow) {
  return {
    year: d.year ? parseInt(d.year) : null,
    purchase_amount: d.purchase_amount ? parseFloat(d.purchase_amount) : null,
    weighted_footprint: d.weighted_footprint
      ? parseFloat(d.weighted_footprint)
      : null,
    production_fp_grade: d.production_fp_grade || null,
    carbon_fp_grade: d.carbon_fp_grade || null,
    supplier_origin: d.supplier_origin || null,
    supplier_continent: d.supplier_continent || null,
    site_location: d.site_location || null,
    site_continent: d.site_continent || null,
    transport_impact: d.transport_impact,
    global_fp_impact: d.global_fp_impact,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────
const GRADE_COLOR: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-700",
  B: "bg-sky-100 text-sky-700 ring-1 ring-sky-300 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-700",
  C: "bg-amber-100 text-amber-700 ring-1 ring-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-700",
  D: "bg-red-100 text-red-700 ring-1 ring-red-300 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-700",
  E: "bg-purple-100 text-purple-700 ring-1 ring-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:ring-purple-700",
  F: "bg-pink-100 text-pink-700 ring-1 ring-pink-300 dark:bg-pink-900/30 dark:text-pink-300 dark:ring-pink-700",
  G: "bg-rose-100 text-rose-800 ring-1 ring-rose-300 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-700",
};

function GradeBadge({ grade }: { grade?: string | null }) {
  if (!grade)
    return <span className="text-slate-300 dark:text-slate-600">—</span>;
  const cls =
    GRADE_COLOR[grade.toUpperCase()] ??
    "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${cls}`}
    >
      {grade.toUpperCase()}
    </span>
  );
}

function fmt(v?: number | null, decimals = 2): string {
  if (v == null) return "—";
  return Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

const inputCls =
  "h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/[0.1] dark:bg-[#0d1929] dark:text-slate-200";

const filterInputCls =
  "h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500";

const GRADE_OPTIONS = ["", "A", "B", "C", "D", "E", "F", "G"];

function GradeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    >
      <option value="">—</option>
      {GRADE_OPTIONS.filter(Boolean).map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </select>
  );
}

// Calculated field chip
function CalcChip({ value, label }: { value: number | null; label: string }) {
  if (value == null)
    return (
      <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:ring-violet-700">
      <span className="text-[9px] uppercase tracking-widest text-violet-400">
        {label}
      </span>
      {value}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CarbonFootprintPage() {
  const [records, setRecords] = useState<CarbonFootprintRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Filters
  const [yearInput, setYearInput] = useState("");
  const [continentInput, setContinentInput] = useState("");
  const [gradeInput, setGradeInput] = useState("");
  const [originInput, setOriginInput] = useState("");
  const [siteInput, setSiteInput] = useState("");
  const [unitInput, setUnitInput] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<{
    year?: number;
    continent?: string;
    grade?: string;
    origin?: string;
    site?: string;
    unit?: string;
  }>({});

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftRow>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  // Add new drawer
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<DraftRow>({ ...EMPTY_DRAFT });
  const [addSaving, setAddSaving] = useState(false);

  // Unit selection state for the add drawer
  const [groupSearch, setGroupSearch] = useState("");
  const [groups, setGroups] = useState<{ id_group: number; nom: string }[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<{
    id_group: number;
    nom: string;
  } | null>(null);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [units, setUnits] = useState<
    {
      id_supplier_unit: number;
      supplier_code: string;
      country?: string | null;
      continent?: string | null;
    }[]
  >([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const groupSearchRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasActiveFilters = Object.values(appliedFilters).some(Boolean);

  // Auto-apply formulas whenever draft fields change
  function updateDraft(patch: Partial<DraftRow>) {
    setDraft((prev) => applyFormulas({ ...prev, ...patch }));
  }

  function updateAddDraft(patch: Partial<DraftRow>) {
    setAddDraft((prev) => applyFormulas({ ...prev, ...patch }));
  }

  async function loadGroups(query: string) {
    setGroupsLoading(true);
    try {
      const res = await supplierAPI.listSupplierGroups(0, 200);
      const all = res?.data?.items ?? [];
      const q = query.trim().toLowerCase();
      setGroups(
        q
          ? all.filter((g: { nom: string }) => g.nom.toLowerCase().includes(q))
          : all,
      );
    } catch {
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  }

  async function loadUnitsForGroup(groupId: number) {
    setUnitsLoading(true);
    setUnits([]);
    setSelectedUnitId(null);
    try {
      const res = (await supplierAPI.listUnitsForGroup(groupId)) as any;
      const items = res?.data?.items ?? res?.data ?? res?.items ?? [];
      setUnits(items);
    } catch {
      setUnits([]);
    } finally {
      setUnitsLoading(false);
    }
  }

  function selectUnit(unitId: number) {
    setSelectedUnitId(unitId);
    const unit = units.find((u) => u.id_supplier_unit === unitId);
    if (unit) {
      updateAddDraft({
        supplier_origin: unit.country ?? addDraft.supplier_origin,
        supplier_continent: unit.continent ?? addDraft.supplier_continent,
      });
    }
  }

  function resetAddDrawer() {
    setShowAdd(false);
    setAddDraft({ ...EMPTY_DRAFT });
    setGroupSearch("");
    setGroups([]);
    setSelectedGroup(null);
    setShowGroupDropdown(false);
    setUnits([]);
    setSelectedUnitId(null);
  }

  async function fetchData(p: number, filters: typeof appliedFilters) {
    setLoading(true);
    setError(null);
    try {
      const result = await supplierAPI.listCarbonFootprints({
        skip: p * PAGE_SIZE,
        limit: PAGE_SIZE,
        year: filters.year,
        continent: filters.continent,
        origin: filters.origin,
        site_location: filters.site,
        supplier_unit_code: filters.unit,
      });
      let items = result.items;
      if (filters.grade) {
        items = items.filter(
          (r) =>
            r.carbon_fp_grade?.toUpperCase() === filters.grade?.toUpperCase(),
        );
      }
      setRecords(items);
      setTotal(result.total);
      setTotalAll(result.total_all ?? result.total);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Failed to load carbon footprint data",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(page, appliedFilters);
  }, [page, appliedFilters]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        groupSearchRef.current &&
        !groupSearchRef.current.contains(e.target as Node)
      ) {
        setShowGroupDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function applyFilters() {
    setPage(0);
    setAppliedFilters({
      year: yearInput ? parseInt(yearInput) : undefined,
      continent: continentInput || undefined,
      grade: gradeInput || undefined,
      origin: originInput || undefined,
      site: siteInput || undefined,
      unit: unitInput || undefined,
    });
  }

  function clearFilters() {
    setYearInput("");
    setContinentInput("");
    setGradeInput("");
    setOriginInput("");
    setSiteInput("");
    setUnitInput("");
    setPage(0);
    setAppliedFilters({});
  }

  function startEdit(r: CarbonFootprintRecord) {
    setEditingId(r.id_carbon_footprint);
    setDraft(recordToDraft(r));
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  async function saveEdit(r: CarbonFootprintRecord) {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await supplierAPI.updateCarbonFootprint(
        r.id_carbon_footprint,
        draftToPayload(draft),
      );
      setRecords((prev) =>
        prev.map((rec) =>
          rec.id_carbon_footprint === r.id_carbon_footprint
            ? { ...rec, ...updated }
            : rec,
        ),
      );
      setEditingId(null);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveNew() {
    if (!selectedUnitId) {
      setSaveError("Please select a supplier unit before saving.");
      return;
    }
    setAddSaving(true);
    setSaveError(null);
    try {
      const payload = {
        ...draftToPayload(addDraft),
        id_supplier_unit: selectedUnitId,
      };
      const created = await supplierAPI.createCarbonFootprint(payload);
      const selectedUnit = units.find(
        (u) => u.id_supplier_unit === selectedUnitId,
      );
      setRecords((prev) => [
        {
          ...created,
          supplier_unit_code: selectedUnit?.supplier_code ?? null,
        },
        ...prev,
      ]);
      setTotal((t) => t + 1);
      resetAddDrawer();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setAddSaving(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-160px)] flex-col gap-6">
      <PageIntro
        eyebrow="Carbon Footprint (SB8)"
        title="Carbon Footprint Tracking"
        description="Supplier carbon footprint data per entity, plant and year — sourced from Monday.com SB8 board. Edit rows inline or add new records."
        actions={
          <button
            onClick={() => {
              setShowAdd(true);
              setSaveError(null);
              setGroupSearch("");
              setSelectedGroup(null);
              setUnits([]);
              setSelectedUnitId(null);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 active:scale-95"
          >
            <Plus size={14} />
            Add Record
          </button>
        }
      />

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-white/[0.06] dark:bg-[#0a1628]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 dark:border-white/[0.06]">
          <Filter size={13} className="text-slate-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Filters
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <X size={11} /> Clear all
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Supplier Unit
            </label>
            <input
              value={unitInput}
              onChange={(e) => setUnitInput(e.target.value)}
              placeholder="SAP code…"
              className={`${filterInputCls} w-36`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Year
            </label>
            <input
              type="number"
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              placeholder="2023"
              className={`${filterInputCls} w-24`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Carbon Grade
            </label>
            <select
              value={gradeInput}
              onChange={(e) => setGradeInput(e.target.value)}
              className={`${filterInputCls} w-28`}
            >
              <option value="">All grades</option>
              {["A", "B", "C", "D", "E", "F", "G"].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Origin
            </label>
            <input
              value={originInput}
              onChange={(e) => setOriginInput(e.target.value)}
              placeholder="e.g. France"
              className={`${filterInputCls} w-32`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Continent
            </label>
            <input
              value={continentInput}
              onChange={(e) => setContinentInput(e.target.value)}
              placeholder="e.g. Europe"
              className={`${filterInputCls} w-32`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Site Location
            </label>
            <input
              value={siteInput}
              onChange={(e) => setSiteInput(e.target.value)}
              placeholder="e.g. Paris"
              className={`${filterInputCls} w-32`}
            />
          </div>
          <button
            onClick={applyFilters}
            className="ml-auto flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95"
          >
            <Search size={13} /> Search
          </button>
        </div>
      </div>

      {error && (
        <InlineAlert
          title="Failed to load data"
          message={error}
          tone="danger"
        />
      )}
      {saveError && (
        <InlineAlert title="Save failed" message={saveError} tone="danger" />
      )}

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-white/[0.06] dark:bg-[#0a1628]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Leaf size={14} className="text-emerald-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Carbon Records
            </span>
            {hasActiveFilters && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                Filtered
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {loading && (
              <RefreshCw size={13} className="animate-spin text-blue-500" />
            )}
            <span className="text-xs font-medium text-slate-400">
              {(total ?? 0).toLocaleString()} record{total !== 1 ? "s" : ""}
              {totalAll > 0 && totalAll !== total && (
                <span className="ml-1 text-slate-300 dark:text-slate-600">
                  / {totalAll.toLocaleString()} in DB
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-white/[0.05] dark:bg-white/[0.02]">
                {[
                  "Supplier Unit",
                  "Year",
                  "Carbon Grade",
                  "Prod. Grade",
                  "Pamount (€)",
                  "Pond. FP",
                  "Trans. Imp.",
                  "Global FP Imp.",
                  "Origin",
                  "Sup. Continent",
                  "Site Location",
                  "Site Continent",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/[0.03]">
              {loading && records.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 13 }).map((_, j) => (
                      <td key={j} className="px-3 py-3">
                        <div
                          className="h-3 rounded-full bg-slate-100 dark:bg-white/[0.04]"
                          style={{ width: `${50 + ((j * 17) % 40)}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-20 text-center">
                    <div className="mx-auto flex flex-col items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 dark:bg-white/[0.05]">
                        <Search
                          size={22}
                          className="text-slate-300 dark:text-slate-600"
                        />
                      </div>
                      <p className="text-sm font-medium text-slate-500">
                        No records found
                      </p>
                      {hasActiveFilters && (
                        <button
                          onClick={clearFilters}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const isEditing = editingId === r.id_carbon_footprint;
                  if (isEditing) {
                    return (
                      <tr
                        key={r.id_carbon_footprint}
                        className="bg-blue-50/40 dark:bg-blue-900/10"
                      >
                        {/* Unit — read only */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-blue-100 dark:bg-blue-900/30">
                              <Pencil size={10} className="text-blue-500" />
                            </div>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {r.supplier_unit_code ?? `#${r.id_supplier_unit}`}
                            </span>
                          </div>
                        </td>
                        {/* Year */}
                        <td className="px-3 py-2 w-20">
                          <input
                            type="number"
                            value={draft.year}
                            onChange={(e) =>
                              updateDraft({ year: e.target.value })
                            }
                            className={inputCls}
                            placeholder="2023"
                          />
                        </td>
                        {/* Carbon grade */}
                        <td className="px-3 py-2 w-24">
                          <GradeSelect
                            value={draft.carbon_fp_grade}
                            onChange={(v) =>
                              updateDraft({ carbon_fp_grade: v })
                            }
                          />
                        </td>
                        {/* Prod grade */}
                        <td className="px-3 py-2 w-24">
                          <GradeSelect
                            value={draft.production_fp_grade}
                            onChange={(v) =>
                              updateDraft({ production_fp_grade: v })
                            }
                          />
                        </td>
                        {/* Purchase amount */}
                        <td className="px-3 py-2 w-28">
                          <input
                            type="number"
                            value={draft.purchase_amount}
                            onChange={(e) =>
                              updateDraft({ purchase_amount: e.target.value })
                            }
                            className={inputCls}
                            placeholder="0"
                          />
                        </td>
                        {/* Weighted FP */}
                        <td className="px-3 py-2 w-28">
                          <input
                            type="number"
                            step="0.0001"
                            value={draft.weighted_footprint}
                            onChange={(e) =>
                              updateDraft({
                                weighted_footprint: e.target.value,
                              })
                            }
                            className={inputCls}
                            placeholder="0.0000"
                          />
                        </td>
                        {/* Transport — calculated */}
                        <td className="px-3 py-2">
                          <CalcChip
                            value={draft.transport_impact}
                            label="calc"
                          />
                        </td>
                        {/* Global FP — calculated */}
                        <td className="px-3 py-2">
                          <CalcChip
                            value={draft.global_fp_impact}
                            label="calc"
                          />
                        </td>
                        {/* Origin */}
                        <td className="px-3 py-2 w-28">
                          <input
                            value={draft.supplier_origin}
                            onChange={(e) =>
                              updateDraft({ supplier_origin: e.target.value })
                            }
                            className={inputCls}
                            placeholder="Country"
                          />
                        </td>
                        {/* Sup continent */}
                        <td className="px-3 py-2 w-28">
                          <input
                            value={draft.supplier_continent}
                            onChange={(e) =>
                              updateDraft({
                                supplier_continent: e.target.value,
                              })
                            }
                            className={inputCls}
                            placeholder="Continent"
                          />
                        </td>
                        {/* Site location */}
                        <td className="px-3 py-2 w-28">
                          <input
                            value={draft.site_location}
                            onChange={(e) =>
                              updateDraft({ site_location: e.target.value })
                            }
                            className={inputCls}
                            placeholder="Location"
                          />
                        </td>
                        {/* Site continent */}
                        <td className="px-3 py-2 w-28">
                          <input
                            value={draft.site_continent}
                            onChange={(e) =>
                              updateDraft({ site_continent: e.target.value })
                            }
                            className={inputCls}
                            placeholder="Continent"
                          />
                        </td>
                        {/* Actions */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => saveEdit(r)}
                              disabled={saving}
                              className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              {saving ? (
                                <RefreshCw size={10} className="animate-spin" />
                              ) : (
                                <Save size={10} />
                              )}
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50 dark:border-white/[0.08] dark:hover:bg-white/[0.04]"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={r.id_carbon_footprint}
                      className="group transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.025]"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-emerald-50 dark:bg-emerald-900/20">
                            <Leaf
                              size={11}
                              className="text-emerald-600 dark:text-emerald-400"
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                              {r.supplier_unit_code ??
                                `Unit #${r.id_supplier_unit ?? "—"}`}
                            </p>
                            {r.supplier_unit_code && r.id_supplier_unit && (
                              <p className="text-[10px] text-slate-400">
                                ID {r.id_supplier_unit}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                          {r.year ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <GradeBadge grade={r.carbon_fp_grade} />
                      </td>
                      <td className="px-3 py-3">
                        <GradeBadge grade={r.production_fp_grade} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs text-slate-700 dark:text-slate-300">
                        {r.purchase_amount != null
                          ? `€${fmt(r.purchase_amount, 0)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs">
                        {r.weighted_footprint != null ? (
                          <span className="flex items-center justify-end gap-1 font-medium text-slate-700 dark:text-slate-300">
                            {Number(r.weighted_footprint) > 0 ? (
                              <TrendingUp size={10} className="text-red-400" />
                            ) : (
                              <TrendingDown
                                size={10}
                                className="text-emerald-500"
                              />
                            )}
                            {fmt(r.weighted_footprint, 4)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs text-slate-600 dark:text-slate-400">
                        {r.transport_impact != null
                          ? fmt(r.transport_impact, 4)
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs text-slate-600 dark:text-slate-400">
                        {r.global_fp_impact != null
                          ? fmt(r.global_fp_impact, 4)
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400">
                        {r.supplier_origin ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-500">
                        {r.supplier_continent ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400">
                        {r.site_location ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-500">
                        {r.site_continent ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => startEdit(r)}
                          className="invisible flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 group-hover:visible dark:border-white/[0.08] dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
                          title="Edit row"
                        >
                          <Pencil size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-white/[0.06]">
            <span className="text-xs font-medium text-slate-400">
              Page {page + 1} of {totalPages} — {(total ?? 0).toLocaleString()}{" "}
              records
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 dark:border-white/[0.08]"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const pg =
                  totalPages <= 7
                    ? i
                    : page < 4
                      ? i
                      : page > totalPages - 5
                        ? totalPages - 7 + i
                        : page - 3 + i;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={[
                      "flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition",
                      pg === page
                        ? "bg-blue-600 text-white shadow-sm"
                        : "border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-400",
                    ].join(" ")}
                  >
                    {pg + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 dark:border-white/[0.08]"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Grade legend */}
      {/* <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200/60 bg-white/60 px-5 py-3 text-xs dark:border-white/[0.04] dark:bg-white/[0.02]">
        <span className="font-bold uppercase tracking-widest text-slate-400">Grade:</span>
        {(["A","B","C","D","E","F","G"] as const).map((g, i) => (
          <span key={g} className="flex items-center gap-1.5 text-slate-500"><GradeBadge grade={g} />{["Excellent","Good","Average","Poor","Very Poor","Critical","Unacceptable"][i]}</span>
        ))}
        <span className="ml-auto flex items-center gap-1.5 text-slate-400">
          <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600 ring-1 ring-violet-200">calc</span>
          Auto-calculated field
        </span>
      </div> */}

      {/* Add record drawer */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={resetAddDrawer}
          />
          <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-[#0a1628] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                  <Plus size={15} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Add Carbon Footprint Record
                  </p>
                  <p className="text-xs text-slate-400">
                    Link to an existing supplier unit
                  </p>
                </div>
              </div>
              <button
                onClick={resetAddDrawer}
                className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
              >
                <X size={16} className="text-slate-400" />
              </button>
            </div>

            <div className="flex-1 space-y-5 px-6 py-5">
              {saveError && (
                <InlineAlert title="Error" message={saveError} tone="danger" />
              )}

              {/* Step 1 — Supplier group search */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                  <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-black text-white">
                    1
                  </span>
                  Supplier Group
                </label>
                <div className="relative" ref={groupSearchRef as any}>
                  <div className="relative">
                    <Building2
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={selectedGroup ? selectedGroup.nom : groupSearch}
                      onChange={(e) => {
                        if (selectedGroup) {
                          setSelectedGroup(null);
                          setUnits([]);
                          setSelectedUnitId(null);
                        }
                        setGroupSearch(e.target.value);
                        setShowGroupDropdown(true);
                        loadGroups(e.target.value);
                      }}
                      onFocus={() => {
                        if (!selectedGroup) {
                          setShowGroupDropdown(true);
                          loadGroups(groupSearch);
                        }
                      }}
                      placeholder="Type supplier name to search…"
                      className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500"
                    />
                    {selectedGroup && (
                      <button
                        onClick={() => {
                          setSelectedGroup(null);
                          setGroupSearch("");
                          setUnits([]);
                          setSelectedUnitId(null);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 hover:bg-slate-200 dark:hover:bg-white/10"
                      >
                        <X size={11} className="text-slate-400" />
                      </button>
                    )}
                  </div>
                  {showGroupDropdown && !selectedGroup && (
                    <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-white/[0.08] dark:bg-[#0d1929]">
                      {groupsLoading ? (
                        <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-400">
                          <RefreshCw size={11} className="animate-spin" />{" "}
                          Loading…
                        </div>
                      ) : groups.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-slate-400">
                          No groups found
                        </p>
                      ) : (
                        groups.map((g) => (
                          <button
                            key={g.id_group}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                            onClick={() => {
                              setSelectedGroup(g);
                              setGroupSearch("");
                              setShowGroupDropdown(false);
                              loadUnitsForGroup(g.id_group);
                            }}
                          >
                            <Building2
                              size={12}
                              className="shrink-0 text-slate-400"
                            />
                            <span className="text-slate-700 dark:text-slate-200">
                              {g.nom}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2 — Unit selector */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                  <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-black text-white">
                    2
                  </span>
                  Supplier Unit
                </label>
                {!selectedGroup ? (
                  <div className="flex h-9 items-center rounded-xl border border-dashed border-slate-200 px-3 text-xs text-slate-400 dark:border-white/[0.08]">
                    Select a supplier group first
                  </div>
                ) : unitsLoading ? (
                  <div className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs text-slate-400 dark:border-white/[0.08]">
                    <RefreshCw size={11} className="animate-spin" /> Loading
                    units…
                  </div>
                ) : units.length === 0 ? (
                  <div className="flex h-9 items-center rounded-xl border border-dashed border-slate-200 px-3 text-xs text-slate-400 dark:border-white/[0.08]">
                    No units found for this group
                  </div>
                ) : (
                  <select
                    value={selectedUnitId ?? ""}
                    onChange={(e) => selectUnit(Number(e.target.value))}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200"
                  >
                    <option value="">Select a unit…</option>
                    {units.map((u) => (
                      <option
                        key={u.id_supplier_unit}
                        value={u.id_supplier_unit}
                      >
                        {u.supplier_code}
                        {u.country ? ` — ${u.country}` : ""}
                      </option>
                    ))}
                  </select>
                )}
                {selectedUnitId &&
                  (() => {
                    const u = units.find(
                      (u) => u.id_supplier_unit === selectedUnitId,
                    );
                    return u ? (
                      <p className="mt-1 text-[10px] text-slate-400">
                        ID {u.id_supplier_unit} · {u.country ?? "—"} ·{" "}
                        {u.continent ?? "—"}
                      </p>
                    ) : null;
                  })()}
              </div>

              {/* Year */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                    Year
                  </label>
                  <input
                    type="number"
                    value={addDraft.year}
                    onChange={(e) => updateAddDraft({ year: e.target.value })}
                    placeholder="2024"
                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                    Carbon Grade
                  </label>
                  <select
                    value={addDraft.carbon_fp_grade}
                    onChange={(e) =>
                      updateAddDraft({ carbon_fp_grade: e.target.value })
                    }
                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-300 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200"
                  >
                    <option value="">Select…</option>
                    {["A", "B", "C", "D", "E", "F", "G"].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                    Prod. Grade
                  </label>
                  <select
                    value={addDraft.production_fp_grade}
                    onChange={(e) =>
                      updateAddDraft({ production_fp_grade: e.target.value })
                    }
                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-300 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200"
                  >
                    <option value="">Select…</option>
                    {["A", "B", "C", "D", "E", "F", "G"].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                    Purchase Amount (€)
                  </label>
                  <input
                    type="number"
                    value={addDraft.purchase_amount}
                    onChange={(e) =>
                      updateAddDraft({ purchase_amount: e.target.value })
                    }
                    placeholder="0"
                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                    Pond. FP (Weighted)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={addDraft.weighted_footprint}
                    onChange={(e) =>
                      updateAddDraft({ weighted_footprint: e.target.value })
                    }
                    placeholder="0.0000"
                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-white/[0.05] dark:bg-white/[0.02]">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Formula Inputs — Location
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">
                      Supplier Origin
                    </label>
                    <input
                      value={addDraft.supplier_origin}
                      onChange={(e) =>
                        updateAddDraft({ supplier_origin: e.target.value })
                      }
                      placeholder="Country"
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-300 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">
                      Supplier Continent
                    </label>
                    <input
                      value={addDraft.supplier_continent}
                      onChange={(e) =>
                        updateAddDraft({ supplier_continent: e.target.value })
                      }
                      placeholder="Continent"
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-300 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">
                      Site Location
                    </label>
                    <input
                      value={addDraft.site_location}
                      onChange={(e) =>
                        updateAddDraft({ site_location: e.target.value })
                      }
                      placeholder="Location"
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-300 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">
                      Site Continent
                    </label>
                    <input
                      value={addDraft.site_continent}
                      onChange={(e) =>
                        updateAddDraft({ site_continent: e.target.value })
                      }
                      placeholder="Continent"
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-300 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Live formula preview */}
              <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4 dark:border-violet-800/30 dark:bg-violet-900/10">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-violet-400">
                  Auto-Calculated Results
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1">
                      Transport Impact
                    </p>
                    <p className="text-lg font-bold text-violet-700 dark:text-violet-300">
                      {addDraft.transport_impact != null ? (
                        addDraft.transport_impact
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {addDraft.transport_impact === 0 && "Same country"}
                      {addDraft.transport_impact === 1 && "Same continent"}
                      {addDraft.transport_impact === 2 && "Different continent"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1">
                      Global FP Impact
                    </p>
                    <p className="text-lg font-bold text-violet-700 dark:text-violet-300">
                      {addDraft.global_fp_impact != null ? (
                        addDraft.global_fp_impact
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {addDraft.production_fp_grade &&
                      addDraft.weighted_footprint
                        ? `(${PROD_SCORE[addDraft.production_fp_grade.toUpperCase()] ?? "?"} + ${addDraft.transport_impact ?? "?"}) × ${addDraft.weighted_footprint}`
                        : "Fill Prod. Grade + Pond. FP"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 px-6 py-4 dark:border-white/[0.06]">
              <button
                onClick={saveNew}
                disabled={addSaving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {addSaving ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Create Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
