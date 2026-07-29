import { useState } from "react";
import { AlertTriangle, BarChart2, CheckCircle2, RefreshCw } from "lucide-react";
import supplierAPI from "../../../services/supplierOnboardingAPI";
import { useAuth } from "../../../context/AuthContext";
import type { Opp } from "../types";
import { FINANCIAL_PHASE_CONTEXT, OUTCOME_CONFIG, REVISE_BASELINE_ENABLED } from "../constants";
import { fmt, fmtDate, toNum } from "../utils";

export function FinancialTab({
  opp,
  userEmail,
  onRefresh,
}: {
  opp: Opp;
  userEmail: string;
  onRefresh: (o: Opp) => void;
}) {
  const [editRow, setEditRow] = useState<number | null>(null);
  const [rowForm, setRowForm] = useState({
    actual_saving: "",
    cash_actual: "",
    forecast_eoy_saving: "",
    forecast_comment: "",
    comment: "",
    monthly_outcome: "Continue",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEscalate, setShowEscalate] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showCashEntry, setShowCashEntry] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [pendingRecoveryPrompt, setPendingRecoveryPrompt] = useState(false);
  const [escalateForm, setEscalateForm] = useState({
    escalation_reason: "",
    extra_recipients: "",
  });
  const [recoveryForm, setRecoveryForm] = useState({
    recovery_status: "Planned",
    recovery_note: "",
    recovery_target_date: "",
    recovery_amount: "",
  });
  // Revise committed baseline (Phase 3, actuals already exist) — inputs are the
  // NEW proposed values; for Sourcing/Technical Productivity this is the real
  // STP price/quantity/bonus fields (recomputed through the same formula engine
  // as everywhere else); for Negotiation/Cash (no price/quantity breakdown) it's
  // the flat revised annual saving.
  const isStpType = ["Sourcing", "Technical Productivity"].includes(
    opp.opportunity_type ?? "",
  );
  const [showRevise, setShowRevise] = useState(false);
  const emptyReviseForm = {
    note: "",
    revised_saving: "",
    current_price: "",
    proposed_price: "",
    current_price_n1: "",
    current_price_n2: "",
    current_price_n3: "",
    proposed_price_n1: "",
    proposed_price_n2: "",
    proposed_price_n3: "",
    annual_quantity_n1: "",
    annual_quantity_n2: "",
    annual_quantity_n3: "",
    annual_quantity_n4: "",
    bonus_before: "",
    bonus_after: "",
  };
  const [reviseForm, setReviseForm] = useState(emptyReviseForm);
  const reviseHasStpChange = Object.entries(reviseForm).some(
    ([k, v]) => k !== "note" && k !== "revised_saving" && v.trim() !== "",
  );

  // FinancialLine/MonthlyFinancial amounts are stored in the opportunity's
  // native currency (no FX conversion applied at this level — see
  // _create_financial_line / _ensure_monthly_rows on the backend), so this
  // tab must format with opp.currency, not fmt()'s "EUR" default.
  const fmtC = (n?: number | null) => fmt(n, opp.currency || "EUR");

  const phaseCtx =
    FINANCIAL_PHASE_CONTEXT[opp.phase_status ?? ""] ??
    FINANCIAL_PHASE_CONTEXT["Phase 3"];
  const isOwner =
    (opp.conversion_owner ?? "").trim().toLowerCase() ===
    userEmail.trim().toLowerCase();
  // Revise Baseline is restricted to purchasing_director/vp_conversion on the
  // backend (_PRIVILEGED, no ownership check) — mirror that here rather than
  // gating on isOwner, otherwise a non-owner PD/VP wouldn't see the button at
  // all, while an owner who isn't PD/VP would see it and get a 403.
  const { user } = useAuth();
  // Purchasing Director / VP Conversion may enter and overwrite real savings on
  // any opportunity, not just the ones they own — mirrors the backend, where
  // _PRIVILEGED clears both the first-entry (_NON_VIEWER) and overwrite checks
  // on PUT /monthly/{id}.
  const isPrivileged =
    user?.access_profile === "purchasing_director" ||
    user?.access_profile === "vp_conversion";
  const canReviseBaseline = isPrivileged;
  // Mirror the backend rule: actuals are editable while the financial line is Active
  // and the opportunity has reached execution (Phase 3+), including Phase 4 (LLC) and
  // closure-period realization — not only during Phase 3.
  // Editable by the conversion owner OR a privileged role (PD / VP Conversion).
  const canEditFinancialRows =
    (isOwner || isPrivileged) &&
    opp.financial_lines[0]?.status === "Active" &&
    !["Assigned", "Phase 0", "Phase 1", "Phase 2"].includes(
      opp.phase_status ?? "",
    );
  const todayFirstOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  );
  const inp =
    "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

  if (!opp.financial_lines.length) {
    return (
      <div className="py-12 text-center">
        <BarChart2 size={28} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-slate-500 font-semibold">
          No financial line yet
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Created automatically when Phase 2 is validated (Go to deployment).
        </p>
      </div>
    );
  }

  const isBudgeted = opp.validation_status === "Budgeted";

  // One financial line per opportunity (Olivier: one STP = one opportunity = one financial line)
  const line = opp.financial_lines[0];
  const rows = [...(line?.monthly_financials ?? [])].sort((a, b) =>
    (a.period_month ?? "").localeCompare(b.period_month ?? ""),
  );
  const isCompleted = line?.status === "Completed";
  const convRate =
    line?.expected_annual_saving && toNum(line.cumulated_real_saving) > 0
      ? Math.round(
          (toNum(line.cumulated_real_saving) /
            toNum(line.expected_annual_saving)) *
            100,
        )
      : null;

  // Gap 1 — Year split: aggregate monthly rows by calendar year.
  // Expected uses the same exact-day prorata as the Budgeting page
  // (opp.budget_years[].applicable_amount) when available, so the two screens
  // agree — the monthly profile below is whole-month (lands on day 1) and would
  // otherwise show a different figure for the anchor year. Falls back to summing
  // the monthly rows for years the budgeting module hasn't produced yet.
  const budgetYearExpected: Record<number, number> = {};
  (opp.budget_years ?? []).forEach((by) => {
    if (by.applicable_amount != null) {
      budgetYearExpected[by.fiscal_year] = toNum(by.applicable_amount);
    }
  });
  const yearBreakdown = rows.reduce<
    Record<number, { expected: number; actual: number }>
  >((acc, row) => {
    if (!row.period_month) return acc;
    const yr = new Date(row.period_month).getFullYear();
    if (!acc[yr])
      acc[yr] = {
        expected: budgetYearExpected[yr] ?? 0,
        actual: 0,
      };
    if (budgetYearExpected[yr] == null)
      acc[yr].expected += toNum(row.expected_saving);
    if (row.actual_saving != null) acc[yr].actual += toNum(row.actual_saving);
    return acc;
  }, {});
  const yearEntries = Object.entries(yearBreakdown).sort(
    ([a], [b]) => Number(a) - Number(b),
  );

  // Cash tracking is visible whenever the opportunity carries a cash_impact —
  // any opportunity type can have one (not just Negotiation), so this checks
  // the actual data rather than opportunity_type.
  const showCash =
    opp.cash_impact != null || rows.some((r) => r.cash_expected != null);
  // cash_impact is a one-shot booked entirely into a single month (see backend
  // _one_shot_cash_ideals) — that's the one row with cash_expected set.
  const cashRow = rows.find((r) => r.cash_expected != null) ?? null;

  async function saveCashReceived(e: React.FormEvent) {
    e.preventDefault();
    if (!cashRow) return;
    setLoading(true);
    setError(null);
    try {
      await supplierAPI.updateMonthlyActual(cashRow.monthly_financial_id, {
        cash_actual: cashAmount ? parseFloat(cashAmount) : undefined,
        updated_by: userEmail,
      });
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
      setShowCashEntry(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveRow(monthId: number) {
    if (!canEditFinancialRows) {
      setError(
        "Monthly actuals can only be edited while the financial line is Active and the opportunity has reached execution (Phase 3+).",
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await supplierAPI.updateMonthlyActual(monthId, {
        actual_saving: rowForm.actual_saving
          ? parseFloat(rowForm.actual_saving)
          : undefined,
        cash_actual: rowForm.cash_actual
          ? parseFloat(rowForm.cash_actual)
          : undefined,
        forecast_eoy_saving: rowForm.forecast_eoy_saving
          ? parseFloat(rowForm.forecast_eoy_saving)
          : undefined,
        forecast_comment: rowForm.forecast_comment || undefined,
        comment: rowForm.comment || undefined,
        monthly_outcome: rowForm.monthly_outcome || undefined,
        updated_by: userEmail,
      });
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
      setEditRow(null);
      // Auto-prompt recovery form when outcome = Recover and no plan yet
      if (rowForm.monthly_outcome === "Recover") {
        const updatedLine = (res.data as Opp).financial_lines[0];
        if (
          !updatedLine?.recovery_status ||
          updatedLine.recovery_status === "Done"
        ) {
          setPendingRecoveryPrompt(true);
          setShowRecovery(true);
          setShowEscalate(false);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleEscalate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const extra = escalateForm.extra_recipients
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await supplierAPI.escalateFinancialLine(line.financial_line_id, {
        escalation_reason: escalateForm.escalation_reason,
        escalated_by: userEmail,
        extra_recipients: extra.length ? extra : undefined,
      });
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
      setShowEscalate(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Escalation failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeescalate() {
    setLoading(true);
    setError(null);
    try {
      await supplierAPI.deescalateFinancialLine(line.financial_line_id);
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await supplierAPI.setRecovery(line.financial_line_id, {
        recovery_status: recoveryForm.recovery_status,
        recovery_note: recoveryForm.recovery_note || undefined,
        recovery_target_date: recoveryForm.recovery_target_date || undefined,
        recovery_amount: recoveryForm.recovery_amount
          ? parseFloat(recoveryForm.recovery_amount)
          : undefined,
        updated_by: userEmail,
      });
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
      setShowRecovery(false);
      setPendingRecoveryPrompt(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    setLoading(true);
    setError(null);
    try {
      await supplierAPI.completeFinancialLine(line.financial_line_id, {
        completed_by: userEmail,
      });
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveRevision(e: React.FormEvent) {
    e.preventDefault();
    if (!reviseForm.note.trim()) {
      setError("Reason for revision is required for audit trail.");
      return;
    }
    if (isStpType) {
      if (!reviseHasStpChange) {
        setError("Enter at least one new value (price, quantity or bonus).");
        return;
      }
    } else if (
      !reviseForm.revised_saving ||
      parseFloat(reviseForm.revised_saving) <= 0
    ) {
      setError("Enter a valid revised saving.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await supplierAPI.reviseFinancialLineBaseline(line.financial_line_id, {
        note: reviseForm.note.trim(),
        revised_by: userEmail,
        revised_saving: reviseForm.revised_saving
          ? parseFloat(reviseForm.revised_saving)
          : undefined,
        current_price: reviseForm.current_price
          ? parseFloat(reviseForm.current_price)
          : undefined,
        proposed_price: reviseForm.proposed_price
          ? parseFloat(reviseForm.proposed_price)
          : undefined,
        current_price_n1: reviseForm.current_price_n1
          ? parseFloat(reviseForm.current_price_n1)
          : undefined,
        current_price_n2: reviseForm.current_price_n2
          ? parseFloat(reviseForm.current_price_n2)
          : undefined,
        current_price_n3: reviseForm.current_price_n3
          ? parseFloat(reviseForm.current_price_n3)
          : undefined,
        proposed_price_n1: reviseForm.proposed_price_n1
          ? parseFloat(reviseForm.proposed_price_n1)
          : undefined,
        proposed_price_n2: reviseForm.proposed_price_n2
          ? parseFloat(reviseForm.proposed_price_n2)
          : undefined,
        proposed_price_n3: reviseForm.proposed_price_n3
          ? parseFloat(reviseForm.proposed_price_n3)
          : undefined,
        annual_quantity_n1: reviseForm.annual_quantity_n1
          ? parseInt(reviseForm.annual_quantity_n1)
          : undefined,
        annual_quantity_n2: reviseForm.annual_quantity_n2
          ? parseInt(reviseForm.annual_quantity_n2)
          : undefined,
        annual_quantity_n3: reviseForm.annual_quantity_n3
          ? parseInt(reviseForm.annual_quantity_n3)
          : undefined,
        annual_quantity_n4: reviseForm.annual_quantity_n4
          ? parseInt(reviseForm.annual_quantity_n4)
          : undefined,
        bonus_before: reviseForm.bonus_before
          ? parseFloat(reviseForm.bonus_before)
          : undefined,
        bonus_after: reviseForm.bonus_after
          ? parseFloat(reviseForm.bonus_after)
          : undefined,
      });
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
      setShowRevise(false);
      setReviseForm(emptyReviseForm);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Revision failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Phase context banner */}
      <div
        className={`rounded-xl border px-4 py-3 text-xs border-${phaseCtx.color}-100 bg-${phaseCtx.color}-50`}
      >
        <p
          className={`font-bold text-${phaseCtx.color}-700 flex items-center gap-1.5`}
        >
          <span
            className={`rounded-full bg-${phaseCtx.color}-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-${phaseCtx.color}-800`}
          >
            {opp.phase_status}
          </span>
          {phaseCtx.title}
        </p>
        <p className={`mt-1 text-${phaseCtx.color}-600`}>{phaseCtx.guidance}</p>
        {!isOwner && !isPrivileged && (
          <p className={`mt-2 font-semibold text-${phaseCtx.color}-700`}>
            Read-only — you are not the conversion owner for this opportunity.
          </p>
        )}
        {(isOwner || isPrivileged) && !canEditFinancialRows && (
          <p className={`mt-2 font-semibold text-${phaseCtx.color}-700`}>
            Monthly actuals are editable once the line is active and the
            opportunity reaches deployment (Phase 3+).
          </p>
        )}
      </div>

      {/* Revise baseline saving — only in Phase 3 once the real start is set and the
          monthly grid exists (rebuild preserves entered actuals). Not available before
          rows exist; adjust the estimate on the opportunity form in earlier phases.
          Restricted to purchasing_director/vp_conversion, not opportunity ownership. */}
      {canReviseBaseline &&
        REVISE_BASELINE_ENABLED &&
        opp.phase_status === "Phase 3" &&
        opp.real_start_date &&
        rows.length > 0 &&
        !isCompleted && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blue-700">
                  Revise Baseline Saving
                </p>
                <p className="text-[11px] text-blue-500 mt-0.5">
                  Current baseline:{" "}
                  <strong>{fmtC(line.expected_annual_saving)}/year</strong> ·
                  Budget: <strong>{fmtC(line.budget_value)}/year</strong>{" "}
                  (locked)
                </p>
                <p className="text-[10px] text-blue-400 mt-0.5">
                  {opp.phase_status === "Phase 3"
                    ? "Deployment started — revise the expected saving if the actual trajectory differs. Monthly profile will rebuild from the deployment start date."
                    : "If the committee validated a revised figure, enter it here. Monthly expected profile will rebuild. Budget value stays unchanged."}
                </p>
              </div>
              <button
                onClick={() => setShowRevise((s) => !s)}
                className="ml-3 shrink-0 text-[11px] font-semibold text-blue-600 hover:underline"
              >
                {showRevise ? "Cancel" : "Revise →"}
              </button>
            </div>
            {showRevise && (
              <form onSubmit={saveRevision} className="mt-4 space-y-3">
                {isStpType ? (
                  (() => {
                    const revInp =
                      "w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
                    const revLabel =
                      "mb-1 block text-[10.5px] font-semibold text-slate-600";
                    const setRev = (k: keyof typeof reviseForm, v: string) =>
                      setReviseForm((f) => ({ ...f, [k]: v }));
                    const priceField = (
                      key: keyof typeof reviseForm,
                      label: string,
                      current: unknown,
                    ) => (
                      <div key={key}>
                        <label className={revLabel}>{label}</label>
                        <input
                          type="number"
                          step="0.0001"
                          className={revInp}
                          placeholder={
                            current != null
                              ? `Current: ${current}`
                              : "New value"
                          }
                          value={reviseForm[key]}
                          onChange={(e) => setRev(key, e.target.value)}
                        />
                      </div>
                    );
                    const qtyField = (
                      key: keyof typeof reviseForm,
                      label: string,
                      current: unknown,
                    ) => (
                      <div key={key}>
                        <label className={revLabel}>{label}</label>
                        <input
                          type="number"
                          step="1"
                          className={revInp}
                          placeholder={
                            current != null
                              ? `Current: ${current}`
                              : "New value"
                          }
                          value={reviseForm[key]}
                          onChange={(e) => setRev(key, e.target.value)}
                        />
                      </div>
                    );
                    return (
                      <div className="space-y-2">
                        <p className="text-[10.5px] text-slate-500">
                          Enter only the values that changed — leave the rest
                          blank. Expected saving, ROI and cash impact recompute
                          automatically from these.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {priceField(
                            "current_price",
                            "Current Price (Year N)",
                            opp.current_price,
                          )}
                          {priceField(
                            "proposed_price",
                            "Proposed Price (Year N)",
                            opp.proposed_price,
                          )}
                          {priceField(
                            "proposed_price_n1",
                            "Proposed Price N+1",
                            opp.proposed_price_n1,
                          )}
                          {priceField(
                            "proposed_price_n2",
                            "Proposed Price N+2",
                            opp.proposed_price_n2,
                          )}
                          {priceField(
                            "proposed_price_n3",
                            "Proposed Price N+3",
                            opp.proposed_price_n3,
                          )}
                          {qtyField(
                            "annual_quantity_n1",
                            "Qty Year N",
                            opp.annual_quantity_n1,
                          )}
                          {qtyField(
                            "annual_quantity_n2",
                            "Qty Year N+1",
                            opp.annual_quantity_n2,
                          )}
                          {qtyField(
                            "annual_quantity_n3",
                            "Qty Year N+2",
                            opp.annual_quantity_n3,
                          )}
                          {qtyField(
                            "annual_quantity_n4",
                            "Qty Year N+3",
                            opp.annual_quantity_n4,
                          )}
                          {priceField(
                            "bonus_before",
                            "Bonus Before",
                            opp.bonus_before,
                          )}
                          {priceField(
                            "bonus_after",
                            "Bonus After",
                            opp.bonus_after,
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div>
                    <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                      Revised Annual Saving (€) *
                    </label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      className={inp}
                      placeholder={line.expected_annual_saving?.toString()}
                      value={reviseForm.revised_saving}
                      onChange={(e) =>
                        setReviseForm((f) => ({
                          ...f,
                          revised_saving: e.target.value,
                        }))
                      }
                    />
                    {reviseForm.revised_saving &&
                      line.expected_annual_saving && (
                        <p
                          className={`text-[10px] mt-0.5 ${parseFloat(reviseForm.revised_saving) < Number(line.expected_annual_saving) ? "text-amber-600" : "text-emerald-600"}`}
                        >
                          {parseFloat(reviseForm.revised_saving) <
                          Number(line.expected_annual_saving)
                            ? "▼"
                            : "▲"}{" "}
                          Change: €
                          {Math.abs(
                            parseFloat(reviseForm.revised_saving) -
                              Number(line.expected_annual_saving),
                          ).toLocaleString("en-GB")}
                        </p>
                      )}
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                    Reason for revision *
                  </label>
                  <input
                    required
                    className={inp}
                    placeholder="e.g. Supplier renegotiated price mid-contract"
                    value={reviseForm.note}
                    onChange={(e) =>
                      setReviseForm((f) => ({ ...f, note: e.target.value }))
                    }
                  />
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-[10.5px] text-amber-700">
                  ⚠ Every actual already entered is preserved — only the
                  remaining (not-yet-realized) months are rebuilt from the
                  corrected baseline.
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {loading && <RefreshCw size={12} className="animate-spin" />}{" "}
                  Confirm Revision
                </button>
              </form>
            )}
          </div>
        )}

      {/* Revision history — permanent audit trail of every committed-baseline
          correction (never trimmed/rewritten). */}
      {opp.revision_history != null && opp.revision_history.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
          <p className="text-xs font-bold text-slate-600">
            Baseline Revision History
          </p>
          <div className="space-y-2">
            {[...opp.revision_history].reverse().map((entry, i) => {
              const e = entry as Record<string, unknown>;
              const prevComputed =
                (e.previous_computed as Record<string, unknown>) || {};
              const newComputed =
                (e.new_computed as Record<string, unknown>) || {};
              return (
                <div
                  key={i}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px]"
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <span>
                      {e.revised_at
                        ? new Date(String(e.revised_at)).toLocaleString("en-GB")
                        : "—"}{" "}
                      · <strong>{String(e.revised_by ?? "unknown")}</strong>
                    </span>
                  </div>
                  {typeof e.note === "string" && e.note && (
                    <p className="mt-0.5 italic text-slate-600">"{e.note}"</p>
                  )}
                  <p className="mt-1 text-slate-600">
                    Annual saving: €
                    {Number(
                      prevComputed.expected_annual_saving ?? 0,
                    ).toLocaleString("en-GB")}{" "}
                    →{" "}
                    <strong>
                      €
                      {Number(
                        newComputed.expected_annual_saving ?? 0,
                      ).toLocaleString("en-GB")}
                    </strong>
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Escalation banner */}
      {line.is_escalated && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-bold text-red-700">
              <AlertTriangle size={13} /> Escalated
              {line.escalated_at && (
                <span className="text-xs font-normal text-red-400">
                  — {fmtDate(line.escalated_at)}
                </span>
              )}
            </p>
            {line.escalation_reason && (
              <p className="mt-0.5 text-xs text-red-600">
                {line.escalation_reason}
              </p>
            )}
          </div>
          <button
            onClick={handleDeescalate}
            disabled={loading}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
          >
            De-escalate
          </button>
        </div>
      )}

      {/* Recovery banner */}
      {line.recovery_status && line.recovery_status !== "Done" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-bold text-amber-700">
              <RefreshCw size={13} /> Recovery: {line.recovery_status}
            </p>
            <div className="flex items-center gap-3 text-[11px] text-amber-600">
              {line.recovery_amount != null && (
                <span>
                  Target: <strong>{fmtC(line.recovery_amount)}</strong>
                </span>
              )}
              {line.recovery_target_date && (
                <span>
                  By: <strong>{fmtDate(line.recovery_target_date)}</strong>
                </span>
              )}
            </div>
          </div>
          {line.recovery_note && (
            <p className="text-xs text-amber-600">{line.recovery_note}</p>
          )}
        </div>
      )}

      {/* One financial line per opportunity — as per Olivier's process */}

      {/* Gap 1 — Year split KPI */}
      {yearEntries.length > 1 && (
        <div className="rounded-xl border border-slate-100 bg-white p-3">
          <p
            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2"
            title="Expected matches the Budgeting page's exact-day prorata; Actual is summed from monthly entries."
          >
            Year-by-Year Breakdown
          </p>
          <div className="flex gap-4 flex-wrap">
            {yearEntries.map(([yr, d]) => {
              const rate =
                d.expected > 0
                  ? Math.round((d.actual / d.expected) * 100)
                  : null;
              return (
                <div
                  key={yr}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 min-w-[120px]"
                >
                  <p className="text-[10px] font-bold text-slate-500 mb-1">
                    {yr}
                  </p>
                  <div className="space-y-0.5 text-[11px]">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-400">Expected</span>
                      <span className="font-semibold">{fmt(d.expected)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-400">Actual</span>
                      <span
                        className={`font-bold ${d.actual >= d.expected ? "text-emerald-600" : d.actual > 0 ? "text-amber-600" : "text-slate-300"}`}
                      >
                        {d.actual > 0 ? fmt(d.actual) : "—"}
                      </span>
                    </div>
                    {rate != null && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-400">Rate</span>
                        <span
                          className={`font-bold ${rate >= 100 ? "text-emerald-600" : rate >= 75 ? "text-amber-600" : "text-red-500"}`}
                        >
                          {rate}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI header */}
      <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs">
        <div>
          <span className="block font-semibold text-slate-400">
            {["Sourcing", "Technical Productivity"].includes(
              opp.opportunity_type ?? "",
            )
              ? "Expected (period total)"
              : "Expected Annual"}
          </span>
          <p className="font-bold text-slate-800">
            {fmtC(line.expected_annual_saving)}
          </p>
        </div>
        <div>
          <span className="block font-semibold text-slate-400">
            Actual (cumulative, all-time)
          </span>
          <p
            className={`font-bold ${(line.cumulated_real_saving ?? 0) >= (line.expected_annual_saving ?? Infinity) ? "text-emerald-700" : "text-slate-800"}`}
          >
            {fmtC(line.cumulated_real_saving)}
          </p>
        </div>
        <div>
          <span className="block font-semibold text-slate-400">
            EOY Forecast
          </span>
          <p className="font-bold text-blue-700">
            {fmtC(line.forecast_eoy_current)}
          </p>
        </div>
        <div>
          <span className="block font-semibold text-slate-400">Delta YTD</span>
          <p
            className={`font-bold ${(line.delta_vs_expected_ytd ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}
          >
            {fmtC(line.delta_vs_expected_ytd)}
          </p>
        </div>
        {line.pacing_status && (
          <div>
            <span className="block font-semibold text-slate-400">Pacing</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                line.pacing_status === "Late"
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {line.pacing_status}
            </span>
          </div>
        )}
        <div>
          <span className="block font-semibold text-slate-400">
            Conversion Rate
          </span>
          <p
            className={`font-bold ${convRate == null ? "text-slate-400" : convRate >= 100 ? "text-emerald-600" : convRate >= 75 ? "text-amber-600" : "text-red-600"}`}
          >
            {convRate != null ? `${convRate}%` : "—"}
          </p>
        </div>
        <div>
          <span className="block font-semibold text-slate-400">Status</span>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${line.status === "Active" ? "bg-emerald-100 text-emerald-700" : line.status === "Completed" ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-600"}`}
          >
            {line.status ?? "—"}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      {!isCompleted && (
        <div className="flex flex-wrap gap-2">
          {!line.is_escalated && (
            <button
              onClick={() => {
                setShowEscalate(true);
                setShowRecovery(false);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              <AlertTriangle size={11} /> Escalate
            </button>
          )}
          <button
            onClick={() => {
              setRecoveryForm({
                recovery_status: line.recovery_status ?? "Planned",
                recovery_note: line.recovery_note ?? "",
                recovery_target_date: line.recovery_target_date ?? "",
                recovery_amount: line.recovery_amount?.toString() ?? "",
              });
              setShowRecovery(true);
              setShowEscalate(false);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
          >
            <RefreshCw size={11} />{" "}
            {line.recovery_status ? "Update Recovery" : "Set Recovery Plan"}
          </button>
          {["Phase 3", "Phase 4"].includes(opp.phase_status ?? "") && (
            <button
              onClick={handleComplete}
              disabled={loading}
              className="ml-auto flex items-center gap-1.5 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100"
            >
              <CheckCircle2 size={11} /> Mark Complete
            </button>
          )}
        </div>
      )}

      {/* Escalation form */}
      {showEscalate && (
        <form
          onSubmit={handleEscalate}
          className="space-y-3 rounded-xl border border-red-200 bg-red-50/50 p-4"
        >
          <p className="flex items-center gap-1.5 text-xs font-bold text-red-700">
            <AlertTriangle size={11} /> Escalation — will alert Purchasing owner
            by email
          </p>
          <div>
            <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
              Reason *
            </label>
            <textarea
              required
              rows={3}
              className="w-full resize-none rounded-xl border border-red-200 bg-white px-3 py-2 text-sm outline-none"
              value={escalateForm.escalation_reason}
              onChange={(e) =>
                setEscalateForm((f) => ({
                  ...f,
                  escalation_reason: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
              Extra recipients (comma-separated, optional)
            </label>
            <input
              className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="ceo@avocarbon.com, plant.manager@..."
              value={escalateForm.extra_recipients}
              onChange={(e) =>
                setEscalateForm((f) => ({
                  ...f,
                  extra_recipients: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {loading && <RefreshCw size={11} className="animate-spin" />}{" "}
              Confirm Escalation
            </button>
            <button
              type="button"
              onClick={() => setShowEscalate(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Recovery form */}
      {showRecovery && (
        <form
          onSubmit={handleRecovery}
          className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4"
        >
          <div className="flex items-start justify-between">
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
              <RefreshCw size={11} /> Recovery Plan
            </p>
            {pendingRecoveryPrompt && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                You selected Recover — fill in your plan below
              </span>
            )}
          </div>

          {/* Delta YTD context — show current gap so user knows what to recover */}
          {line.delta_vs_expected_ytd != null && (
            <div className="flex items-center gap-4 rounded-lg bg-white border border-amber-100 px-3 py-2 text-xs">
              <div>
                <span className="text-slate-400">Current gap (Delta YTD) </span>
                <span
                  className={`font-bold ${(line.delta_vs_expected_ytd ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}`}
                >
                  {fmtC(line.delta_vs_expected_ytd)}
                </span>
              </div>
              {(line.delta_vs_expected_ytd ?? 0) < 0 && (
                <button
                  type="button"
                  className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-200"
                  onClick={() =>
                    setRecoveryForm((f) => ({
                      ...f,
                      recovery_amount: Math.abs(
                        line.delta_vs_expected_ytd ?? 0,
                      ).toString(),
                    }))
                  }
                >
                  Use as amount ↗
                </button>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                Status *
              </label>
              <select
                required
                className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none"
                value={recoveryForm.recovery_status}
                onChange={(e) =>
                  setRecoveryForm((f) => ({
                    ...f,
                    recovery_status: e.target.value,
                  }))
                }
              >
                <option>Planned</option>
                <option>In Progress</option>
                <option>Done</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                Target recovery date
              </label>
              <input
                type="date"
                className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none"
                value={recoveryForm.recovery_target_date}
                onChange={(e) =>
                  setRecoveryForm((f) => ({
                    ...f,
                    recovery_target_date: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
              Amount to recover (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="e.g. 5000"
              value={recoveryForm.recovery_amount}
              onChange={(e) =>
                setRecoveryForm((f) => ({
                  ...f,
                  recovery_amount: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
              Recovery note — what will you do to catch up?
            </label>
            <textarea
              rows={3}
              className="w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="e.g. Renegotiate volume commitment to recover Q3 gap by November…"
              value={recoveryForm.recovery_note}
              onChange={(e) =>
                setRecoveryForm((f) => ({
                  ...f,
                  recovery_note: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {loading && <RefreshCw size={11} className="animate-spin" />} Save
              Recovery Plan
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRecovery(false);
                setPendingRecoveryPrompt(false);
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
            >
              {pendingRecoveryPrompt ? "Skip for now" : "Cancel"}
            </button>
          </div>

          {/* History timeline */}
          {line.recovery_history && (
            <div className="border-t border-amber-100 pt-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                History
              </p>
              {line.recovery_history
                .split("\n")
                .filter(Boolean)
                .reverse()
                .map((entry, i) => (
                  <p
                    key={i}
                    className="text-[10.5px] text-slate-500 font-mono leading-relaxed"
                  >
                    {entry}
                  </p>
                ))}
            </div>
          )}
        </form>
      )}

      {/* Line exists but no tracking grid yet — rows are built from the real start. */}
      {rows.length === 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-center">
          <p className="text-xs font-semibold text-blue-700">
            No monthly tracking rows yet
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Enter the <strong>Real Start Date</strong> in deployment (Phase 3)
            to generate the monthly grid. Rows are built once, from the date
            savings actually start flowing — there is no rebuild.
          </p>
        </div>
      )}

      {/* Phase 0/1: show expected profile as read-only preview, no actuals entry */}
      {rows.length > 0 && !phaseCtx.showActuals && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
          <p className="text-xs font-semibold text-slate-500">
            Expected Monthly Profile (read-only)
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Actuals entry starts in Phase 2 once implementation begins.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {rows.map((row) => {
              const rowDate = row.period_month
                ? new Date(row.period_month)
                : null;
              return (
                <div
                  key={row.monthly_financial_id}
                  className="rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 text-center min-w-[60px]"
                >
                  <p className="text-[9.5px] font-semibold text-slate-400">
                    {rowDate
                      ? rowDate.toLocaleDateString("en-GB", {
                          month: "short",
                          year: "2-digit",
                        })
                      : "?"}
                  </p>
                  <p className="text-[11px] font-bold text-slate-600">
                    {fmtC(row.expected_saving)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cash Impact — one-shot record, not a monthly grid. The rare case of cash
          trickling in over several months is still handled by editing each
          month's "Cash Act." cell directly in the table below. */}
      {showCash && cashRow && phaseCtx.showActuals && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-amber-700">
                Cash Impact — one-time
              </p>
              <p className="text-[11px] text-amber-600 mt-0.5">
                Target: <strong>{fmtC(cashRow.cash_expected)}</strong>
                {cashRow.cash_actual != null && (
                  <>
                    {" "}
                    · Achieved: <strong>{fmtC(cashRow.cash_actual)}</strong>
                  </>
                )}
                {cashRow.period_month && (
                  <>
                    {" "}
                    (
                    {new Date(cashRow.period_month).toLocaleDateString(
                      "en-GB",
                      { month: "short", year: "numeric" },
                    )}
                    )
                  </>
                )}
              </p>
            </div>
            {canEditFinancialRows && (
              <button
                type="button"
                onClick={() => {
                  setCashAmount(
                    cashRow.cash_actual?.toString() ??
                      cashRow.cash_expected?.toString() ??
                      "",
                  );
                  setShowCashEntry((s) => !s);
                }}
                className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
              >
                {cashRow.cash_actual != null ? "Update" : "Record"} Cash
                Received →
              </button>
            )}
          </div>
          {showCashEntry && (
            <form
              onSubmit={saveCashReceived}
              className="mt-3 flex flex-wrap items-end gap-2"
            >
              <div>
                <label className="mb-1 block text-[10.5px] font-semibold text-amber-700">
                  Amount received ({opp.currency || "EUR"})
                </label>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  className="w-40 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-100"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {loading && (
                  <RefreshCw size={11} className="mr-1 inline animate-spin" />
                )}
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowCashEntry(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600"
              >
                Cancel
              </button>
            </form>
          )}
          <p className="mt-2 text-[10px] text-amber-500">
            Exceptional case: if this cash is actually realized gradually across
            several months instead of at once, edit the "Cash Act." cell for
            each month directly in the table below.
          </p>
        </div>
      )}

      {/* Monthly table — Phase 2+ only */}
      {phaseCtx.showActuals && (
        <div className="scroll-x-visible rounded-xl border border-slate-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500">
                <th className="px-3 py-2 font-semibold">Month</th>
                <th className="px-3 py-2 text-right font-semibold">Expected</th>
                <th className="px-3 py-2 text-right font-semibold">Actual</th>
                <th className="px-3 py-2 text-right font-semibold">Delta</th>
                <th className="px-3 py-2 text-right font-semibold">Cum.</th>
                <th className="px-3 py-2 text-right font-semibold">EOY Fcst</th>
                {showCash && (
                  <th className="px-3 py-2 text-right font-semibold text-amber-600">
                    Cash Exp.
                  </th>
                )}
                {showCash && (
                  <th className="px-3 py-2 text-right font-semibold text-amber-600">
                    Cash Act.
                  </th>
                )}
                <th className="px-3 py-2 font-semibold">Outcome</th>
                <th
                  className="px-3 py-2 font-semibold text-blue-600"
                  title="Why did the EOY forecast change?"
                >
                  Forecast note
                </th>
                <th
                  className="px-3 py-2 font-semibold"
                  title="What happened this month?"
                >
                  Monthly note
                </th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isEdit = editRow === row.monthly_financial_id;
                const rowDate = row.period_month
                  ? new Date(row.period_month)
                  : null;
                const isPast = rowDate != null && rowDate < todayFirstOfMonth;
                const isMissing = isPast && row.actual_saving == null;
                const delta = row.delta_vs_expected;
                const monthLabel = rowDate
                  ? rowDate.toLocaleDateString("en-GB", {
                      month: "short",
                      year: "2-digit",
                    })
                  : "—";
                const outcomeCfg = row.monthly_outcome
                  ? OUTCOME_CONFIG[row.monthly_outcome]
                  : null;
                const rowBg = isEdit
                  ? "bg-blue-50"
                  : isMissing
                    ? "bg-red-50/40"
                    : row.monthly_outcome === "Recover"
                      ? "bg-amber-50/50"
                      : row.monthly_outcome === "Escalate"
                        ? "bg-red-50/30"
                        : "hover:bg-slate-50/60";
                return (
                  <tr
                    key={row.monthly_financial_id}
                    className={`border-t border-slate-50 ${rowBg}`}
                  >
                    <td className="px-3 py-2">
                      <span className="font-semibold text-slate-700">
                        {monthLabel}
                      </span>
                      {isMissing && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-red-100 px-1 py-0.5 text-[9px] font-bold text-red-600">
                          <AlertTriangle size={8} />
                          Missing
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      {fmtC(row.expected_saving)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">
                      {isEdit ? (
                        <input
                          type="number"
                          step="0.01"
                          className="w-24 rounded border border-blue-300 px-1.5 py-1 text-xs"
                          value={rowForm.actual_saving}
                          onChange={(e) =>
                            setRowForm((f) => ({
                              ...f,
                              actual_saving: e.target.value,
                            }))
                          }
                          placeholder="0"
                        />
                      ) : row.actual_saving != null ? (
                        fmtC(row.actual_saving)
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold ${delta == null ? "text-slate-300" : delta >= 0 ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {delta == null ? "—" : fmtC(delta)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {row.cumulated_actual != null
                        ? fmtC(row.cumulated_actual)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-blue-700">
                      {isEdit ? (
                        <div>
                          <input
                            type="number"
                            step="0.01"
                            min={row.cumulated_actual ?? 0}
                            className={`w-24 rounded border px-1.5 py-1 text-xs ${
                              rowForm.forecast_eoy_saving &&
                              row.cumulated_actual != null &&
                              parseFloat(rowForm.forecast_eoy_saving) <
                                row.cumulated_actual
                                ? "border-red-400 bg-red-50"
                                : "border-blue-300"
                            }`}
                            value={rowForm.forecast_eoy_saving}
                            onChange={(e) =>
                              setRowForm((f) => ({
                                ...f,
                                forecast_eoy_saving: e.target.value,
                              }))
                            }
                            placeholder="0"
                          />
                          {rowForm.forecast_eoy_saving &&
                            row.cumulated_actual != null &&
                            parseFloat(rowForm.forecast_eoy_saving) <
                              row.cumulated_actual && (
                              <p className="text-[9px] text-red-500 mt-0.5 w-24">
                                Must be ≥ {fmtC(row.cumulated_actual)}
                              </p>
                            )}
                        </div>
                      ) : row.forecast_eoy_saving != null ? (
                        fmtC(row.forecast_eoy_saving)
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    {/* Gap 3 — cash columns */}
                    {showCash && (
                      <td className="px-3 py-2 text-right text-amber-600 text-[11px]">
                        {row.cash_expected != null
                          ? fmtC(row.cash_expected)
                          : "—"}
                      </td>
                    )}
                    {showCash && (
                      <td className="px-3 py-2 text-right text-amber-700 font-semibold text-[11px]">
                        {isEdit ? (
                          <input
                            type="number"
                            step="0.01"
                            className="w-20 rounded border border-amber-300 px-1.5 py-1 text-xs"
                            value={rowForm.cash_actual ?? ""}
                            onChange={(e) =>
                              setRowForm((f) => ({
                                ...f,
                                cash_actual: e.target.value,
                              }))
                            }
                            placeholder="0"
                          />
                        ) : row.cash_actual != null ? (
                          fmtC(row.cash_actual)
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {isEdit ? (
                        <select
                          className="rounded border border-blue-300 px-1.5 py-1 text-xs"
                          value={rowForm.monthly_outcome}
                          onChange={(e) =>
                            setRowForm((f) => ({
                              ...f,
                              monthly_outcome: e.target.value,
                            }))
                          }
                        >
                          <option>Continue</option>
                          <option>Recover</option>
                          <option>Escalate</option>
                        </select>
                      ) : outcomeCfg ? (
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${outcomeCfg.color}`}
                          >
                            {outcomeCfg.label}
                          </span>
                          {row.monthly_outcome === "Recover" &&
                            line.recovery_status && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[8.5px] font-semibold ${
                                  line.recovery_status === "Done"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : line.recovery_status === "In Progress"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                Plan: {line.recovery_status}
                              </span>
                            )}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    {/* Forecast note — why did EOY forecast change? */}
                    <td
                      className="max-w-[120px] truncate px-3 py-2 text-blue-500 text-[11px]"
                      title={row.forecast_comment || ""}
                    >
                      {isEdit ? (
                        <input
                          className="w-28 rounded border border-blue-300 px-1.5 py-1 text-xs"
                          value={rowForm.forecast_comment}
                          onChange={(e) =>
                            setRowForm((f) => ({
                              ...f,
                              forecast_comment: e.target.value,
                            }))
                          }
                          placeholder="Why forecast changed…"
                        />
                      ) : row.forecast_comment ? (
                        <span className="text-blue-500">
                          {row.forecast_comment}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    {/* Monthly note — what happened this month? */}
                    <td
                      className="max-w-[120px] truncate px-3 py-2 text-slate-400 text-[11px]"
                      title={row.comment || ""}
                    >
                      {isEdit ? (
                        <input
                          className="w-28 rounded border border-slate-300 px-1.5 py-1 text-xs"
                          value={rowForm.comment}
                          onChange={(e) =>
                            setRowForm((f) => ({
                              ...f,
                              comment: e.target.value,
                            }))
                          }
                          placeholder="What happened…"
                        />
                      ) : row.comment ? (
                        <div className="space-y-0.5">
                          <span>{row.comment}</span>
                          {(row.updated_by || row.updated_at) && (
                            <div className="text-[9.5px] text-slate-300">
                              Last update{" "}
                              {row.updated_by
                                ? `by ${row.updated_by}`
                                : "saved"}
                              {row.updated_at
                                ? ` | ${fmtDate(row.updated_at)}`
                                : ""}
                            </div>
                          )}
                        </div>
                      ) : row.updated_by || row.updated_at ? (
                        <span className="text-[9.5px] text-slate-300">
                          Last update{" "}
                          {row.updated_by ? `by ${row.updated_by}` : "saved"}
                          {row.updated_at
                            ? ` | ${fmtDate(row.updated_at)}`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-slate-200">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEdit ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => saveRow(row.monthly_financial_id)}
                            disabled={loading}
                            className="rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-60"
                          >
                            {loading ? "…" : "Save"}
                          </button>
                          <button
                            onClick={() => setEditRow(null)}
                            className="rounded bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600"
                          >
                            ✕
                          </button>
                        </div>
                      ) : canEditFinancialRows ? (
                        <button
                          onClick={() => {
                            setEditRow(row.monthly_financial_id);
                            setRowForm({
                              actual_saving:
                                row.actual_saving?.toString() ?? "",
                              cash_actual: row.cash_actual?.toString() ?? "",
                              forecast_eoy_saving:
                                row.forecast_eoy_saving?.toString() ?? "",
                              forecast_comment: row.forecast_comment ?? "",
                              comment: row.comment ?? "",
                              monthly_outcome:
                                row.monthly_outcome ?? "Continue",
                            });
                          }}
                          className="rounded px-2 py-1 text-[10px] font-semibold text-blue-600 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                      ) : (
                        <span className="rounded px-2 py-1 text-[10px] font-semibold text-slate-400">
                          Locked
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

