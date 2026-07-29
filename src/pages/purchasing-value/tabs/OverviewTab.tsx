import { useEffect, useState } from "react";
import { Banknote, Clock, FileText, TrendingUp } from "lucide-react";
import supplierAPI from "../../../services/supplierOnboardingAPI";
import { MemberDirectoryPicker } from "../../../components/common/MemberDirectoryPicker";
import type { Opp, PhaseHistoryEntry } from "../types";
import { fmt, fmtDate, fmtMonths, fmtPrice, pldColor } from "../utils";
import { InfoRow } from "../components/InfoRow";
import { MetricCard } from "../components/MetricCard";

export function OverviewTab({ opp, onRefresh }: { opp: Opp; onRefresh: (o: Opp) => void }) {
  const pldReady =
    opp.payback_score && opp.lead_time_score && opp.difficulty_score;
  const cur = opp.currency || "EUR";
  const [phaseHistory, setPhaseHistory] = useState<PhaseHistoryEntry[]>([]);
  const [editingPM, setEditingPM] = useState(false);
  const [pmInput, setPmInput] = useState("");
  const [pmSaving, setPmSaving] = useState(false);
  const [pmError, setPmError] = useState<string | null>(null);
  const [pmNotice, setPmNotice] = useState<string | null>(null);
  const pmApplicable = !["Negotiation", "Cash"].includes(opp.opportunity_type ?? "");

  const savePM = async () => {
    const email = pmInput.trim();
    if (!email) {
      setPmError("A Project Manager email is required.");
      return;
    }
    setPmSaving(true);
    setPmError(null);
    try {
      const res = await supplierAPI.updateProjectManager(opp.opportunity_id, email);
      onRefresh({ ...opp, project_owner: email });
      setEditingPM(false);
      setPmNotice(
        res.data?.notification === "sent"
          ? "Saved — handover email resent to the new Project Manager."
          : "Saved, but the notification email could not be sent.",
      );
    } catch (e: unknown) {
      setPmError(e instanceof Error ? e.message : "Failed to update the Project Manager.");
    } finally {
      setPmSaving(false);
    }
  };

  useEffect(() => {
    let active = true;
    supplierAPI
      .getOpportunityPhaseHistory(opp.opportunity_id)
      .then((res) => {
        if (active) setPhaseHistory((res?.data as PhaseHistoryEntry[]) ?? []);
      })
      .catch(() => {
        if (active) setPhaseHistory([]);
      });
    return () => {
      active = false;
    };
  }, [opp.opportunity_id]);

  const budgetLocks = [...(opp.budget_years ?? [])]
    .filter((by) => by.status_locked_at)
    .sort((a, b) => a.fiscal_year - b.fiscal_year);

  const auditHighlights = [
    {
      label: "Created",
      value: fmtDate(opp.created_at),
      sub: opp.created_by
        ? `by ${opp.created_by}`
        : "Record timestamp from the opportunity table",
    },
    {
      label: "Last update",
      value: fmtDate(opp.updated_at),
      sub: "Latest saved change on this opportunity",
    },
    {
      label: "Budget confirmation",
      value: opp.budget_confirmed_at ? fmtDate(opp.budget_confirmed_at) : "-",
      sub: opp.budget_confirmed_by
        ? `by ${opp.budget_confirmed_by}`
        : "Not budget-confirmed yet",
    },
    {
      label: "Gate decisions",
      value: phaseHistory.length ? String(phaseHistory.length) : "0",
      sub: phaseHistory.length
        ? "Immutable phase snapshots available"
        : "No recorded gate snapshot yet",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_340px]">
      <div className="space-y-5">
        {opp.description && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 leading-relaxed">
            {opp.description}
          </p>
        )}
        {cur !== "EUR" && (
          <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-2 text-[11px] text-amber-700">
            Amounts are in <strong>{cur}</strong> (rate{" "}
            {opp.fx_rate_to_eur ?? 1} to EUR). Consolidated reports (Budgeting,
            Monthly Follow-up) convert to EUR.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={<TrendingUp size={12} />}
            label={`Est. Annual Saving (${cur})`}
            value={fmt(opp.expected_annual_saving, cur)}
          />
          <MetricCard
            icon={<Banknote size={12} />}
            label={`Cash Impact (${cur})`}
            value={fmt(opp.cash_impact, cur)}
          />
          <MetricCard
            icon={<Clock size={12} />}
            label="Duration"
            value={
              opp.duration_months != null
                ? `${fmtMonths(opp.duration_months)} months`
                : "-"
            }
          />
          <MetricCard
            icon={<FileText size={12} />}
            label="Budget Year"
            value={opp.budget_year ? String(opp.budget_year) : "-"}
            sub={opp.validation_status ?? undefined}
            subClassName={
              opp.validation_status === "Budgeted"
                ? "font-semibold text-emerald-600"
                : undefined
            }
          />
        </div>
        {pldReady && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
              PLD Priority
            </p>
            <div className="flex items-center gap-3">
              <div className="flex gap-2 text-xs text-slate-600">
                <span>P={opp.payback_score}</span>
                <span>L={opp.lead_time_score}</span>
                <span>D={opp.difficulty_score}</span>
              </div>
              <span className="font-bold text-sm">= {opp.priority_score}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${pldColor(opp.priority_category)}`}
              >
                {opp.priority_category}
              </span>
            </div>
          </div>
        )}
        <div className="rounded-xl border border-slate-100 divide-y divide-slate-50">
          <InfoRow label="Idea Owner (Pilot)" value={opp.idea_owner} />
          <InfoRow label="Purchasing Owner" value={opp.purchasing_owner} />
          {pmApplicable && (
            <div className="border-b border-slate-50 px-4 py-2 last:border-0 dark:border-white/[0.05]">
              <div className="flex gap-3">
                <span className="w-36 shrink-0 pt-0.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                  Project Manager
                </span>
                <div className="min-w-0 flex-1">
                  {!editingPM ? (
                    <div className="flex items-center gap-2">
                      <span className="break-all text-sm text-slate-700 dark:text-slate-200">
                        {opp.project_owner || "—"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPmInput(opp.project_owner ?? "");
                          setPmError(null);
                          setPmNotice(null);
                          setEditingPM(true);
                        }}
                        className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 hover:border-amber-400"
                      >
                        Edit
                      </button>
                    </div>
                  ) : (
                    <div className="max-w-sm space-y-1.5">
                      <MemberDirectoryPicker
                        fetchDirectory={() => supplierAPI.getPmDirectoryAuthenticated()}
                        fetchKey={`overview_pm_${opp.opportunity_id}`}
                        value={pmInput}
                        onChange={setPmInput}
                        placeholder="project.manager@avocarbon.com"
                      />
                      <p className="text-[10px] text-slate-400">
                        Saving resends the project handover email to the new address.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={savePM}
                          disabled={pmSaving}
                          className="rounded-lg bg-[#062B49] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0C5381] disabled:opacity-50"
                        >
                          {pmSaving ? "Saving…" : "Save & Resend"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPM(false);
                            setPmError(null);
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                      {pmError && <p className="text-xs text-rose-500">{pmError}</p>}
                    </div>
                  )}
                  {!editingPM && pmNotice && (
                    <p className="mt-1 text-[11px] text-emerald-600">{pmNotice}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          <InfoRow label="Conversion Owner" value={opp.conversion_owner} />
          <InfoRow
            label="Plant"
            value={
              opp.plant_name
                ? `${opp.plant_name}${opp.plant_city ? ` (${opp.plant_city})` : ""}`
                : opp.plant_id
                  ? `#${opp.plant_id}`
                  : null
            }
          />
          {opp.secondary_plants && (
            <InfoRow label="Secondary Plants" value={opp.secondary_plants} />
          )}
          <InfoRow label="Change Mode" value={opp.change_mode} />
          <InfoRow
            label="Currency"
            value={
              cur === "EUR"
                ? "EUR"
                : `${cur}, rate ${opp.fx_rate_to_eur ?? 1} to EUR`
            }
          />
          <InfoRow label="Scope IN" value={opp.scope_in} />
          <InfoRow label="Customers" value={opp.customers} />
          {opp.proposed_supplier_name && (
            <InfoRow
              label="Proposed Supplier"
              value={opp.proposed_supplier_name}
            />
          )}
          {opp.current_price != null && opp.proposed_price != null && (
            <InfoRow
              label="Price Before / After"
              value={`${fmtPrice(opp.current_price, cur)} / ${fmtPrice(opp.proposed_price, cur)}`}
            />
          )}
          {opp.total_investment != null && (
            <InfoRow
              label="Total Investment"
              value={`${fmt(Number(opp.total_investment), cur)} (ROI: ${opp.roi_percent ?? "?"}%)`}
            />
          )}
          {opp.period_saving != null && (
            <InfoRow
              label="Value of Opportunity (total gain N→N+3)"
              value={`${fmt(Number(opp.period_saving), cur)}${opp.roi_period_percent != null ? ` (ROI: ${opp.roi_period_percent}%)` : ""}`}
            />
          )}
          {[
            ["N", opp.saving_year_n],
            ["N+1", opp.saving_year_n1],
            ["N+2", opp.saving_year_n2],
            ["N+3", opp.saving_year_n3],
          ].map(([yr, val]) =>
            val != null ? (
              <InfoRow
                key={yr as string}
                label={`Est. Saving Year ${yr}`}
                value={fmt(Number(val), cur)}
              />
            ) : null,
          )}
          {/* Saving à budgéter — incremental year-over-year drop that actually gets
              budgeted. "budget = Oui" when the year carries a non-zero increment. */}
          {opp.saving_to_budget_by_year &&
            Object.entries(opp.saving_to_budget_by_year)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([yr, val]) => (
                <InfoRow
                  key={`stb-${yr}`}
                  label={`Saving à budgéter ${yr}`}
                  value={`${fmt(Number(val), cur)} — budget : ${Math.abs(Number(val)) >= 0.005 ? "Oui" : "Non (0)"}`}
                />
              ))}
          {opp.budget_years && opp.budget_years.length > 0 && (
            <>
              {[...opp.budget_years]
                .sort((a, b) => a.fiscal_year - b.fiscal_year)
                .map((by) => (
                  <InfoRow
                    key={`by-${by.id}`}
                    label={`Budget ${by.fiscal_year} (${by.portion_kind ?? "-"})`}
                    value={`${fmt(Number(by.applicable_amount ?? 0), cur)} | ${by.budget_status ?? "Empty"} | ${by.suggested_status === "Validate" ? "Validated" : "Forecast"}${by.status_locked_at ? ` | locked ${fmtDate(by.status_locked_at)}${by.status_locked_by ? ` by ${by.status_locked_by}` : ""}` : ""}`}
                  />
                ))}
            </>
          )}
          {opp.cash_inventory_gap != null && (
            <InfoRow
              label="Est. Inventory Gap"
              value={fmt(Number(opp.cash_inventory_gap), cur)}
            />
          )}
          {opp.cash_ap_gap != null && (
            <InfoRow
              label="Est. AP Gap"
              value={fmt(Number(opp.cash_ap_gap), cur)}
            />
          )}
          <InfoRow label="Record Created" value={fmtDate(opp.created_at)} />
          <InfoRow label="Created By" value={opp.created_by} />
          <InfoRow
            label="Last Opportunity Update"
            value={fmtDate(opp.updated_at)}
          />
          <InfoRow
            label="Planned Start"
            value={fmtDate(opp.planned_start_date)}
          />
          <InfoRow label="Planned End" value={fmtDate(opp.planned_end_date)} />
          <InfoRow
            label="Execution Start (Phase 2)"
            value={fmtDate(opp.execution_start_date)}
          />
          <InfoRow
            label="Deployment Start (Phase 3)"
            value={fmtDate(opp.real_start_date)}
          />
          <InfoRow
            label="Validation Date (Phase 0 Go)"
            value={fmtDate(opp.val_date)}
          />
          <InfoRow
            label="Validation Status"
            value={
              opp.validation_status
                ? `${opp.validation_status}${opp.budget_confirmed_at ? ` | confirmed ${fmtDate(opp.budget_confirmed_at)}${opp.budget_confirmed_by ? ` by ${opp.budget_confirmed_by}` : ""}` : ""}`
                : undefined
            }
            valueClassName={
              opp.validation_status === "Budgeted"
                ? "font-semibold text-emerald-600"
                : undefined
            }
          />
          {opp.assumptions_summary && (
            <InfoRow label="Assumptions" value={opp.assumptions_summary} />
          )}
          {opp.comments && <InfoRow label="Comments" value={opp.comments} />}
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-4 text-white shadow-[0_14px_38px_rgba(15,23,42,0.18)]">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-200/80">
            Audit Snapshot
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {auditHighlights.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-100/70">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-bold text-white">
                  {item.value}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-blue-100/70">
                  {item.sub}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
              Approval Timeline
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {phaseHistory.length} event{phaseHistory.length === 1 ? "" : "s"}
            </span>
          </div>
          {phaseHistory.length === 0 ? (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              No immutable gate snapshot has been recorded yet for this
              opportunity.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {[...phaseHistory].reverse().map((entry) => (
                <div
                  key={entry.snapshot_id}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-slate-700">
                      {entry.phase_from ?? "-"} to {entry.phase_to ?? "-"}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${entry.gate_decision === "Go" ? "bg-emerald-100 text-emerald-700" : entry.gate_decision === "No Go" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {entry.gate_decision ?? "Decision"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10.5px] text-slate-500">
                    {entry.decided_by ?? "Unknown"} |{" "}
                    {fmtDate(entry.decided_at)}
                  </p>
                  {entry.gate_comments && (
                    <p className="mt-1 text-[10.5px] italic text-slate-600">
                      "{entry.gate_comments}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
            Budget Locks
          </p>
          {budgetLocks.length === 0 ? (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              No budget row is locked yet for this opportunity.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {budgetLocks.map((by) => (
                <div
                  key={`lock-${by.id}`}
                  className="rounded-xl border border-slate-100 bg-white px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-slate-700">
                      FY {by.fiscal_year} | {by.budget_status ?? "Empty"}
                    </p>
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-bold text-violet-700">
                      {by.portion_kind ?? "Budget row"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10.5px] text-slate-500">
                    Locked {fmtDate(by.status_locked_at)}
                    {by.status_locked_by ? ` by ${by.status_locked_by}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Collapsible card used to group the (long) STP study sub-sections.
