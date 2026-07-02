import { useEffect, useState, useCallback, useRef } from "react";
import { supplierAPI } from "../services/supplierOnboardingAPI";

interface PlantRow {
  id_relation: number;
  site_name: string;
  final_grade: string | null;
  panel_decision: string | null;
}

interface UnitRow {
  id_supplier_unit: number;
  supplier_name: string | null;
  group_name: string | null;
  city: string | null;
  country: string | null;
  family: string | null;
  is_active: boolean;
  plants: PlantRow[];
}

const PANEL_DECISION_LABELS: Record<string, string> = {
  panel_add: "Panel — Approved",
  panel_add_exec_committee: "Panel — Committee Review",
  panel_add_committee_validated: "Panel — Committee Validated",
  panel_reject: "Rejected",
};

const PANEL_DECISION_COLORS: Record<string, string> = {
  panel_add: "bg-emerald-100 text-emerald-800",
  panel_add_exec_committee: "bg-amber-100 text-amber-800",
  panel_add_committee_validated: "bg-indigo-100 text-indigo-800",
  panel_reject: "bg-red-100 text-red-700",
};

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-1",
        checked ? "bg-sky-500" : "bg-slate-300",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200",
          checked ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

function PanelDecisionSelect({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const cls = value ? PANEL_DECISION_COLORS[value] ?? "bg-slate-100 text-slate-600" : "bg-slate-100 text-slate-400";
  return (
    <select
      disabled={disabled}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className={[
        "rounded-lg border-0 px-2 py-1 text-xs font-semibold outline-none focus:ring-1 focus:ring-sky-300 cursor-pointer",
        cls,
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <option value="">— no decision —</option>
      <option value="panel_add">Panel — Approved</option>
      <option value="panel_add_exec_committee">Panel — Committee Review</option>
      <option value="panel_reject">Rejected</option>
    </select>
  );
}

async function fetchAllUnits(_searchQ: string): Promise<UnitRow[]> {
  // Use the site panel (no filter) to get all units with their relation data.
  // The panel returns bundles of {site, relations:[{unit, group, relation}]}.
  const panelRes: any = await supplierAPI.listSitePanel({ limit: 500, include_inactive: true });
  const panelItems: any[] = panelRes?.data?.items ?? [];

  const unitMap = new Map<number, UnitRow>();

  for (const bundle of panelItems) {
    for (const rel of bundle.relations ?? []) {
      const unit = rel.unit;
      const relation = rel.relation;
      if (!unit) continue;

      const uid = unit.id_supplier_unit;
      if (!unitMap.has(uid)) {
        unitMap.set(uid, {
          id_supplier_unit: uid,
          supplier_name: unit.supplier_name ?? null,
          group_name: rel.group?.nom ?? null,
          city: unit.city ?? null,
          country: unit.country ?? null,
          family: unit.family ?? null,
          is_active: unit.is_active ?? true,
          plants: [],
        });
      }

      unitMap.get(uid)!.plants.push({
        id_relation: relation.id_relation,
        site_name: bundle.site?.site_name ?? "",
        final_grade: relation.final_grade ?? null,
        panel_decision: relation.panel_decision ?? null,
      });
    }
  }

  const results = Array.from(unitMap.values());
  results.sort((a, b) => (a.group_name ?? "").localeCompare(b.group_name ?? ""));
  return results;
}

export default function SupplierDirectoryAdminPage() {
  const [allUnits, setAllUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllUnits("");
      setAllUnits(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Client-side filter
  const units = q.trim()
    ? allUnits.filter((u) => {
        const ql = q.toLowerCase();
        return (
          (u.group_name ?? "").toLowerCase().includes(ql) ||
          (u.supplier_name ?? "").toLowerCase().includes(ql) ||
          (u.country ?? "").toLowerCase().includes(ql)
        );
      })
    : allUnits;

  useEffect(() => {
    clearTimeout(debounce.current);
  }, [q]);

  async function toggleActive(unit: UnitRow, value: boolean) {
    const key = `unit-${unit.id_supplier_unit}`;
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      await supplierAPI.updateSupplierUnit(unit.id_supplier_unit, { is_active: value });
      setAllUnits((prev) =>
        prev.map((u) =>
          u.id_supplier_unit === unit.id_supplier_unit ? { ...u, is_active: value } : u
        )
      );
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }

  async function updatePanelDecision(relationId: number, unitId: number, value: string) {
    const key = `rel-${relationId}`;
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      await supplierAPI.patchRelation(relationId, { panel_decision: value });
      setAllUnits((prev) =>
        prev.map((u) => {
          if (u.id_supplier_unit !== unitId) return u;
          return {
            ...u,
            plants: u.plants.map((p) =>
              p.id_relation === relationId ? { ...p, panel_decision: value } : p
            ),
          };
        })
      );
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }

  const total = allUnits.length;
  const activeCount = allUnits.filter((u) => u.is_active).length;
  const publishedCount = allUnits.filter((u) =>
    u.plants.some(
      (p) =>
        p.panel_decision === "panel_add" ||
        p.panel_decision === "panel_add_committee_validated",
    )
  ).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Supplier Directory Admin</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage supplier active status and their panel decision (controls visibility in
          the public directory).
        </p>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: "Total suppliers", value: total },
          { label: "Active", value: activeCount },
          {
            label: "Approved in Panel",
            value: publishedCount,
            note: "visible in public directory",
          },
        ].map(({ label, value, note }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
          >
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">{label}</p>
            {note && <p className="text-[11px] text-slate-400">{note}</p>}
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by supplier name, code or country…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Supplier
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Location
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Family
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Active
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Plants & Panel Decision
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : units.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  No suppliers found.
                </td>
              </tr>
            ) : (
              units.map((unit) => {
                const unitSaving = saving[`unit-${unit.id_supplier_unit}`];
                return (
                  <tr
                    key={unit.id_supplier_unit}
                    className={unit.is_active ? "" : "bg-slate-50 opacity-70"}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">
                        {unit.group_name ?? "—"}
                      </p>
                      {unit.supplier_name && (
                        <p className="font-mono text-[11px] text-slate-400">
                          {unit.supplier_name}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {[unit.city, unit.country].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{unit.family ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <Toggle
                        checked={unit.is_active}
                        onChange={(v) => toggleActive(unit, v)}
                        disabled={unitSaving}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1.5">
                        {unit.plants.length === 0 ? (
                          <span className="text-slate-400 text-xs">No plant relation</span>
                        ) : (
                          unit.plants.map((plant) => {
                            const relSaving = saving[`rel-${plant.id_relation}`];
                            return (
                              <div
                                key={plant.id_relation}
                                className="flex flex-wrap items-center gap-2"
                              >
                                <span className="text-xs text-slate-600 min-w-[120px]">
                                  {plant.site_name}
                                </span>
                                {plant.final_grade && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                    {plant.final_grade}
                                  </span>
                                )}
                                <PanelDecisionSelect
                                  value={plant.panel_decision}
                                  onChange={(v) =>
                                    updatePanelDecision(
                                      plant.id_relation,
                                      unit.id_supplier_unit,
                                      v
                                    )
                                  }
                                  disabled={relSaving}
                                />
                                {relSaving && (
                                  <span className="text-[11px] text-slate-400">
                                    Saving…
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Public directory shows only Active suppliers with a relation marked as
        &ldquo;Panel — Approved&rdquo;.
      </p>
    </div>
  );
}
