import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import supplierAPI from "../../../services/supplierOnboardingAPI";
import type { Opp } from "../types";
import { PHASE_GUIDE, PHASE_OUTPUT_DEF } from "../constants";
import { invalidateOpportunity } from "../../../hooks/useOpportunity";

export function ProjectTab({
  opp,
  userEmail,
  onRefresh,
}: {
  opp: Opp;
  userEmail: string;
  onRefresh: (o: Opp) => void;
}) {
  const queryClient = useQueryClient();
  const phaseDef = PHASE_OUTPUT_DEF[opp.phase_status ?? ""];
  const guide = PHASE_GUIDE[opp.phase_status ?? ""];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const proj = opp.projects[0];
  // Phase 1 output remains editable even during/after committee review
  // The committee received the email — DB updates don't change what was sent
  const isUnderReview = opp.status === "Under Committee Review";

  const initForm = () =>
    Object.fromEntries(
      (phaseDef?.fields ?? []).map((f) => {
        const val = proj
          ? (proj as unknown as Record<string, unknown>)[f.key]
          : undefined;
        return [f.key, val != null ? String(val) : ""];
      }),
    );
  const [form, setForm] = useState<Record<string, string>>(initForm);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const inp =
    "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!proj) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      // Strip empty strings → undefined so Pydantic accepts Optional[date] fields
      const payload = Object.fromEntries(
        Object.entries({ ...form, updated_by: userEmail }).map(([k, v]) => [
          k,
          v === "" ? undefined : v,
        ]),
      );
      await supplierAPI.updateProject(proj.project_id, payload);
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
      invalidateOpportunity(queryClient, opp.opportunity_id);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  if (!opp.projects.length) {
    return (
      <div className="py-10 text-center text-sm text-slate-400">
        {["Negotiation", "Cash"].includes(opp.opportunity_type ?? "")
          ? "Negotiation and Cash opportunities do not require a project."
          : "Project created automatically on Phase 0 Go."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Project header card */}
      {proj && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-bold text-slate-800">
                {proj.project_name}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {proj.project_type} · PM: {proj.project_owner || "—"}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${
                proj.status === "On time"
                  ? "bg-emerald-100 text-emerald-700"
                  : proj.status === "Late"
                    ? "bg-red-100 text-red-700"
                    : proj.status === "Completed"
                      ? "bg-teal-100 text-teal-700"
                      : "bg-orange-100 text-orange-700"
              }`}
            >
              {proj.status || "—"}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-600">
              {proj.phase_status}
            </span>
            {proj.gate_decision && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                  proj.gate_decision === "Go"
                    ? "bg-emerald-50 text-emerald-600"
                    : proj.gate_decision === "No Go"
                      ? "bg-red-50 text-red-600"
                      : "bg-amber-50 text-amber-600"
                }`}
              >
                {proj.gate_decision}
              </span>
            )}
            {proj.plant_validation && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                  proj.plant_validation === "Approved"
                    ? "bg-emerald-50 text-emerald-600"
                    : proj.plant_validation === "Rejected"
                      ? "bg-red-50 text-red-600"
                      : "bg-amber-50 text-amber-600"
                }`}
              >
                PPAP: {proj.plant_validation}
              </span>
            )}
          </div>
          {proj.phase_output_notes && (
            <p className="mt-2 text-xs text-slate-600 bg-white rounded-lg px-3 py-2 border border-slate-100">
              {proj.phase_output_notes}
            </p>
          )}
        </div>
      )}

      {/* Phase output form — always editable, even during committee review */}
      {isUnderReview && (
        <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-2.5 text-xs text-purple-700 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">ℹ</span>
          <span>
            The dossier has been submitted to the committee. You can still
            complete the fields below — database updates do not change the email
            already sent. If you change significant items, re-submit the dossier
            via the Gate tab.
          </span>
        </div>
      )}
      {phaseDef && proj && (
        <form
          onSubmit={save}
          className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              {opp.phase_status} Output — {phaseDef.title}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Owner: <span className="font-semibold">{phaseDef.owner}</span> ·
              Deliverable:{" "}
              <span className="font-semibold">{phaseDef.deliverable}</span>
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              ✓ Saved
            </p>
          )}

          {phaseDef.fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                {f.label}
                {f.hint && (
                  <span className="ml-1.5 font-normal text-slate-400">
                    ({f.hint})
                  </span>
                )}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  value={form[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : f.type === "select" ? (
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  value={form[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                >
                  <option value="">— Select —</option>
                  {f.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  value={form[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </div>
          ))}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading && <RefreshCw size={13} className="animate-spin" />} Save
              Output
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// STP Download Button — fetch with auth token then trigger browser download
// ---------------------------------------------------------------------------
