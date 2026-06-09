/**
 * Supplier Group Management Page — grid of cards + slide-over detail/edit drawer
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Edit2,
  Globe,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  Sliders,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { SupplierManagement } from "../components/onboarding/SupplierManagement";
import { CreatableMultiSelect } from "../components/onboarding/FormElements";
import { InlineAlert, PageIntro } from "../components/UI";
import { supplierAPI } from "../services/supplierOnboardingAPI";
import type { SupplierGroupSummary } from "../types/onboarding";

const DEFAULT_CATEGORIES = [
  "Ferrites", "Chokes", "Wire coils", "Inductors", "Transformers",
  "Capacitors", "Resistors", "Diodes", "MOSFETs", "IGBTs",
  "Sensors", "Filters", "Connectors", "Switches", "Relays",
  "Motors", "PCB Assemblies", "Cables", "Coatings", "Laminates",
  "Electronics", "Magnetics", "Passive Components", "Electromechanical",
];

// ── design helpers ────────────────────────────────────────────────────────────

const SCOPE_STYLE: Record<string, string> = {
  global:    "bg-indigo-50 text-indigo-700 border-indigo-200",
  strategic: "bg-amber-50  text-amber-700  border-amber-200",
  local:     "bg-slate-100 text-slate-600  border-slate-200",
};

const FLAG_CFG = [
  { key: "strategique",    label: "Strategic",    cls: "bg-violet-50 text-violet-700 border-violet-200" },
  { key: "monopolistique", label: "Monopolistic",  cls: "bg-amber-50  text-amber-700  border-amber-200" },
  { key: "directed",       label: "Directed",     cls: "bg-sky-50    text-sky-700    border-sky-200" },
  { key: "multi_site",     label: "Multi-site",   cls: "bg-teal-50   text-teal-700   border-teal-200" },
  { key: "exit_supplier",  label: "Exit",         cls: "bg-rose-50   text-rose-700   border-rose-200" },
] as const;

const AVATAR_GRADIENTS = [
  "from-indigo-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-indigo-600",
  "from-cyan-500 to-sky-600",
  "from-fuchsia-500 to-violet-600",
];

function avatarGradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

function initials(name: string) {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
}


// ── GroupCard ─────────────────────────────────────────────────────────────────

function GroupCard({
  group,
  onClick,
}: {
  group: SupplierGroupSummary;
  onClick: () => void;
}) {
  const scopeKey = (group.supplier_scope ?? "").toLowerCase();

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_30px_rgba(15,23,42,0.10)]"
    >
      {/* Colour stripe */}
      <div className={`h-1 w-full bg-gradient-to-r ${avatarGradient(group.nom)}`} />

      <div className="flex flex-1 flex-col p-5">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm ${avatarGradient(group.nom)}`}>
            {initials(group.nom)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900 group-hover:text-[#0f2744]">
              {group.nom}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">
              {group.group_code || `GRP-${String(group.id_group).padStart(6, "0")}`}
            </p>
          </div>
          {group.supplier_scope && (
            <span className={`flex-shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SCOPE_STYLE[scopeKey] ?? SCOPE_STYLE.local}`}>
              {group.supplier_scope}
            </span>
          )}
        </div>

        {/* Owner + type */}
        <div className="mt-4 space-y-1.5">
          {group.supplier_owner && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Users className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
              <span className="truncate">{group.supplier_owner}</span>
            </div>
          )}
          {group.supplier_type && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Sliders className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
              <span className="truncate">{group.supplier_type}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-4">
          {group.units && group.units.length > 0 ? (
            <span className="text-xs text-slate-400">
              {group.units.length} unit{group.units.length !== 1 ? "s" : ""}
            </span>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition group-hover:text-[#0f2744]">
            View details <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

type EditState = {
  nom: string;
  supplier_scope: string;
  supplier_owner: string;
  category: string[];
  strategic_reason: string;
  strategique: boolean;
  monopolistique: boolean;
  directed: boolean;
  multi_site: boolean;
  exit_supplier: boolean;
};

function fromGroup(g: SupplierGroupSummary): EditState {
  return {
    nom: g.nom,
    supplier_scope: g.supplier_scope ?? "",
    supplier_owner: g.supplier_owner ?? "",
    category: g.supplier_type
      ? g.supplier_type.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    strategic_reason: g.strategic_reason ?? "",
    strategique: g.strategique ?? false,
    monopolistique: g.monopolistique ?? false,
    directed: g.directed ?? false,
    multi_site: g.multi_site ?? false,
    exit_supplier: g.exit_supplier ?? false,
  };
}

function GroupDrawer({
  group,
  onClose,
  onOpenWorkspace,
  onGroupUpdated,
}: {
  group: SupplierGroupSummary;
  onClose: () => void;
  onOpenWorkspace: () => void;
  onGroupUpdated: (g: SupplierGroupSummary) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<EditState>(fromGroup(group));

  useEffect(() => {
    setEditing(false);
    setSaveError(null);
    setForm(fromGroup(group));
  }, [group.id_group]);

  const set = (f: keyof EditState, v: string | boolean | string[]) =>
    setForm((p) => ({ ...p, [f]: v }));

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await supplierAPI.updateSupplierGroup(group.id_group, {
        supplier_scope: form.supplier_scope || undefined,
        supplier_owner: form.supplier_owner || undefined,
        supplier_type: form.category.length > 0 ? form.category.join(", ") : undefined,
      });
      onGroupUpdated(res.data);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100";
  const lbl = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-[−20px_0_60px_rgba(15,23,42,0.15)]">

        {/* Header */}
        <div className="relative overflow-hidden bg-[#0f2744] px-6 py-6 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.25),transparent_60%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow ${avatarGradient(group.nom)}`}>
                {initials(group.nom)}
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">{group.nom}</h2>
                <p className="mt-0.5 font-mono text-xs text-blue-200/70">
                  {group.group_code || `GRP-${String(group.id_group).padStart(6, "0")}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {group.supplier_scope && (
                    <span className="rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-white/80">
                      {group.supplier_scope}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Action buttons */}
          {!editing && (
            <div className="relative mt-4">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit group
              </button>
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {saveError && (
            <div className="px-6 pt-4">
              <InlineAlert title="Save failed" message={saveError} tone="danger" />
            </div>
          )}

          {editing ? (
            <div className="space-y-4 px-6 py-5">
              {/* Scope */}
              <div>
                <label className={lbl}>Scope</label>
                <select className={inp} value={form.supplier_scope} onChange={(e) => set("supplier_scope", e.target.value)}>
                  <option value="">— not set —</option>
                  <option value="local">Local</option>
                  <option value="global">Global</option>
                </select>
              </div>

              {/* Global owner — shown whenever scope is global, or to update existing */}
              <div>
                <label className={lbl}>
                  Global supplier owner
                  {form.supplier_scope === "global" && <span className="ml-1 text-red-500">*</span>}
                </label>
                {form.supplier_scope === "global" && !form.supplier_owner && (
                  <div className="mb-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                    <span className="mt-0.5 font-bold">!</span>
                    <span>A global owner is required when scope is set to Global.</span>
                  </div>
                )}
                <input
                  className={inp}
                  value={form.supplier_owner}
                  onChange={(e) => set("supplier_owner", e.target.value)}
                  placeholder="Name or email of the global owner"
                />
              </div>

              {/* Category */}
              <CreatableMultiSelect
                label="Category"
                name="group_category"
                value={form.category}
                onChange={(v) => set("category", v)}
                storageKey="group_category"
                defaultOptions={DEFAULT_CATEGORIES}
                placeholder="e.g. Ferrites, Chokes, Wire coils…"
                helperText="Product categories supplied by this group"
              />

              <div className="flex gap-2.5 pt-1">
                <button type="button" onClick={handleSave} disabled={saving || (form.supplier_scope === "global" && !form.supplier_owner.trim())}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-40">
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button type="button" onClick={() => { setEditing(false); setSaveError(null); }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5 px-6 py-5">
              {/* Info blocks */}
              <div className="grid grid-cols-2 gap-3">
                <InfoBlock icon={<Globe className="h-4 w-4" />} label="Scope" value={group.supplier_scope || "—"} />
                <InfoBlock icon={<Users className="h-4 w-4" />} label="Owner" value={group.supplier_owner || "—"} />
                {group.supplier_type && (
                  <div className="col-span-2">
                    <InfoBlock icon={<Sliders className="h-4 w-4" />} label="Categories" value={group.supplier_type} />
                  </div>
                )}
                {group.strategic_reason && (
                  <div className="col-span-2">
                    <InfoBlock icon={<Shield className="h-4 w-4" />} label="Strategic reason" value={group.strategic_reason} />
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                {group.created_at && (
                  <InfoBlock icon={<TrendingUp className="h-4 w-4" />} label="Created"
                    value={new Date(group.created_at).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })} />
                )}
                {group.updated_at && (
                  <InfoBlock icon={<TrendingDown className="h-4 w-4" />} label="Last updated"
                    value={new Date(group.updated_at).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })} />
                )}
              </div>

              {/* Units preview */}
              {group.units && group.units.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    Units ({group.units.length})
                  </p>
                  <div className="space-y-1.5">
                    {group.units.slice(0, 5).map((u) => (
                      <div key={u.id_supplier_unit} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                        <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
                        <span className="font-mono font-semibold text-slate-700">
                          {u.unit_code || `UNT-${String(u.id_supplier_unit).padStart(6, "0")}`}
                        </span>
                        {u.city && (
                          <span className="ml-auto text-slate-400">{u.city}{u.country ? `, ${u.country}` : ""}</span>
                        )}
                      </div>
                    ))}
                    {group.units.length > 5 && (
                      <p className="px-1 text-xs text-slate-400">+{group.units.length - 5} more units</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky footer */}
        {!editing && (
          <div className="border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onOpenWorkspace}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
              Open unit &amp; site workspace <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function InfoBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <span className="mt-0.5 flex-shrink-0 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-3/4 animate-pulse rounded-full bg-slate-100" />
          <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-slate-50" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-slate-50" />
        <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-slate-50" />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export const SupplierManagementPage = () => {
  const { groupId } = useParams<{ groupId?: string }>();
  const navigate = useNavigate();

  const [groups, setGroups] = useState<SupplierGroupSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [drawerGroup, setDrawerGroup] = useState<SupplierGroupSummary | null>(null);
  const [directGroup, setDirectGroup] = useState<SupplierGroupSummary | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    supplierAPI.listSupplierGroups(0, 200).then((res) => {
      if (cancelled) return;
      const items: SupplierGroupSummary[] = res.data?.items || [];
      setGroups(items);
      if (groupId) {
        const matched = items.find((g) => g.id_group === Number.parseInt(groupId, 10));
        setDirectGroup(matched ?? null);
      }
    }).catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load groups");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [groupId, reloadTick]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return groups;
    return groups.filter((g) =>
      [g.nom, g.supplier_scope, g.supplier_type, g.group_code]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(kw))
    );
  }, [groups, search]);

  // Direct navigation to /suppliers/:groupId/manage
  if (groupId && directGroup) {
    return (
      <SupplierManagement
        groupId={directGroup.id_group}
        groupName={directGroup.nom}
        onClose={() => navigate("/suppliers/manage")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageIntro
        eyebrow="Lifecycle Workspace"
        title="Supplier Group Management"
        description="Browse supplier groups, inspect details, edit information, and open the unit & site assignment workspace."
        actions={
          <button type="button" onClick={() => navigate("/suppliers/onboarding")}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20">
            <Plus className="h-4 w-4" /> New supplier master
          </button>
        }
      />

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[280px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, scope, type…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <p className="text-sm text-slate-400">
          <span className="font-bold text-slate-700">{filtered.length}</span>{" "}
          group{filtered.length !== 1 ? "s" : ""}
          {search ? " matching" : ""}
        </p>

        {loading && <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {/* ── Error ── */}
      {error && (
        <InlineAlert title="Failed to load groups" message={error} tone="danger"
          action={
            <button type="button" onClick={() => setReloadTick((v) => v + 1)}
              className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50">
              Retry
            </button>
          }
        />
      )}

      {/* ── Grid ── */}
      {loading && groups.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No groups found</p>
          <p className="mt-1 text-xs text-slate-400">
            {search ? "Try a broader search term." : "No supplier groups exist yet."}
          </p>
          {search && (
            <button type="button" onClick={() => setSearch("")}
              className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((g) => (
            <GroupCard key={g.id_group} group={g} onClick={() => setDrawerGroup(g)} />
          ))}
        </div>
      )}

      {/* ── Drawer ── */}
      {drawerGroup && (
        <GroupDrawer
          group={drawerGroup}
          onClose={() => setDrawerGroup(null)}
          onOpenWorkspace={() => navigate(`/suppliers/${drawerGroup.id_group}/manage`)}
          onGroupUpdated={(updated) => {
            setGroups((prev) => prev.map((g) => g.id_group === updated.id_group ? updated : g));
            setDrawerGroup(updated);
          }}
        />
      )}
    </div>
  );
};

export default SupplierManagementPage;
