import { useEffect, useState } from "react";
import { PlusCircle, RefreshCw, Trash2, X } from "lucide-react";
import supplierAPI from "../../../services/supplierOnboardingAPI";
import type { ActionNode, ActionPlanRecord, Opp } from "../types";
import { AP_ACTION_STATUSES, AP_PHASE_OPTIONS } from "../constants";
import { autoTitle, emptyAction, emptyPlanForm, fullNameFromEmail } from "../utils";

export function ActionPlanTab({
  opp,
  userEmail,
  onRefresh,
}: {
  opp: Opp;
  userEmail: string;
  onRefresh: (o: Opp) => void;
}) {
  const [plans, setPlans] = useState<ActionPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyPlanForm());

  async function loadPlans() {
    setLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.listActionPlans(opp.opportunity_id);
      setPlans(res?.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load action plans.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlans();
  }, [opp.opportunity_id]);

  function openCreate() {
    setEditingId(null);
    const phase = opp.phase_status ?? "";
    const today = new Date().toISOString().slice(0, 10);
    setForm({
      ...emptyPlanForm(),
      phase_status: phase,
      plan_title: autoTitle(opp.opportunity_name, phase, today),
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function openEdit(plan: ActionPlanRecord) {
    setEditingId(plan.action_plan_id);
    const firstSujet = plan.plan_data?.sujets?.[0];
    const savedActions = (firstSujet?.actions ?? [
      emptyAction(),
    ]) as ActionNode[];
    setForm({
      plan_title: plan.plan_title ?? "",
      phase_status: plan.phase_status ?? "",
      actions: savedActions.map((a) => ({ ...emptyAction(), ...a })),
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSave() {
    if (!form.plan_title.trim()) {
      setError("Plan title is required.");
      return;
    }
    if (form.actions.some((a) => !a.titre.trim())) {
      setError("All action titles are required.");
      return;
    }
    if (form.actions.some((a) => !a.due_date)) {
      setError("Due date is required for all actions.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        plan_title: form.plan_title,
        phase_status: form.phase_status || null,
        // Wrap actions in a single sujet — the subject layer is hidden from the user
        sujets: [
          {
            titre: form.plan_title,
            actions: form.actions,
          },
        ],
      };
      if (editingId !== null) {
        await supplierAPI.updateActionPlan(
          opp.opportunity_id,
          editingId,
          payload,
        );
        // The enterprise-system push is currently disabled server-side
        // (external_push_status is always "pending" — see
        // purchasing_value/service.py create/update_action_plan), so don't
        // claim a sync happened that didn't.
        setSuccess("Action plan updated.");
      } else {
        await supplierAPI.createActionPlan(opp.opportunity_id, payload);
        setSuccess("Action plan created.");
      }
      await loadPlans();
      setShowForm(false);
      setEditingId(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save action plan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(planId: number) {
    if (!confirm("Delete this action plan?")) return;
    setDeleting(planId);
    try {
      await supplierAPI.deleteActionPlan(opp.opportunity_id, planId);
      setPlans((prev) => prev.filter((p) => p.action_plan_id !== planId));
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete action plan.");
    } finally {
      setDeleting(null);
    }
  }

  async function handleSync(planId: number) {
    setSyncing(planId);
    setError(null);
    try {
      await supplierAPI.syncActionPlan(planId, opp.opportunity_id);
      setSuccess("Action plan synced.");
      await loadPlans();
    } catch (e: any) {
      setError(e?.message ?? "Failed to sync action plan.");
      await loadPlans(); // refresh external_push_status/error even on failure
    } finally {
      setSyncing(null);
    }
  }

  // ── action helpers ─────────────────────────────────────────────────────
  function setAction(ai: number, patch: Partial<ActionNode>) {
    setForm((f) => ({
      ...f,
      actions: f.actions.map((a, j) => (j === ai ? { ...a, ...patch } : a)),
    }));
  }
  function addAction() {
    setForm((f) => ({ ...f, actions: [...f.actions, emptyAction()] }));
  }
  function removeAction(ai: number) {
    setForm((f) => ({ ...f, actions: f.actions.filter((_, j) => j !== ai) }));
  }

  const inp =
    "w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none dark:border-white/10 dark:bg-[#1a2d42] dark:text-slate-100";
  const lbl =
    "block text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5";
  const pushColor = (s?: string) =>
    s === "ok"
      ? "text-emerald-600"
      : s === "failed"
        ? "text-red-500"
        : "text-amber-500";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Action Plans
          </h3>
          <p className="text-[11px] text-slate-400">
            Phase-level actions pushed to the enterprise action plan system.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
          >
            <PlusCircle size={12} /> New Action Plan
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      {success && !showForm && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
          {success}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-white/10 dark:bg-[#0d1c2e] space-y-4">
          {/* Context banner */}
          <div className="rounded-lg bg-slate-100 dark:bg-white/5 px-3 py-2 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Opportunity
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
              {opp.opportunity_name ?? `#${opp.opportunity_id}`}
            </span>
            {opp.phase_status && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Phase
                </span>
                <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-bold">
                  {opp.phase_status}
                </span>
              </>
            )}
          </div>

          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {editingId ? "Edit Action Plan" : "New Action Plan"}
          </h4>

          {/* Plan-level fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl}>Plan Title</label>
              <input
                className={inp}
                value={form.plan_title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, plan_title: e.target.value }))
                }
                placeholder="Auto-generated from opportunity and phase"
              />
              <p className="mt-0.5 text-[10px] text-slate-400">
                Auto-filled — edit if needed.
              </p>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Project Phase</label>
              <select
                className={inp}
                value={form.phase_status}
                onChange={(e) => {
                  const phase = e.target.value;
                  const today = new Date().toISOString().slice(0, 10);
                  setForm((f) => ({
                    ...f,
                    phase_status: phase,
                    plan_title: autoTitle(opp.opportunity_name, phase, today),
                  }));
                }}
              >
                <option value="">— Select phase —</option>
                {AP_PHASE_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Actions
              </span>
              <button
                onClick={addAction}
                className="flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
              >
                <PlusCircle size={10} /> Add Action
              </button>
            </div>

            {form.actions.map((action, ai) => (
              <div
                key={ai}
                className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#1a2d42] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-600">
                    Action {ai + 1}
                  </span>
                  {form.actions.length > 1 && (
                    <button
                      onClick={() => removeAction(ai)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className={lbl}>Title *</label>
                    <input
                      className={inp}
                      value={action.titre}
                      onChange={(e) => setAction(ai, { titre: e.target.value })}
                      placeholder="e.g. Conduct first article inspection"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>Description</label>
                    <textarea
                      className={inp + " resize-none"}
                      rows={2}
                      value={action.description ?? ""}
                      onChange={(e) =>
                        setAction(ai, { description: e.target.value })
                      }
                      placeholder="What needs to be done…"
                    />
                  </div>
                  <div>
                    <label className={lbl}>Responsible Email</label>
                    <input
                      className={inp}
                      type="email"
                      value={action.email_responsable ?? ""}
                      onChange={(e) => {
                        const email = e.target.value;
                        setAction(ai, {
                          email_responsable: email || undefined,
                          responsable: email
                            ? fullNameFromEmail(email)
                            : undefined,
                        });
                      }}
                      placeholder="firstname.lastname@company.com"
                    />
                  </div>
                  <div>
                    <label className={lbl}>Responsible</label>
                    <input
                      className={inp + " bg-slate-50"}
                      value={action.responsable ?? ""}
                      readOnly
                      placeholder="Derived from email"
                    />
                  </div>
                  <div>
                    <label className={lbl}>
                      Due Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={inp}
                      type="date"
                      required
                      value={action.due_date ?? ""}
                      onChange={(e) =>
                        setAction(ai, { due_date: e.target.value || null })
                      }
                    />
                  </div>
                  <div>
                    <label className={lbl}>Status</label>
                    <select
                      className={inp}
                      value={action.status ?? "open"}
                      onChange={(e) => {
                        const s = e.target.value;
                        setAction(ai, {
                          status: s,
                          closed_date:
                            s === "closed"
                              ? action.closed_date ||
                                new Date().toISOString().slice(0, 10)
                              : null,
                        });
                      }}
                    >
                      {AP_ACTION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  {action.status === "closed" && (
                    <>
                      <div>
                        <label className={lbl}>Closed Date</label>
                        <input
                          className={inp}
                          type="date"
                          value={action.closed_date ?? ""}
                          onChange={(e) =>
                            setAction(ai, {
                              closed_date: e.target.value || null,
                            })
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        <label className={lbl}>
                          Evidence (URL or reference)
                        </label>
                        <div className="space-y-1">
                          {action.attachments.map((att, ei) => (
                            <div key={ei} className="flex gap-1.5 items-center">
                              <input
                                className={inp + " flex-1"}
                                value={att.name}
                                onChange={(e) => {
                                  const next = action.attachments.map((a, i) =>
                                    i === ei
                                      ? { ...a, name: e.target.value }
                                      : a,
                                  );
                                  setAction(ai, { attachments: next });
                                }}
                                placeholder="Document name"
                              />
                              <input
                                className={inp + " flex-1"}
                                value={att.url}
                                onChange={(e) => {
                                  const next = action.attachments.map((a, i) =>
                                    i === ei
                                      ? { ...a, url: e.target.value }
                                      : a,
                                  );
                                  setAction(ai, { attachments: next });
                                }}
                                placeholder="URL or file path"
                              />
                              <button
                                onClick={() =>
                                  setAction(ai, {
                                    attachments: action.attachments.filter(
                                      (_, i) => i !== ei,
                                    ),
                                  })
                                }
                                className="text-red-400 hover:text-red-600 shrink-0"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() =>
                              setAction(ai, {
                                attachments: [
                                  ...action.attachments,
                                  { name: "", url: "" },
                                ],
                              })
                            }
                            className="text-[10px] text-blue-600 hover:underline"
                          >
                            + Add evidence
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <RefreshCw size={11} className="animate-spin" /> : null}
              {saving ? "Saving…" : editingId ? "Update Plan" : "Create Plan"}
            </button>
            <button
              onClick={cancelForm}
              className="rounded-lg border border-slate-200 px-4 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Plan list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw size={18} className="animate-spin text-slate-300" />
        </div>
      ) : plans.length === 0 && !showForm ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          No action plans yet. Click <strong>New Action Plan</strong> to get
          started.
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const sujets = plan.plan_data?.sujets ?? [];
            const actions = sujets.flatMap((s) => s.actions ?? []);
            const actionCount = actions.length;
            return (
              <div
                key={plan.action_plan_id}
                className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0d1c2e]"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 p-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {plan.plan_title}
                      </span>
                      {plan.phase_status && (
                        <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                          {plan.phase_status}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-semibold ${pushColor(plan.external_push_status)}`}
                      >
                        ●{" "}
                        {plan.external_push_status === "ok"
                          ? "Synced"
                          : plan.external_push_status === "failed"
                            ? "Sync failed"
                            : "Pending sync"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {plan.plan_code && (
                        <span className="font-mono mr-2 text-slate-300">
                          {plan.plan_code}
                        </span>
                      )}
                      {actionCount} action{actionCount !== 1 ? "s" : ""}
                    </p>
                    {plan.plan_data?.responsable && (
                      <p className="text-[11px] text-slate-500">
                        <span className="font-semibold">Responsible:</span>{" "}
                        {plan.plan_data.responsable}
                        {plan.plan_data.email_responsable && (
                          <span className="text-slate-400">
                            {" "}
                            · {plan.plan_data.email_responsable}
                          </span>
                        )}
                      </p>
                    )}
                    {plan.external_push_error &&
                      plan.external_push_status === "failed" && (
                        <p className="text-[10px] text-red-500 truncate max-w-sm">
                          {plan.external_push_error}
                        </p>
                      )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {plan.external_push_status !== "ok" && (
                      <button
                        onClick={() => handleSync(plan.action_plan_id)}
                        disabled={syncing === plan.action_plan_id}
                        title={
                          plan.external_push_status === "failed"
                            ? "Retry sync to the Action Plan database"
                            : "Sync to the Action Plan database"
                        }
                        className="rounded border border-blue-200 px-2 py-1 text-[10px] font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-40 dark:border-blue-500/30 dark:text-blue-400"
                      >
                        {syncing === plan.action_plan_id ? (
                          <RefreshCw size={10} className="animate-spin" />
                        ) : plan.external_push_status === "failed" ? (
                          "Retry sync"
                        ) : (
                          "Sync"
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(plan)}
                      className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(plan.action_plan_id)}
                      disabled={deleting === plan.action_plan_id}
                      className="rounded border border-red-100 px-2 py-1 text-[10px] font-semibold text-red-500 hover:bg-red-50 disabled:opacity-40"
                    >
                      {deleting === plan.action_plan_id ? (
                        <RefreshCw size={10} className="animate-spin" />
                      ) : (
                        <Trash2 size={10} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Actions preview */}
                {actions.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-white/[0.06] px-4 py-2.5 space-y-1.5">
                    {actions.map((a, j) => {
                      const statusColor: Record<string, string> = {
                        open: "bg-slate-100 text-slate-500",
                        closed: "bg-emerald-100 text-emerald-700",
                        blocked: "bg-red-100 text-red-500",
                      };
                      return (
                        <div
                          key={j}
                          className="flex items-start gap-2 flex-wrap"
                        >
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${statusColor[a.status ?? "open"] ?? statusColor.open}`}
                          >
                            {a.status ?? "open"}
                          </span>
                          <span
                            className={`shrink-0 text-[9px] font-semibold ${a._external_id ? "text-emerald-500" : "text-slate-300"}`}
                            title={
                              a._external_id
                                ? "Synced to the Action Plan database"
                                : "Not yet synced to the Action Plan database"
                            }
                          >
                            ●
                          </span>
                          <span className="text-[11px] text-slate-700 dark:text-slate-300 flex-1">
                            {a.titre}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                            {a.responsable && (
                              <span>
                                {a.responsable}
                                {a.email_responsable
                                  ? ` · ${a.email_responsable}`
                                  : ""}
                              </span>
                            )}
                            {a.due_date && <span>Due {a.due_date}</span>}
                            {a.closed_date && (
                              <span className="text-emerald-600">
                                Closed {a.closed_date}
                              </span>
                            )}
                            {(a.attachments?.length ?? 0) > 0 && (
                              <span className="text-blue-500">
                                {a.attachments.length} evidence
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
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

