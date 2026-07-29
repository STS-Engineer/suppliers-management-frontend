import { useEffect, useState } from "react";
import { PlusCircle, RefreshCw, X } from "lucide-react";
import supplierAPI from "../../../services/supplierOnboardingAPI";
import { MemberDirectoryPicker } from "../../../components/common/MemberDirectoryPicker";
import type { Opp, SiteOption } from "../types";
import { TYPES } from "../constants";

export function CreateModal({
  onClose,
  onCreated,
  userEmail,
}: {
  onClose: () => void;
  onCreated: (o: Opp) => void;
  userEmail: string;
}) {
  const [form, setForm] = useState({
    opportunity_name: "",
    opportunity_type: "Sourcing",
    saving_nature: "",
    entry_mode: "",
    idea_owner: userEmail,
    description: "",
    plant_id: "",
    // budget_status removed — only settable after Phase 0 Go (Olivier: "tant que c'est working on it, on n'a pas le droit de le budgeter")
  });
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  // Plant is mandatory for every opportunity type — it drives budgeting, supplier
  // evaluation and per-plant KPI roll-up.
  const needsPlant = true;

  useEffect(() => {
    supplierAPI
      .listSiteOptions()
      .then((r: { data?: SiteOption[] }) => setSites(r.data ?? []))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.plant_id) {
      setError("Plant is required to create an opportunity.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.createOpportunity({
        ...form,
        plant_id: form.plant_id ? parseInt(form.plant_id) : undefined,
      });
      onCreated(res.data as Opp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const inp =
    "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-800">
            New Opportunity
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Name *
            </label>
            <input
              required
              className={inp}
              value={form.opportunity_name}
              onChange={(e) => set("opportunity_name", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Type *
            </label>
            <select
              required
              className={inp}
              value={form.opportunity_type}
              onChange={(e) =>
                // Reset entry_mode: Bonus/Rework are tied to a specific type.
                setForm((f) => ({
                  ...f,
                  opportunity_type: e.target.value,
                  entry_mode: "",
                }))
              }
            >
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          {(form.opportunity_type === "Negotiation" ||
            form.opportunity_type === "Technical Productivity") && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Mode
              </label>
              <select
                className={inp}
                value={form.entry_mode}
                onChange={(e) => set("entry_mode", e.target.value)}
              >
                <option value="">Standard (price × quantity)</option>
                {form.opportunity_type === "Negotiation" && (
                  <option value="Bonus">Bonus — single one-time gain</option>
                )}
                {form.opportunity_type === "Technical Productivity" && (
                  <option value="Rework">Rework — single one-time gain</option>
                )}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Saving nature
            </label>
            <select
              className={inp}
              value={form.saving_nature}
              onChange={(e) => set("saving_nature", e.target.value)}
            >
              <option value="">— Not classified —</option>
              <option value="Hard">Hard — cost reduction</option>
              <option value="Soft">Soft — cost avoidance</option>
            </select>
          </div>
          {needsPlant && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Avocarbon Plant *{" "}
                <span className="text-orange-500">(required)</span>
              </label>
              <select
                required
                className={inp}
                value={form.plant_id}
                onChange={(e) => set("plant_id", e.target.value)}
              >
                <option value="">— Select plant —</option>
                {sites.map((s) => (
                  <option key={s.id_site} value={s.id_site}>
                    {s.site_name}
                    {s.city ? ` · ${s.city}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Initial Pilot (email) *
            </label>
            <MemberDirectoryPicker
              fetchDirectory={() => supplierAPI.getPmDirectoryAuthenticated()}
              fetchKey="idea_owner"
              value={form.idea_owner}
              onChange={(email) => set("idea_owner", email)}
              placeholder="initial.pilot@avocarbon.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Description
            </label>
            <textarea
              rows={2}
              className={`${inp} resize-none`}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <PlusCircle size={14} />
              )}{" "}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
