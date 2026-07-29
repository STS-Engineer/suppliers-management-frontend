import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";
import supplierAPI from "../../../services/supplierOnboardingAPI";
import { useAuth } from "../../../context/AuthContext";
import { MemberDirectoryPicker } from "../../../components/common/MemberDirectoryPicker";
import type { Opp, SiteOption, SupplierOption } from "../types";
import { INCOTERMS_OPTIONS } from "../constants";
import {
  fmt,
  fmtDate,
  fmtDecInput,
  fmtDecInputSpace,
  fmtIntInput,
  normalizeChangeMode,
  pldColor,
  stripDec,
  stripInt,
} from "../utils";
import { FormSection } from "../components/FormSection";
import { Sep } from "../components/Sep";

export function EditTab({
  opp,
  userEmail,
  onRefresh,
}: {
  opp: Opp;
  userEmail: string;
  onRefresh: (o: Opp) => void;
}) {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [suppliersForPlant, setSuppliersForPlant] = useState<SupplierOption[]>(
    [],
  );
  const isSourced = ["Sourcing", "Technical Productivity"].includes(
    opp.opportunity_type ?? "",
  );
  // Negotiation/Cash opportunities skip PLD scoring entirely — no fields, no requirement.
  const isFlatType = ["Negotiation", "Cash"].includes(
    opp.opportunity_type ?? "",
  );
  // Negotiation has no execution/tooling phase (no supplier qualification, no
  // PPAP work) — only the Deployment Start Date (when the negotiated price
  // actually takes effect) matters, so Execution Start Date is skipped entirely.
  const isNegotiation = opp.opportunity_type === "Negotiation";
  // Bonus (Negotiation) / Rework (Technical Productivity) = a single lump gain
  // entered directly, one-time over 1 month — no price grid, no cash.
  const isDirectGain =
    opp.entry_mode === "Bonus" || opp.entry_mode === "Rework";
  // The STP price×quantity section now applies to Negotiation (standard mode) too,
  // not just Sourcing/Technical Productivity — a negotiation carries prices, quantities,
  // scope and (via renegotiated terms) cash. Direct-gain modes never use it.
  const usesStp = (isSourced || isNegotiation) && !isDirectGain;
  const { user } = useAuth();
  // The only two roles allowed to (a) Approve/Reject a pending STP revision
  // request, AND (b) edit the Phase 2/3 STP baseline directly without going
  // through the request/approve workflow at all. Mirrors the backend's
  // _PRIVILEGED check (router.py) and the actor_role bypass in
  // update_opportunity (service.py) — keep both in sync if this list changes.
  const canDecideStpRevision =
    user?.access_profile === "purchasing_director" ||
    user?.access_profile === "vp_conversion";

  useEffect(() => {
    supplierAPI
      .listSiteOptions()
      .then((r: { data?: SiteOption[] }) => setSites(r.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const pid = opp.plant_id;
    if (pid) {
      supplierAPI
        .getSuppliersByPlant(pid)
        .then((r: { data?: SupplierOption[] }) =>
          setSuppliersForPlant(r.data ?? []),
        )
        .catch(() => {});
    }
  }, [opp.plant_id]);

  const [currentSupplierEval, setCurrentSupplierEval] = useState<Record<
    string,
    unknown
  > | null>(null);
  useEffect(() => {
    if (opp.supplier_id && opp.plant_id) {
      supplierAPI
        .getCurrentSupplierEvaluation(opp.opportunity_id)
        .then((r: { data?: Record<string, unknown> }) =>
          setCurrentSupplierEval(r.data ?? null),
        )
        .catch(() => {});
    }
  }, [opp.supplier_id, opp.plant_id, opp.opportunity_id]);

  const isPhase0 = opp.phase_status === "Phase 0";
  // Highlight still-missing required fields for any open opportunity — not just
  // Phase 0 — so a user arriving from the Gate tab's "Complete before sending"
  // list can immediately spot what to fill in, regardless of current phase.
  const gateHighlight = opp.phase_status !== "Closed";
  const missingFlags = {
    scope: !opp.scope_in || !opp.customers,
    scopeIn: !opp.scope_in,
    customers: !opp.customers,
    quantity: !(opp.annual_quantity_n1 && opp.annual_quantity_n1 > 0),
    prices: !(opp.current_price && opp.proposed_price),
    supplierName: !opp.proposed_supplier_name && !opp.proposed_supplier_id,
    logistics: !(
      opp.incoterms_before &&
      opp.incoterms_after &&
      opp.country_after
    ),
    countryAfter: !opp.country_after,
    incoterms: !(opp.incoterms_before && opp.incoterms_after),
    risks: !(
      opp.stp_risks?.material_indexation_before &&
      opp.stp_risks?.material_indexation_after
    ),
    benefits: !(opp.stp_benefits?.if_we_do || opp.stp_benefits?.if_not),
    // Negotiation may leave the STP phase weeks at 0 (no planning ramp), so the
    // Phase 1 weeks are only "missing" for the other types.
    planning: !isNegotiation && !(opp.phase1_weeks && opp.phase1_weeks > 0),
    executionStartDate:
      !isNegotiation &&
      (isSourced
        ? ["Phase 1", "Phase 2", "Phase 3", "Phase 4"]
        : ["Phase 2", "Phase 3", "Phase 4"]
      ).includes(opp.phase_status ?? "") &&
      !opp.execution_start_date,
    realStartDate:
      ["Phase 3", "Phase 4"].includes(opp.phase_status ?? "") &&
      !(opp.budget_years?.some((by) => by.status_locked_at != null) ?? false) &&
      !opp.real_start_date,
  };
  const goApplied = opp.validation_decision === "Go";
  const stpEditablePhases = ["Assigned", "Phase 0", "Phase 1"];
  const showStpSection = usesStp;
  // STP inputs become read-only past the editable phases. They are ALSO locked while
  // the STP is awaiting a gate decision (submitted to a PM / committee) — so the
  // approved document can't be silently changed out from under the reviewer. A
  // "Review / Needs Rework" outcome moves status off these values and unlocks editing.
  const pendingApproval = [
    "Awaiting Validation",
    "Under Committee Review",
  ].includes(opp.status ?? "");
  const isStpPhase23 =
    isSourced && ["Phase 2", "Phase 3"].includes(opp.phase_status ?? "");
  const hasPendingSTPRevision = isStpPhase23 && !!opp.pending_stp_revision;
  // Purchasing Director / VP Conversion ARE the approvers — they can edit the
  // committed STP baseline directly in Phase 2/3 instead of going through the
  // request/approve workflow, as long as there isn't already a pending
  // revision request awaiting their decision (that must be resolved first).
  const canEditStpDirectly =
    canDecideStpRevision && isStpPhase23 && !hasPendingSTPRevision;
  const stpReadOnly =
    (!stpEditablePhases.includes(opp.phase_status ?? "") || pendingApproval) &&
    !canEditStpDirectly;
  // Budget status is derived from validation (Validate→Budgeted). The financial
  // baseline locks once the opportunity is validated/budgeted.
  const isBudgeted = opp.validation_status === "Budgeted";
  const isFxLocked =
    (opp.budget_years ?? []).some((by) => by.budget_status === "Budgeted") ||
    (opp.financial_lines ?? []).some((fl) =>
      (fl.monthly_financials ?? []).some((m) => m.actual_saving != null),
    );
  const locked = isBudgeted;

  const phaseNote: Record<string, string> = {
    "Phase 1":
      "Phase 0 Go applied. Annual saving and dates remain editable until the opportunity is Budgeted. Update owners, assumptions and comments freely.",
    "Phase 2":
      "Execution phase — enter real start date once production begins, update assumptions if saving estimate changed.",
    "Phase 3":
      "Deployment phase — confirm real start date and PPAP status in the Project tab.",
    "Phase 4":
      "Closure phase — add final comments and lessons learned before closing.",
  };

  const [form, setForm] = useState({
    opportunity_name: opp.opportunity_name ?? "",
    saving_nature: opp.saving_nature ?? "",
    entry_mode: opp.entry_mode ?? "",
    description: opp.description ?? "",
    // Strip Python Decimal trailing zeros ("12.00"→"12", "2700.00"→"2700")
    // Prevents French locale browser rendering "12,00" in number inputs
    expected_annual_saving:
      opp.expected_annual_saving != null
        ? String(parseFloat(String(opp.expected_annual_saving)))
        : "",
    cash_impact:
      opp.cash_impact != null
        ? String(parseFloat(String(opp.cash_impact)))
        : "",
    duration_months: opp.duration_months
      ? String(parseInt(String(opp.duration_months)))
      : "",
    planned_start_date: opp.planned_start_date ?? "",
    execution_start_date: opp.execution_start_date ?? "",
    real_start_date: opp.real_start_date ?? "",
    budget_year: opp.budget_year
      ? String(parseInt(String(opp.budget_year)))
      : "",
    change_mode: normalizeChangeMode(opp.change_mode),
    currency: opp.currency ?? "EUR",
    fx_rate_to_eur:
      opp.fx_rate_to_eur != null ? String(opp.fx_rate_to_eur) : "1",
    assumptions_summary: opp.assumptions_summary ?? "",
    comments: opp.comments ?? "",
    purchasing_owner: opp.purchasing_owner ?? "",
    // Default conversion_owner to purchasing_owner if not set
    conversion_owner: opp.conversion_owner ?? opp.purchasing_owner ?? "",
    payback_score: opp.payback_score ?? ("" as number | ""),
    lead_time_score: opp.lead_time_score ?? ("" as number | ""),
    difficulty_score: opp.difficulty_score ?? ("" as number | ""),
    // forced_priority = the manually overridden category; "" = auto (PLD)
    forced_priority:
      opp.priority_locked && opp.priority_category ? opp.priority_category : "",
    // STP
    scope_in: opp.scope_in ?? "",
    scope_out: opp.scope_out ?? "",
    customers: opp.customers ?? "",
    annual_quantity_n1: opp.annual_quantity_n1
      ? String(parseInt(String(opp.annual_quantity_n1)))
      : "",
    annual_quantity_n2: opp.annual_quantity_n2
      ? String(parseInt(String(opp.annual_quantity_n2)))
      : "",
    annual_quantity_n3: opp.annual_quantity_n3
      ? String(parseInt(String(opp.annual_quantity_n3)))
      : "",
    annual_quantity_n4: opp.annual_quantity_n4
      ? String(parseInt(String(opp.annual_quantity_n4)))
      : "",
    supplier_id: opp.supplier_id ? String(opp.supplier_id) : "",
    proposed_supplier_name: opp.proposed_supplier_name ?? "",
    proposed_supplier_id: opp.proposed_supplier_id
      ? String(parseInt(String(opp.proposed_supplier_id)))
      : "",
    current_price: opp.current_price
      ? String(parseFloat(String(opp.current_price)))
      : "",
    proposed_price: opp.proposed_price
      ? String(parseFloat(String(opp.proposed_price)))
      : "",
    proposed_price_n1: opp.proposed_price_n1
      ? String(parseFloat(String(opp.proposed_price_n1)))
      : "",
    proposed_price_n2: opp.proposed_price_n2
      ? String(parseFloat(String(opp.proposed_price_n2)))
      : "",
    proposed_price_n3: opp.proposed_price_n3
      ? String(parseFloat(String(opp.proposed_price_n3)))
      : "",
    country_after: opp.country_after ?? "",
    incoterms_before: opp.incoterms_before ?? "",
    incoterms_after: opp.incoterms_after ?? "",
    place_of_incoterms_before: opp.place_of_incoterms_before ?? "",
    place_of_incoterms_after: opp.place_of_incoterms_after ?? "",
    top_days_before: opp.top_days_before
      ? String(parseInt(String(opp.top_days_before)))
      : "",
    top_days_after: opp.top_days_after
      ? String(parseInt(String(opp.top_days_after)))
      : "",
    transit_days_before: opp.transit_days_before
      ? String(parseInt(String(opp.transit_days_before)))
      : "",
    transit_days_after: opp.transit_days_after
      ? String(parseInt(String(opp.transit_days_after)))
      : "",
    bonus_before: opp.bonus_before
      ? String(parseFloat(String(opp.bonus_before)))
      : "",
    bonus_after: opp.bonus_after
      ? String(parseFloat(String(opp.bonus_after)))
      : "",
    consignment_before: opp.consignment_before ?? "",
    consignment_after: opp.consignment_after ?? "",
    current_price_n1: opp.current_price_n1
      ? String(parseFloat(String(opp.current_price_n1)))
      : "",
    current_price_n2: opp.current_price_n2
      ? String(parseFloat(String(opp.current_price_n2)))
      : "",
    current_price_n3: opp.current_price_n3
      ? String(parseFloat(String(opp.current_price_n3)))
      : "",
    supplier_asked: opp.supplier_asked?.toString() ?? "",
    supplier_asked_result: opp.supplier_asked_result ?? "",
    tooling_cost: opp.tooling_cost
      ? String(parseFloat(String(opp.tooling_cost)))
      : "",
    travel_cost: opp.travel_cost
      ? String(parseFloat(String(opp.travel_cost)))
      : "",
    qualification_cost: opp.qualification_cost
      ? String(parseFloat(String(opp.qualification_cost)))
      : "",
    other_cost: opp.other_cost
      ? String(parseFloat(String(opp.other_cost)))
      : "",
    // stp_risks — flattened for form inputs, packed back to JSON on submit
    risk_material_indexation_before:
      opp.stp_risks?.material_indexation_before ?? "",
    risk_material_indexation_after:
      opp.stp_risks?.material_indexation_after ?? "",
    risk_material_indexation_desc:
      opp.stp_risks?.material_indexation_desc ?? "",
    risk_exchange_rate_before: opp.stp_risks?.exchange_rate_before ?? "",
    risk_exchange_rate_after: opp.stp_risks?.exchange_rate_after ?? "",
    risk_exchange_rate_desc: opp.stp_risks?.exchange_rate_desc ?? "",
    risk_local_content_before: opp.stp_risks?.local_content_before ?? "",
    risk_local_content_after: opp.stp_risks?.local_content_after ?? "",
    risk_local_content_desc: opp.stp_risks?.local_content_desc ?? "",
    risk_quality_before: opp.stp_risks?.quality_before ?? "",
    risk_quality_after: opp.stp_risks?.quality_after ?? "",
    risk_quality_desc: opp.stp_risks?.quality_desc ?? "",
    risk_other_before: opp.stp_risks?.other_before ?? "",
    risk_other_after: opp.stp_risks?.other_after ?? "",
    risk_other_desc: opp.stp_risks?.other_desc ?? "",
    material_same_spec: opp.stp_risks?.material_same_spec ?? "",
    same_tooling: opp.stp_risks?.same_tooling ?? "",
    same_dimension: opp.stp_risks?.same_dimension ?? "",
    same_process: opp.stp_risks?.same_process ?? "",
    // stp_benefits — flattened for form inputs
    benefit_if_we_do: opp.stp_benefits?.if_we_do ?? "",
    benefit_if_not: opp.stp_benefits?.if_not ?? "",
    phase1_weeks: opp.phase1_weeks
      ? String(parseInt(String(opp.phase1_weeks)))
      : "",
    phase2_weeks: opp.phase2_weeks
      ? String(parseInt(String(opp.phase2_weeks)))
      : "",
    phase3_weeks: opp.phase3_weeks
      ? String(parseInt(String(opp.phase3_weeks)))
      : "",
    phase4_weeks: opp.phase4_weeks
      ? String(parseInt(String(opp.phase4_weeks)))
      : "",
    reason_productivity: opp.reason_productivity ?? false,
    reason_quality: opp.reason_quality ?? false,
    reason_capacity: opp.reason_capacity ?? false,
    reason_other: opp.reason_other ?? "",
    secondary_plants: opp.secondary_plants ?? "",
    plant_id: opp.plant_id ? String(opp.plant_id) : "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Non-blocking "still needed before you can request approval" notice, shown
  // after a successful save. Saving is intentionally permissive (the user can
  // fill fields incrementally); these fields are only *enforced* at the gate.
  const [saveNotice, setSaveNotice] = useState<string[] | null>(null);
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  // Negotiation opportunities usually keep the SAME supplier — it's a
  // renegotiated price, not a re-source. Default the proposed/new supplier to
  // the current supplier so the user doesn't have to re-enter it. Only fills
  // when the proposed fields are still empty, so it stays fully editable and a
  // deliberate change is never overwritten.
  useEffect(() => {
    if (!isNegotiation) return;
    const currentId = form.supplier_id;
    if (!currentId) return;
    const current = suppliersForPlant.find(
      (s) => String(s.id_supplier_unit) === String(currentId),
    );
    setForm((f) => {
      const patch: Record<string, string> = {};
      if (!f.proposed_supplier_id) patch.proposed_supplier_id = String(currentId);
      if (!f.proposed_supplier_name && current?.supplier_name)
        patch.proposed_supplier_name = current.supplier_name;
      return Object.keys(patch).length ? { ...f, ...patch } : f;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNegotiation, form.supplier_id, suppliersForPlant]);

  // STP revision request modal (Phase 2/3) — inputs here are the NEW proposed
  // values, independent of the (disabled) main STP form. Left blank = unchanged.
  const [stpRevModal, setStpRevModal] = useState(false);
  const emptyStpRevForm = {
    note: "",
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
  const [stpRevForm, setStpRevForm] = useState(emptyStpRevForm);
  const [stpRevLoading, setStpRevLoading] = useState(false);
  const [stpRevError, setStpRevError] = useState<string | null>(null);
  const stpRevHasChange = Object.entries(stpRevForm).some(
    ([k, v]) => k !== "note" && String(v).trim() !== "",
  );

  // STP revision decision modal (Director)
  const [stpDecModal, setStpDecModal] = useState(false);
  const [stpDecForm, setStpDecForm] = useState({
    decision: "Approved",
    note: "",
  });
  const [stpDecLoading, setStpDecLoading] = useState(false);
  const [stpDecError, setStpDecError] = useState<string | null>(null);

  // Live-computed end date: last day of the final month in the period
  // duration=1, start=Oct → 31 Oct | duration=12, start=Oct → 30 Sep next year
  const computedEndDate = (() => {
    const start = form.planned_start_date || opp.planned_start_date;
    const dur = form.duration_months
      ? parseInt(form.duration_months)
      : opp.duration_months
        ? Number(opp.duration_months)
        : null;
    if (!start || !dur || dur <= 0) return null;
    const d = new Date(start);
    d.setMonth(d.getMonth() + dur - 1);
    d.setMonth(d.getMonth() + 1, 0);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  })();

  // Recommended savings start = study/planned anchor + planned phase 1–3 weeks
  // (study + feasibility + deployment). A suggestion the user can apply to Planned
  // Start; mirrors the backend recommend_savings_start_date().
  const recommendedSavingsStart = (() => {
    const anchor =
      form.execution_start_date ||
      opp.execution_start_date ||
      opp.study_start_date ||
      form.planned_start_date ||
      opp.planned_start_date;
    if (!anchor) return null;
    const d = new Date(anchor);
    if (isNaN(d.getTime())) return null;
    const weeks =
      (parseInt(form.phase1_weeks || "0") || 0) +
      (parseInt(form.phase2_weeks || "0") || 0) +
      (parseInt(form.phase3_weeks || "0") || 0);
    if (weeks > 0) d.setDate(d.getDate() + weeks * 7);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      iso,
      label: d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    };
  })();

  // Live PLD computation (component-level so submit handler can use them too)
  const _pldTotalInv =
    (parseFloat(form.tooling_cost || "0") || 0) +
    (parseFloat(form.travel_cost || "0") || 0) +
    (parseFloat(form.qualification_cost || "0") || 0) +
    (parseFloat(form.other_cost || "0") || 0);
  const _pldAnnSaving = parseFloat(form.expected_annual_saving || "0") || 0;
  const _pldHasInvData = _pldAnnSaving > 0 || _pldTotalInv > 0;
  const _pldPaybackMonths =
    _pldAnnSaving > 0
      ? _pldTotalInv / (_pldAnnSaving / 12)
      : _pldTotalInv > 0
        ? 999
        : 0;
  // Auto-calculated P from investment/savings (STP types only)
  const _autoP = !_pldHasInvData
    ? null
    : _pldPaybackMonths === 0
      ? 1
      : _pldPaybackMonths <= 2
        ? 2
        : _pldPaybackMonths <= 4
          ? 3
          : _pldPaybackMonths <= 12
            ? 4
            : 5;
  // Manual value in form overrides auto-calc for both STP and non-STP types
  const livePScore = form.payback_score
    ? Number(form.payback_score)
    : isSourced
      ? _autoP
      : null;
  const _pldTotalWeeks =
    (parseInt(form.phase1_weeks || "0") || 0) +
    (parseInt(form.phase2_weeks || "0") || 0) +
    (parseInt(form.phase3_weeks || "0") || 0);
  const _pldLeadMonths = _pldTotalWeeks / 4.33;
  // Auto-calculated L from phase weeks (STP types only)
  const _autoL =
    _pldTotalWeeks === 0
      ? null
      : _pldLeadMonths < 1
        ? 1
        : _pldLeadMonths < 2
          ? 2
          : _pldLeadMonths < 4
            ? 3
            : _pldLeadMonths < 6
              ? 4
              : 5;
  // Manual value in form overrides auto-calc for both STP and non-STP types
  const liveLScore = form.lead_time_score
    ? Number(form.lead_time_score)
    : isSourced
      ? _autoL
      : null;
  const liveDScore = form.difficulty_score
    ? Number(form.difficulty_score)
    : null;

  const pScore =
    livePScore && liveLScore && liveDScore
      ? livePScore * liveLScore * liveDScore
      : null;
  const pCat =
    pScore == null
      ? null
      : pScore >= 75
        ? "High"
        : pScore >= 25
          ? "Medium"
          : "Low";

  // ── STP financials — live, exact formulas from Excel "format STP rev 1.2" ──
  // Full year (D51) = (E26-G26)*D13 + E30-G30
  // Period   (D52)  = Σ qty_Nx × (price_before_x − price_after_x) + bonus delta
  // ROI full (F51)  = (D51-D45)/D51   ROI period (F52) = (D52-D41)/D41
  // Inventory gap (D55) / AP gap (D56) — blanks count as 0, AVERAGE ignores blanks
  const num = (v: string) => (v ? parseFloat(v) || 0 : 0);
  const stpPricesBefore = [
    num(form.current_price),
    num(form.current_price_n1),
    num(form.current_price_n2),
    num(form.current_price_n3),
  ];
  const stpPricesAfter = [
    num(form.proposed_price),
    num(form.proposed_price_n1),
    num(form.proposed_price_n2),
    num(form.proposed_price_n3),
  ];
  const stpQty = [
    form.annual_quantity_n1,
    form.annual_quantity_n2,
    form.annual_quantity_n3,
    form.annual_quantity_n4,
  ].map((v) => (v ? parseInt(v) || 0 : null));
  const bonusDelta = num(form.bonus_before) - num(form.bonus_after);
  const hasBasePrices = !!form.current_price && !!form.proposed_price;
  const fullYearSaving =
    hasBasePrices && stpQty[0]
      ? (stpPricesBefore[0] - stpPricesAfter[0]) * stpQty[0] + bonusDelta
      : null;
  const periodSaving =
    fullYearSaving != null
      ? stpQty.reduce(
          (sum: number, q, i) =>
            sum + (q ?? 0) * (stpPricesBefore[i] - stpPricesAfter[i]),
          0,
        ) + bonusDelta
      : null;
  // Estimated saving per year (year N incl. bonus; sum == periodSaving)
  const savingPerYear =
    fullYearSaving != null
      ? stpQty.map(
          (q, i) =>
            (q ?? 0) * (stpPricesBefore[i] - stpPricesAfter[i]) +
            (i === 0 ? bonusDelta : 0),
        )
      : null;
  // Budget-year prorated split — budget year N = 01 Dec N-1 -> 30 Nov N.
  // Allocation is by actual days from the savings start, mirroring
  // compute_budget_year_portions backend.
  const savingByYear = (() => {
    if (savingPerYear == null) return null;
    const projectAnchor =
      opp.study_start_date || form.planned_start_date || opp.planned_start_date;
    if (!projectAnchor) return null;
    const parseLocalDate = (value: string) => {
      const [y, m, d] = value.split("-").map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    };
    let start: Date;
    const realStart = form.real_start_date || opp.real_start_date;
    if (realStart) {
      start = parseLocalDate(realStart);
    } else {
      start = parseLocalDate(projectAnchor);
      if (isNaN(start.getTime())) return null;
      // Phases 1–3 only — savings flow once deployment ends, before Phase 4 closure.
      const weeks =
        (parseInt(form.phase1_weeks || "0") || 0) +
        (parseInt(form.phase2_weeks || "0") || 0) +
        (parseInt(form.phase3_weeks || "0") || 0);
      start.setDate(start.getDate() + weeks * 7);
    }
    if (isNaN(start.getTime())) return null;
    const maxMonths = 12 * savingPerYear.length;
    const durMonths = parseInt(form.duration_months || "0") || 0;
    const months = durMonths > 0 ? Math.min(durMonths, maxMonths) : maxMonths;
    const addMonthsPreserveDay = (base: Date, offsetMonths: number) => {
      const d = new Date(base);
      const year = d.getFullYear();
      const month = d.getMonth();
      const day = d.getDate();
      const target = new Date(year, month + offsetMonths, 1);
      const lastDay = new Date(
        target.getFullYear(),
        target.getMonth() + 1,
        0,
      ).getDate();
      return new Date(
        target.getFullYear(),
        target.getMonth(),
        Math.min(day, lastDay),
      );
    };
    const budgetYearForDate = (d: Date) =>
      d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
    const budgetYearEndExclusive = (fy: number) => new Date(fy, 11, 1);
    const acc: Record<number, number> = {};
    const overallEnd = addMonthsPreserveDay(start, months);

    for (let i = 0; i < savingPerYear.length; i++) {
      const annual = savingPerYear[i];
      if (annual == null) continue;
      const windowStart = addMonthsPreserveDay(start, i * 12);
      const windowEnd = addMonthsPreserveDay(start, (i + 1) * 12);
      if (windowStart >= overallEnd) break;
      const effectiveEnd = windowEnd < overallEnd ? windowEnd : overallEnd;
      const windowDays =
        (windowEnd.getTime() - windowStart.getTime()) / 86400000;
      if (windowDays <= 0 || effectiveEnd <= windowStart) continue;

      let cursor = windowStart;
      while (cursor < effectiveEnd) {
        const fy = budgetYearForDate(cursor);
        const fyEnd = budgetYearEndExclusive(fy);
        const sliceEnd = fyEnd < effectiveEnd ? fyEnd : effectiveEnd;
        const days = (sliceEnd.getTime() - cursor.getTime()) / 86400000;
        if (days > 0) {
          acc[fy] = (acc[fy] || 0) + (annual * days) / windowDays;
        }
        cursor = sliceEnd;
      }
    }
    return Object.entries(acc)
      .map(([y, v]) => ({ year: Number(y), amount: v }))
      .sort((a, b) => a.year - b.year);
  })();
  // ROI = gain ÷ TOTAL investment × 100 (purchasing-director rule 17/06/2026)
  const roiFullYear =
    fullYearSaving != null && _pldTotalInv > 0
      ? (fullYearSaving / _pldTotalInv) * 100
      : null;
  const roiPeriod =
    periodSaving != null && _pldTotalInv > 0
      ? (periodSaving / _pldTotalInv) * 100
      : null;
  const presentQty = stpQty.filter((q): q is number => q != null);
  const avgQty = presentQty.length
    ? presentQty.reduce((a, b) => a + b, 0) / presentQty.length
    : null;
  const inventoryGap =
    avgQty != null && hasBasePrices
      ? (form.consignment_before === "Yes"
          ? 0
          : ((num(form.transit_days_before) + 14) * avgQty) / 360) *
          stpPricesBefore[0] -
        (form.consignment_after === "Yes"
          ? 0
          : ((num(form.transit_days_after) + 14) * avgQty) / 360) *
          stpPricesAfter[0]
      : null;
  const apGap =
    avgQty != null && hasBasePrices
      ? (-avgQty *
          (num(form.top_days_before) * stpPricesBefore[0] -
            num(form.top_days_after) * stpPricesAfter[0])) /
        360
      : null;
  // Chained phase dates (Excel planning: end = start + weeks×7, next phase starts at previous end)
  const phaseDates = (() => {
    // Phase 1 start = manual execution_start_date entry, else fall back to study/planned anchor
    const anchor =
      form.execution_start_date ||
      opp.execution_start_date ||
      opp.study_start_date ||
      form.planned_start_date ||
      opp.planned_start_date;
    const weeks = [
      form.phase1_weeks,
      form.phase2_weeks,
      form.phase3_weeks,
      form.phase4_weeks,
    ].map((v) => (v ? parseInt(v) || 0 : 0));
    if (!anchor || !weeks.some((w) => w > 0)) return null;
    let cursor = new Date(anchor);
    if (isNaN(cursor.getTime())) return null;
    const fmtD = (d: Date) =>
      d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "2-digit",
      });
    return weeks.map((w) => {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setDate(end.getDate() + w * 7);
      cursor = end;
      return { start: fmtD(start), end: fmtD(end) };
    });
  })();

  // EBITDA Period (all fulfilled years) is the STP headline saving; Cash Impact =
  // Inventory + AP gap. Both auto-calculated & read-only for STP types.
  const autoSaving = periodSaving != null ? Math.round(periodSaving) : null;
  const autoCashImpact =
    inventoryGap != null || apGap != null
      ? Math.round((inventoryGap ?? 0) + (apGap ?? 0))
      : null;

  useEffect(() => {
    if (autoSaving != null && autoSaving > 0 && !locked) {
      setForm((f) =>
        f.expected_annual_saving
          ? f // never overwrite a value the user already entered or that was loaded
          : { ...f, expected_annual_saving: autoSaving.toString() },
      );
    }
  }, [
    form.current_price,
    form.proposed_price,
    form.annual_quantity_n1,
    form.bonus_before,
    form.bonus_after,
  ]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    // Required-field completeness is ADVISORY at save time — the user can save a
    // partially-filled opportunity and finish the rest later. The same list is
    // surfaced as a non-blocking notice after saving (setSaveNotice) and is
    // ENFORCED (blocking) only at the gate/committee request. This replaces the
    // old behaviour where saving was blocked until every field was filled.
    const missing: string[] = [];
    {
      const phase = opp.phase_status ?? "";

      if (["Phase 0", "Phase 1"].includes(phase)) {
        // Direct-gain (Bonus/Rework) duration is fixed at 1 month and the field
        // is read-only — don't require the user to fill it.
        if (
          !isDirectGain &&
          (!form.duration_months || parseInt(form.duration_months) <= 0)
        ) {
          missing.push("Duration (months)");
        }
        if (
          form.expected_annual_saving.trim() === "" ||
          parseFloat(form.expected_annual_saving) < 0
        ) {
          missing.push("Est. Annual Saving");
        }
        if (!form.planned_start_date) {
          missing.push("Planned Start Date");
        }
        // Negotiation/Cash skip PLD scoring; Bonus/Rework (direct-gain) also skip the
        // STP price/quantity/scope requirements — they only carry a single gain.
        if (!isFlatType && !isDirectGain) {
          if (!form.plant_id) missing.push("Plant");
          if (!form.scope_in) missing.push("Scope IN");
          if (!form.proposed_supplier_name) {
            missing.push("Proposed supplier name");
          }
          // All four years of quantity + current price + proposed price are required
          // (Olivier, call 2026-07-10): the per-year saving and the "saving à budgéter"
          // only make sense with every year filled in.
          const yrLabels = ["N", "N+1", "N+2", "N+3"];
          const qtyFields = [
            form.annual_quantity_n1,
            form.annual_quantity_n2,
            form.annual_quantity_n3,
            form.annual_quantity_n4,
          ];
          const currentPriceFields = [
            form.current_price,
            form.current_price_n1,
            form.current_price_n2,
            form.current_price_n3,
          ];
          const proposedPriceFields = [
            form.proposed_price,
            form.proposed_price_n1,
            form.proposed_price_n2,
            form.proposed_price_n3,
          ];
          yrLabels.forEach((lbl, i) => {
            if (!qtyFields[i] || parseInt(qtyFields[i]) <= 0) {
              missing.push(`Quantity (Year ${lbl})`);
            }
            if (
              !currentPriceFields[i] ||
              parseFloat(currentPriceFields[i]) <= 0
            ) {
              missing.push(`Current Price (Year ${lbl})`);
            }
            if (
              !proposedPriceFields[i] ||
              parseFloat(proposedPriceFields[i]) <= 0
            ) {
              missing.push(`Proposed Price (Year ${lbl})`);
            }
          });
        }
      }

      // Phase 1 Starting Date / Execution Start Date — same underlying field.
      // Sourcing/Technical Productivity opportunities expose it as "Phase 1
      // Starting Date" already in Phase 1 (STP planning section), so it's
      // required from there; other types only get the field from Phase 2.
      // Negotiation has no execution/tooling phase, so it never requires it.
      const executionDateRequiredPhases = isNegotiation
        ? []
        : isSourced
          ? ["Phase 1", "Phase 2", "Phase 3", "Phase 4"]
          : ["Phase 2", "Phase 3", "Phase 4"];
      if (
        executionDateRequiredPhases.includes(phase) &&
        !form.execution_start_date
      ) {
        missing.push(
          isSourced && phase === "Phase 1"
            ? "Phase 1 Starting Date"
            : "Execution Start Date",
        );
      }

      // Phase 3 — savings are flowing, so the real deployment start date must be
      // recorded (unless the budget year is already closed and the field is locked).
      if (["Phase 3", "Phase 4"].includes(phase)) {
        const budgetLocked =
          opp.budget_years?.some((by) => by.status_locked_at != null) ?? false;
        if (!budgetLocked && !form.real_start_date) {
          missing.push("Deployment Start Date (Real Savings Start)");
        }
      }
    }

    // Client-side FX guard — catch the obvious case before hitting the API.
    // This one STAYS blocking: the backend rejects a non-EUR opportunity saved
    // without a conversion rate (service.py FX final-state guard), so allowing
    // the save would just fail server-side.
    if (form.currency && form.currency !== "EUR") {
      const rate = parseFloat(form.fx_rate_to_eur ?? "0");
      if (!rate || rate <= 0) {
        setError(
          `FX rate to EUR is required for ${form.currency} opportunities. ` +
            `Enter the conversion rate (e.g. 0.920000 means 1 ${form.currency} = 0.92 EUR) ` +
            `before saving. Without it, consolidated KPI totals will be wrong.`,
        );
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSaveNotice(null);

    // Budget status / year are derived from validation — nothing to validate here.

    try {
      const res = await supplierAPI.updateOpportunity(opp.opportunity_id, {
        opportunity_name: form.opportunity_name || undefined,
        saving_nature: form.saving_nature || undefined,
        // "" → "Standard" so a user can switch a Bonus/Rework back to standard STP.
        entry_mode: form.entry_mode || "Standard",
        // Send "" (not undefined) so clearing the field actually erases the
        // description — undefined is dropped by JSON.stringify, so the backend
        // would never receive the change and nothing would happen.
        description: form.description ?? "",
        expected_annual_saving: form.expected_annual_saving
          ? parseFloat(form.expected_annual_saving)
          : undefined,
        cash_impact: form.cash_impact
          ? parseFloat(form.cash_impact)
          : undefined,
        // Bonus/Rework are a single one-time gain — always 1 month, regardless
        // of the (read-only) form value.
        duration_months: isDirectGain
          ? 1
          : form.duration_months
            ? parseInt(form.duration_months)
            : undefined,
        planned_start_date: form.planned_start_date || undefined,
        execution_start_date: form.execution_start_date || undefined,
        real_start_date: form.real_start_date || undefined,
        change_mode: form.change_mode || undefined,
        currency: form.currency || undefined,
        fx_rate_to_eur: isFxLocked
          ? undefined
          : form.fx_rate_to_eur
            ? parseFloat(form.fx_rate_to_eur)
            : undefined,
        assumptions_summary: form.assumptions_summary || undefined,
        comments: form.comments || undefined,
        purchasing_owner: form.purchasing_owner || undefined,
        conversion_owner: form.conversion_owner || undefined,
        payback_score: livePScore ?? undefined,
        lead_time_score: liveLScore ?? undefined,
        difficulty_score: liveDScore ?? undefined,
        priority_locked: form.forced_priority !== "" ? true : false,
        priority_category_override: form.forced_priority || undefined,
        scope_in: form.scope_in || undefined,
        scope_out: form.scope_out || undefined,
        customers: form.customers || undefined,
        annual_quantity_n1: form.annual_quantity_n1
          ? parseInt(form.annual_quantity_n1)
          : undefined,
        annual_quantity_n2: form.annual_quantity_n2
          ? parseInt(form.annual_quantity_n2)
          : undefined,
        annual_quantity_n3: form.annual_quantity_n3
          ? parseInt(form.annual_quantity_n3)
          : undefined,
        annual_quantity_n4: form.annual_quantity_n4
          ? parseInt(form.annual_quantity_n4)
          : undefined,
        supplier_id: form.supplier_id ? parseInt(form.supplier_id) : undefined,
        proposed_supplier_name: form.proposed_supplier_name || undefined,
        proposed_supplier_id: form.proposed_supplier_id
          ? parseInt(form.proposed_supplier_id)
          : undefined,
        current_price: form.current_price
          ? parseFloat(form.current_price)
          : undefined,
        proposed_price: form.proposed_price
          ? parseFloat(form.proposed_price)
          : undefined,
        proposed_price_n1: form.proposed_price_n1
          ? parseFloat(form.proposed_price_n1)
          : undefined,
        proposed_price_n2: form.proposed_price_n2
          ? parseFloat(form.proposed_price_n2)
          : undefined,
        proposed_price_n3: form.proposed_price_n3
          ? parseFloat(form.proposed_price_n3)
          : undefined,
        country_after: form.country_after || undefined,
        incoterms_before: form.incoterms_before || undefined,
        incoterms_after: form.incoterms_after || undefined,
        place_of_incoterms_before: form.place_of_incoterms_before || undefined,
        place_of_incoterms_after: form.place_of_incoterms_after || undefined,
        top_days_before: form.top_days_before
          ? parseInt(form.top_days_before)
          : undefined,
        top_days_after: form.top_days_after
          ? parseInt(form.top_days_after)
          : undefined,
        transit_days_before: form.transit_days_before
          ? parseInt(form.transit_days_before)
          : undefined,
        transit_days_after: form.transit_days_after
          ? parseInt(form.transit_days_after)
          : undefined,
        bonus_before: form.bonus_before
          ? parseFloat(form.bonus_before)
          : undefined,
        bonus_after: form.bonus_after
          ? parseFloat(form.bonus_after)
          : undefined,
        consignment_before: form.consignment_before || undefined,
        consignment_after: form.consignment_after || undefined,
        current_price_n1: form.current_price_n1
          ? parseFloat(form.current_price_n1)
          : undefined,
        current_price_n2: form.current_price_n2
          ? parseFloat(form.current_price_n2)
          : undefined,
        current_price_n3: form.current_price_n3
          ? parseFloat(form.current_price_n3)
          : undefined,
        supplier_asked: form.supplier_asked
          ? form.supplier_asked === "true"
          : undefined,
        supplier_asked_result: form.supplier_asked_result || undefined,
        tooling_cost: form.tooling_cost
          ? parseFloat(form.tooling_cost)
          : undefined,
        travel_cost: form.travel_cost
          ? parseFloat(form.travel_cost)
          : undefined,
        qualification_cost: form.qualification_cost
          ? parseFloat(form.qualification_cost)
          : undefined,
        other_cost: form.other_cost ? parseFloat(form.other_cost) : undefined,
        stp_risks: {
          material_indexation_before:
            form.risk_material_indexation_before || undefined,
          material_indexation_after:
            form.risk_material_indexation_after || undefined,
          material_indexation_desc:
            form.risk_material_indexation_desc || undefined,
          exchange_rate_before: form.risk_exchange_rate_before || undefined,
          exchange_rate_after: form.risk_exchange_rate_after || undefined,
          exchange_rate_desc: form.risk_exchange_rate_desc || undefined,
          local_content_before: form.risk_local_content_before || undefined,
          local_content_after: form.risk_local_content_after || undefined,
          local_content_desc: form.risk_local_content_desc || undefined,
          quality_before: form.risk_quality_before || undefined,
          quality_after: form.risk_quality_after || undefined,
          quality_desc: form.risk_quality_desc || undefined,
          other_before: form.risk_other_before || undefined,
          other_after: form.risk_other_after || undefined,
          other_desc: form.risk_other_desc || undefined,
          material_same_spec: form.material_same_spec || undefined,
          same_tooling: form.same_tooling || undefined,
          same_dimension: form.same_dimension || undefined,
          same_process: form.same_process || undefined,
        },
        stp_benefits: {
          if_we_do: form.benefit_if_we_do || undefined,
          if_not: form.benefit_if_not || undefined,
        },
        phase1_weeks: form.phase1_weeks
          ? parseInt(form.phase1_weeks)
          : undefined,
        phase2_weeks: form.phase2_weeks
          ? parseInt(form.phase2_weeks)
          : undefined,
        phase3_weeks: form.phase3_weeks
          ? parseInt(form.phase3_weeks)
          : undefined,
        phase4_weeks: form.phase4_weeks
          ? parseInt(form.phase4_weeks)
          : undefined,
        reason_productivity: form.reason_productivity,
        reason_quality: form.reason_quality,
        reason_capacity: form.reason_capacity,
        reason_other: form.reason_other || undefined,
        secondary_plants: form.secondary_plants || undefined,
        changed_by: userEmail,
      });
      // Always refetch after save so server-computed fields (period saving, ROI,
      // cash gaps, total investment, rebuilt monthly profiles) are displayed
      // consistently — single refresh path regardless of which fields changed.
      try {
        const fresh = await supplierAPI.getOpportunity(opp.opportunity_id);
        onRefresh(fresh.data as Opp);
      } catch {
        onRefresh(res.data as Opp);
      }
      // Saved successfully — surface (without blocking) any fields still needed
      // before this opportunity can be sent for gate/committee approval.
      setSaveNotice(missing.length ? missing : null);
    } catch (err: unknown) {
      // Request Revision creation is disabled (see the DISABLED block below) —
      // a non-privileged user hitting STP_REQUIRES_APPROVAL just gets the plain
      // error message now instead of a modal that leads nowhere.
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitSTPRevisionRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!stpRevForm.note.trim() || !stpRevHasChange) return;
    setStpRevLoading(true);
    setStpRevError(null);
    try {
      await supplierAPI.requestSTPRevision(opp.opportunity_id, {
        note: stpRevForm.note.trim(),
        requested_by: userEmail,
        current_price: stpRevForm.current_price
          ? parseFloat(stpRevForm.current_price)
          : undefined,
        proposed_price: stpRevForm.proposed_price
          ? parseFloat(stpRevForm.proposed_price)
          : undefined,
        current_price_n1: stpRevForm.current_price_n1
          ? parseFloat(stpRevForm.current_price_n1)
          : undefined,
        current_price_n2: stpRevForm.current_price_n2
          ? parseFloat(stpRevForm.current_price_n2)
          : undefined,
        current_price_n3: stpRevForm.current_price_n3
          ? parseFloat(stpRevForm.current_price_n3)
          : undefined,
        proposed_price_n1: stpRevForm.proposed_price_n1
          ? parseFloat(stpRevForm.proposed_price_n1)
          : undefined,
        proposed_price_n2: stpRevForm.proposed_price_n2
          ? parseFloat(stpRevForm.proposed_price_n2)
          : undefined,
        proposed_price_n3: stpRevForm.proposed_price_n3
          ? parseFloat(stpRevForm.proposed_price_n3)
          : undefined,
        annual_quantity_n1: stpRevForm.annual_quantity_n1
          ? parseInt(stpRevForm.annual_quantity_n1)
          : undefined,
        annual_quantity_n2: stpRevForm.annual_quantity_n2
          ? parseInt(stpRevForm.annual_quantity_n2)
          : undefined,
        annual_quantity_n3: stpRevForm.annual_quantity_n3
          ? parseInt(stpRevForm.annual_quantity_n3)
          : undefined,
        annual_quantity_n4: stpRevForm.annual_quantity_n4
          ? parseInt(stpRevForm.annual_quantity_n4)
          : undefined,
        bonus_before: stpRevForm.bonus_before
          ? parseFloat(stpRevForm.bonus_before)
          : undefined,
        bonus_after: stpRevForm.bonus_after
          ? parseFloat(stpRevForm.bonus_after)
          : undefined,
      });
      setStpRevModal(false);
      setStpRevForm(emptyStpRevForm);
      const fresh = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(fresh.data as Opp);
    } catch (err: unknown) {
      setStpRevError(
        err instanceof Error
          ? err.message
          : "Failed to submit revision request.",
      );
    } finally {
      setStpRevLoading(false);
    }
  }

  async function submitSTPDecision(e: React.FormEvent) {
    e.preventDefault();
    setStpDecLoading(true);
    setStpDecError(null);
    try {
      await supplierAPI.decideSTPRevision(opp.opportunity_id, {
        decision: stpDecForm.decision,
        decided_by: userEmail,
        note: stpDecForm.note.trim() || undefined,
      });
      setStpDecModal(false);
      setStpDecForm({ decision: "Approved", note: "" });
      const fresh = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(fresh.data as Opp);
    } catch (err: unknown) {
      setStpDecError(
        err instanceof Error ? err.message : "Failed to record decision.",
      );
    } finally {
      setStpDecLoading(false);
    }
  }

  const inp =
    "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
  const label = "mb-1 block text-xs font-semibold text-slate-600";
  const inpHi =
    "w-full rounded-xl border-2 border-rose-500 bg-rose-50 px-3 py-2 text-sm outline-none shadow-[0_0_0_3px_rgba(244,63,94,0.12)] focus:border-rose-600 focus:ring-2 focus:ring-rose-200";
  const labelHi = "mb-1 block text-xs font-bold text-rose-600";
  // Small table-style inputs (Logistics / Prices before-after grid) get a
  // slimmer highlighted variant instead of the full `inp`/`inpHi` treatment.
  const cellInp =
    "w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300";
  const cellInpHi =
    "w-full rounded border-2 border-rose-500 bg-rose-50 px-2 py-1 text-xs outline-none shadow-[0_0_0_2px_rgba(244,63,94,0.12)] focus:border-rose-600";
  const hi = (missing: boolean) => (gateHighlight && missing ? inpHi : inp);
  const hiLabel = (missing: boolean) =>
    gateHighlight && missing ? labelHi : label;
  const hiCell = (missing: boolean) =>
    gateHighlight && missing ? cellInpHi : cellInp;

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {saveNotice && saveNotice.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            <p className="font-semibold">
              Saved. These fields are still required before you can request
              approval:
            </p>
            <ul className="mt-1 list-disc pl-5">
              {saveNotice.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        {phaseNote[opp.phase_status ?? ""] && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
            {phaseNote[opp.phase_status ?? ""]}
          </div>
        )}
        <div className="order-1">
          <label className={label}>Opportunity Name</label>
          <input
            className={inp}
            value={form.opportunity_name}
            onChange={(e) => set("opportunity_name", e.target.value)}
          />
        </div>
        <div className="order-2">
          <label className={label}>Description</label>
          <textarea
            rows={2}
            className={`${inp} resize-none`}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
        {(opp.opportunity_type === "Negotiation" ||
          opp.opportunity_type === "Technical Productivity") && (
          <div className="order-3">
            <label className={label}>Mode</label>
            {/* Mode is fixed at creation (like opportunity_type) — switching it later
                would wipe the STP grid. To change it, duplicate or recreate. */}
            <div
              className={`${inp} bg-slate-100 text-slate-600 flex items-center justify-between`}
            >
              <span>
                {opp.entry_mode === "Bonus"
                  ? "Bonus — single one-time gain"
                  : opp.entry_mode === "Rework"
                    ? "Rework — single one-time gain"
                    : "Standard (price × quantity)"}
              </span>
              <span className="text-[10px] text-slate-400">
                set at creation
              </span>
            </div>
          </div>
        )}
        <div className="order-3">
          <label className={label}>Saving nature</label>
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
        {/* Other fields (baseline + alerts + PLD) — shown AFTER the STP study */}
        <div className="order-4 flex flex-col gap-4">
          {/* ---- FINANCIAL BASELINE (locked once Budgeted) ---- */}
          <div
            className={`rounded-xl p-4 space-y-3 ${locked ? "bg-slate-50 border border-slate-200" : ""}`}
          >
            {locked && (
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-400">
                <Lock size={10} /> Financial baseline — locked (real start date
                entered)
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className={
                    !usesStp
                      ? hiLabel(opp.expected_annual_saving == null)
                      : label
                  }
                >
                  {usesStp
                    ? "EBITDA Period (€)"
                    : isDirectGain
                      ? "Gain (€)"
                      : "Est. Annual Saving (€)"}
                  <span className="ml-1 font-normal text-slate-400">
                    {usesStp
                      ? "— auto, all years (N…N+3)"
                      : isDirectGain
                        ? "— one-time gain"
                        : ""}
                  </span>
                </label>
                {usesStp ? (
                  <div
                    className={`${inp} bg-emerald-50 font-bold text-emerald-700`}
                  >
                    {autoSaving != null
                      ? `€${autoSaving.toLocaleString("en-GB")}`
                      : opp.expected_annual_saving != null
                        ? fmt(opp.expected_annual_saving)
                        : "—"}
                  </div>
                ) : (
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={locked}
                    className={`${hi(opp.expected_annual_saving == null)} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
                    value={fmtDecInputSpace(form.expected_annual_saving)}
                    onChange={(e) =>
                      set("expected_annual_saving", stripDec(e.target.value))
                    }
                  />
                )}
                {usesStp && (
                  <p className="text-[10px] text-emerald-600 mt-0.5">
                    Sum of the EBITDA savings across all fulfilled years (EBITDA
                    Period).
                  </p>
                )}
              </div>
              {/* A one-time Bonus/Rework gain has no cash impact — hide the field. */}
              {!isDirectGain && (
                <div>
                  <label className={label}>
                    Cash Impact (€){" "}
                    <span className="font-normal text-slate-400">
                      {usesStp
                        ? "— auto: Inventory gap + AP gap"
                        : "— total cash estimate, locked when Budgeted"}
                    </span>
                  </label>
                  {usesStp ? (
                    <div
                      className={`${inp} bg-emerald-50 font-bold text-emerald-700`}
                    >
                      {autoCashImpact != null
                        ? `€${autoCashImpact.toLocaleString("en-GB")}`
                        : opp.cash_impact != null
                          ? fmt(opp.cash_impact)
                          : "—"}
                    </div>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      disabled={locked}
                      className={`${inp} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
                      value={form.cash_impact}
                      onChange={(e) => set("cash_impact", e.target.value)}
                    />
                  )}
                </div>
              )}
              <div>
                <label
                  className={hiLabel(
                    !(opp.duration_months && opp.duration_months > 0),
                  )}
                >
                  Duration (months){" "}
                  <span className="font-normal text-slate-400">
                    — saving period length
                  </span>
                </label>
                {isDirectGain ? (
                  <div className={`${inp} bg-slate-100 text-slate-500`}>
                    1 month (one-time gain)
                  </div>
                ) : (
                  <select
                    disabled={locked}
                    className={`${hi(!(opp.duration_months && opp.duration_months > 0))} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
                    value={form.duration_months}
                    onChange={(e) => set("duration_months", e.target.value)}
                  >
                    <option value="" disabled>
                      Select duration
                    </option>
                    {[1, 12].map((m) => (
                      <option key={m} value={m}>
                        {m} {m === 1 ? "month" : "months"}
                      </option>
                    ))}
                    {form.duration_months &&
                      ![1, 12].includes(
                        Number(form.duration_months),
                      ) && (
                        <option value={form.duration_months}>
                          {form.duration_months} months (legacy)
                        </option>
                      )}
                  </select>
                )}
                {computedEndDate && (
                  <p className="mt-1 text-[10.5px] text-slate-500">
                    → Planned end:{" "}
                    <span className="font-semibold text-slate-700">
                      {computedEndDate}
                    </span>
                  </p>
                )}
                {!isDirectGain && (
                  <p className="mt-1 text-[10.5px] text-amber-600">
                    For STP opportunities the duration is recomputed on save from
                    the yearly prices (flat price → 12 months; each further year
                    of price change → +12).
                  </p>
                )}
              </div>
              <div>
                <label className={hiLabel(!opp.planned_start_date)}>
                  Planned Start (estimated savings start){" "}
                  <span className="font-normal text-slate-400">
                    — when real savings are expected to begin; drives planned
                    end &amp; the budget split
                  </span>
                </label>
                <input
                  type="date"
                  className={hi(!opp.planned_start_date)}
                  value={form.planned_start_date}
                  onChange={(e) => set("planned_start_date", e.target.value)}
                />
                {computedEndDate && (
                  <p className="mt-1 text-[10.5px] text-slate-500">
                    → Planned end:{" "}
                    <span className="font-semibold text-slate-700">
                      {computedEndDate}
                    </span>
                  </p>
                )}
                {!isDirectGain &&
                  recommendedSavingsStart &&
                  recommendedSavingsStart.iso !== form.planned_start_date && (
                    <p className="mt-1 flex items-center gap-1.5 text-[10.5px] text-blue-600">
                      <span>
                        Recommended (study start + Phase 1–3 weeks):{" "}
                        <span className="font-semibold">
                          {recommendedSavingsStart.label}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          set("planned_start_date", recommendedSavingsStart.iso)
                        }
                        className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        Apply
                      </button>
                    </p>
                  )}
                {form.planned_start_date &&
                  form.planned_start_date !== opp.planned_start_date &&
                  ["Phase 0", "Phase 1", "Phase 2", "Assigned"].includes(
                    opp.phase_status ?? "",
                  ) && (
                    <p className="mt-1 text-[10.5px] text-amber-600 font-medium">
                      ⚠ Date changed — monthly savings profile will be rebuilt
                      from {form.planned_start_date}
                    </p>
                  )}
                {form.planned_start_date &&
                  form.planned_start_date !== opp.planned_start_date &&
                  ["Phase 3", "Phase 4"].includes(opp.phase_status ?? "") && (
                    <p className="mt-1 text-[10.5px] text-blue-600 font-medium">
                      ℹ Savings have started — use Deployment Start Date (real)
                      to rebuild the profile.
                    </p>
                  )}
              </div>
              {/* Phase 2 date — when execution work began (not applicable to
                  Negotiation, which has no tooling/qualification phase) */}
              {!isNegotiation &&
                ["Phase 2", "Phase 3", "Phase 4"].includes(
                  opp.phase_status ?? "",
                ) && (
                  <div>
                    <label className={hiLabel(missingFlags.executionStartDate)}>
                      Execution Start Date
                      <span className="ml-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600">
                        Phase 2
                      </span>
                      <span className="ml-1 font-normal text-slate-400">
                        — when work began (tooling, qualification, supplier
                        contacted)
                      </span>
                    </label>
                    <input
                      type="date"
                      className={hi(missingFlags.executionStartDate)}
                      value={form.execution_start_date}
                      onChange={(e) =>
                        set("execution_start_date", e.target.value)
                      }
                    />
                  </div>
                )}
              {/* Phase 3 date — when savings actually started flowing */}
              {["Phase 3", "Phase 4"].includes(opp.phase_status ?? "") && (
                <div>
                  <label className={hiLabel(missingFlags.realStartDate)}>
                    Deployment Start Date (Real Savings Start)
                    <span className="ml-1.5 rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-600">
                      Phase 3
                    </span>
                    <span className="ml-1 font-normal text-slate-400">
                      — when PPAP validated and Longrun/new parts entered
                      production
                    </span>
                  </label>
                  {(() => {
                    const isLocked =
                      opp.budget_years?.some(
                        (by) => by.status_locked_at != null,
                      ) ?? false;
                    return isLocked ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                        🔒 Real start date is <strong>locked</strong> — this
                        opportunity is committed in a closed budget. Contact
                        your purchasing director to modify.
                      </div>
                    ) : (
                      <>
                        <input
                          type="date"
                          className={hi(missingFlags.realStartDate)}
                          value={form.real_start_date}
                          onChange={(e) =>
                            set("real_start_date", e.target.value)
                          }
                        />
                        {form.real_start_date &&
                          opp.planned_start_date &&
                          form.real_start_date !== opp.planned_start_date && (
                            <p className="text-[10px] text-amber-600 mt-0.5">
                              ⚠ Differs from planned start (
                              {fmtDate(opp.planned_start_date)}) — saving will
                              automatically rebuild the monthly profile.
                            </p>
                          )}
                      </>
                    );
                  })()}
                  {/* R9 data-loss warning — rebuilding from a later start deletes the
                  months before it, including any actuals already entered there. */}
                  {form.real_start_date &&
                    form.real_start_date !== (opp.real_start_date ?? "") &&
                    (() => {
                      const newStart = form.real_start_date.slice(0, 7);
                      const droppedActuals = (
                        opp.financial_lines[0]?.monthly_financials ?? []
                      ).filter(
                        (m) =>
                          m.period_month != null &&
                          m.actual_saving != null &&
                          m.period_month.slice(0, 7) < newStart,
                      );
                      return droppedActuals.length > 0 ? (
                        <p className="mt-1 rounded-lg bg-red-50 border border-red-100 px-2.5 py-1.5 text-[10px] font-semibold text-red-700">
                          ⚠ {droppedActuals.length} month
                          {droppedActuals.length !== 1 ? "s" : ""} before the
                          new start already{" "}
                          {droppedActuals.length !== 1 ? "have" : "has"} actual
                          savings entered. Changing the real start will DELETE
                          those months and their realized savings. Record/export
                          them before saving.
                        </p>
                      ) : null;
                    })()}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>
                  Change Mode{" "}
                  <span className="font-normal text-slate-400">
                    — confirmed in Phase 1 by PM
                  </span>
                </label>
                <select
                  className={inp}
                  value={normalizeChangeMode(form.change_mode)}
                  onChange={(e) => set("change_mode", e.target.value)}
                >
                  <option value="">— To be confirmed in Phase 1 —</option>
                  <option>Standard</option>
                  <option>Silent</option>
                </select>
              </div>
              <div>
                <label className={label}>Currency</label>
                <select
                  className={inp}
                  value={form.currency}
                  onChange={(e) => {
                    const c = e.target.value;
                    set("currency", c);
                    // EUR has no conversion — reset the rate so a stale non-1 value from a
                    // previous currency can't be saved against EUR.
                    if (c === "EUR") set("fx_rate_to_eur", "1");
                  }}
                >
                  {["EUR", "USD", "RMB", "INR"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>
                  FX rate → EUR{" "}
                  <span className="font-normal text-slate-400">
                    — {form.currency || "EUR"} amount × rate = EUR (for group
                    reporting)
                  </span>
                </label>
                <input
                  type="number"
                  step="0.000001"
                  disabled={form.currency === "EUR" || isFxLocked}
                  className={`${inp} ${
                    form.currency === "EUR" || isFxLocked
                      ? "bg-slate-100 cursor-not-allowed text-slate-500"
                      : !form.fx_rate_to_eur ||
                          parseFloat(form.fx_rate_to_eur) <= 0
                        ? "border-amber-400 focus:border-amber-500 focus:ring-amber-100"
                        : ""
                  }`}
                  value={form.currency === "EUR" ? "1" : form.fx_rate_to_eur}
                  onChange={(e) => set("fx_rate_to_eur", e.target.value)}
                />
                {isFxLocked && form.currency !== "EUR" && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    FX rate is locked — a Budgeted commitment or actual saving
                    has been recorded.
                  </p>
                )}
                {form.currency !== "EUR" &&
                  (!form.fx_rate_to_eur ||
                    parseFloat(form.fx_rate_to_eur) <= 0) && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
                      <AlertTriangle size={10} className="shrink-0" />
                      Required — without this rate, all KPI and budget totals
                      for this opportunity will be wrong (counted at 1:1).
                    </p>
                  )}
              </div>
            </div>
          </div>
          {/* Alert recipients — required for delay alerts and escalations */}
          {!isPhase0 && (!form.purchasing_owner || !form.conversion_owner) && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠</span>
              <span>
                <strong>
                  Purchasing Owner and Conversion Owner are required
                </strong>{" "}
                to receive missing data alerts and escalation emails.
              </span>
            </div>
          )}
          {!isPhase0 && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>
                  Purchasing Owner
                  <span className="ml-1 text-red-400">*</span>
                  <span className="ml-1.5 font-normal text-slate-400">
                    — receives tracking alerts
                  </span>
                </label>
                <MemberDirectoryPicker
                  fetchDirectory={() => supplierAPI.getPmDirectoryAuthenticated()}
                  fetchKey="purchasing_owner"
                  value={form.purchasing_owner}
                  onChange={(email) => set("purchasing_owner", email)}
                  placeholder="purchasing.manager@avocarbon.com"
                />
              </div>
              <div>
                <label className={label}>
                  Conversion Owner
                  <span className="ml-1 text-red-400">*</span>
                  <span className="ml-1.5 font-normal text-slate-400">
                    — enters monthly actuals
                  </span>
                </label>
                <MemberDirectoryPicker
                  fetchDirectory={() => supplierAPI.getPmDirectoryAuthenticated()}
                  fetchKey="conversion_owner"
                  value={form.conversion_owner}
                  onChange={(email) => set("conversion_owner", email)}
                  placeholder="buyer@avocarbon.com"
                />
              </div>
            </div>
          )}
          {/* PLD scoring — compact — hidden for Negotiation/Cash, which skip PLD entirely */}
          {!isFlatType && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">
                  PLD
                </span>
                <div className="flex items-center gap-1.5 text-[11px]">
                  {livePScore != null && (
                    <span className="text-slate-500">
                      P=<b className="text-slate-700">{livePScore}</b>
                    </span>
                  )}
                  {liveLScore != null && (
                    <span className="text-slate-400">
                      × L=<b className="text-slate-700">{liveLScore}</b>
                    </span>
                  )}
                  {liveDScore != null && (
                    <span className="text-slate-400">
                      × D=<b className="text-slate-700">{liveDScore}</b>
                    </span>
                  )}
                  {pScore != null ? (
                    <>
                      <span className="text-slate-400">=</span>
                      <span className="font-black text-blue-700 text-sm">
                        {pScore}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pldColor(pCat)}`}
                      >
                        {pCat}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-300 text-[10px]">
                      incomplete
                    </span>
                  )}
                </div>
              </div>

              {isSourced && (
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  {/* P */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-black text-blue-700">
                        P
                      </span>
                      <span className="text-slate-500 font-medium">
                        Pay-back
                      </span>
                    </div>
                    <div className="rounded bg-white border border-slate-100 px-2 py-1 text-[10px]">
                      {_pldHasInvData ? (
                        <span
                          className={`font-semibold ${livePScore! <= 2 ? "text-emerald-600" : livePScore! >= 4 ? "text-red-500" : "text-amber-500"}`}
                        >
                          {_pldPaybackMonths === 0
                            ? "0 mo."
                            : _pldPaybackMonths >= 999
                              ? "∞"
                              : `${_pldPaybackMonths.toFixed(1)} mo.`}
                          {livePScore != null && (
                            <span className="ml-1 text-slate-400">
                              → {livePScore}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300">
                          fill costs + saving
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-400 space-y-0.5">
                      {(
                        [
                          ["0 mo.", "1 ★"],
                          ["≤2 mo.", "2"],
                          ["≤4 mo.", "3"],
                          ["≤12 mo.", "4"],
                          [">12 mo.", "5"],
                        ] as [string, string][]
                      ).map(([v, s]) => (
                        <div
                          key={s}
                          className={`flex justify-between px-1 rounded ${String(livePScore) === s.replace(" ★", "") ? "bg-blue-50 text-blue-600 font-semibold" : ""}`}
                        >
                          <span>{v}</span>
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* L */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-black text-blue-700">
                        L
                      </span>
                      <span className="text-slate-500 font-medium">
                        Lead-time
                      </span>
                    </div>
                    <div className="rounded bg-white border border-slate-100 px-2 py-1 text-[10px]">
                      {_pldTotalWeeks > 0 ? (
                        <span
                          className={`font-semibold ${liveLScore! <= 2 ? "text-emerald-600" : liveLScore! >= 4 ? "text-red-500" : "text-amber-500"}`}
                        >
                          {_pldTotalWeeks} wks = {_pldLeadMonths.toFixed(1)} mo.
                          {liveLScore != null && (
                            <span className="ml-1 text-slate-400">
                              → {liveLScore}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300">fill phase weeks</span>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-400 space-y-0.5">
                      {(
                        [
                          ["<1m", "1 ★"],
                          ["<2m", "2"],
                          ["<4m", "3"],
                          ["<6m", "4"],
                          ["≥6m", "5"],
                        ] as [string, string][]
                      ).map(([v, s]) => (
                        <div
                          key={s}
                          className={`flex justify-between px-1 rounded ${String(liveLScore) === s.replace(" ★", "") ? "bg-blue-50 text-blue-600 font-semibold" : ""}`}
                        >
                          <span>{v}</span>
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* D */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-black text-blue-700">
                        D
                      </span>
                      <span className="text-slate-500 font-medium">
                        Difficulty
                      </span>
                    </div>
                    <select
                      className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] outline-none focus:border-blue-300"
                      value={liveDScore ?? ""}
                      onChange={(e) =>
                        set(
                          "difficulty_score",
                          e.target.value as unknown as number,
                        )
                      }
                    >
                      <option value="">— select —</option>
                      <option value="1">1 — Easy</option>
                      <option value="2">2 — Relatively easy</option>
                      <option value="3">3 — Moderately difficult</option>
                      <option value="4">4 — Difficult</option>
                      <option value="5">5 — Very Difficult</option>
                    </select>
                    <div className="text-[9px] text-slate-400 space-y-0.5">
                      {(
                        [
                          ["Easy", "1 ★"],
                          ["Rel. easy", "2"],
                          ["Moderate", "3"],
                          ["Difficult", "4"],
                          ["Very diff.", "5"],
                        ] as [string, string][]
                      ).map(([v, s]) => (
                        <div
                          key={s}
                          className={`flex justify-between px-1 rounded ${String(liveDScore) === s.replace(" ★", "") ? "bg-blue-50 text-blue-600 font-semibold" : ""}`}
                        >
                          <span>{v}</span>
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* PLD scores — manual for STP; hidden entirely for Negotiation/Cash */}
          {!isFlatType && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  PLD Scores
                </p>
                {isSourced && (
                  <p className="text-[10px] text-slate-400 text-right leading-relaxed">
                    P &amp; L auto-calculated — set to override, clear to reset
                  </p>
                )}
              </div>
              {isSourced && (
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-[10.5px] text-blue-700 flex flex-wrap gap-3">
                  <span>
                    Auto P: <strong>{_autoP ?? "—"}</strong>
                  </span>
                  <span>
                    Auto L: <strong>{_autoL ?? "—"}</strong>
                  </span>
                  {(form.payback_score || form.lead_time_score) && (
                    <button
                      type="button"
                      onClick={() => {
                        set("payback_score", "" as unknown as number);
                        set("lead_time_score", "" as unknown as number);
                      }}
                      className="ml-auto text-blue-500 hover:text-blue-700 underline text-[10px]"
                    >
                      Reset P &amp; L to auto
                    </button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={label}>
                    P — Pay-back
                    <span className="ml-1 font-normal text-slate-400">
                      (1 = quick)
                    </span>
                  </label>
                  <select
                    className={inp}
                    value={form.payback_score ?? ""}
                    onChange={(e) =>
                      set("payback_score", e.target.value as unknown as number)
                    }
                  >
                    <option value="">— select —</option>
                    <option value="1">1 — Immediate / &lt;1 mo.</option>
                    <option value="2">2 — ≤2 months</option>
                    <option value="3">3 — ≤4 months</option>
                    <option value="4">4 — ≤12 months</option>
                    <option value="5">5 — &gt;12 months</option>
                  </select>
                </div>
                <div>
                  <label className={label}>
                    L — Lead-time
                    <span className="ml-1 font-normal text-slate-400">
                      (1 = fast)
                    </span>
                  </label>
                  <select
                    className={inp}
                    value={form.lead_time_score ?? ""}
                    onChange={(e) =>
                      set(
                        "lead_time_score",
                        e.target.value as unknown as number,
                      )
                    }
                  >
                    <option value="">— select —</option>
                    <option value="1">1 — &lt;1 month</option>
                    <option value="2">2 — &lt;2 months</option>
                    <option value="3">3 — &lt;4 months</option>
                    <option value="4">4 — &lt;6 months</option>
                    <option value="5">5 — ≥6 months</option>
                  </select>
                </div>
                <div>
                  <label className={label}>
                    D — Difficulty
                    <span className="ml-1 font-normal text-slate-400">
                      (1 = easy)
                    </span>
                  </label>
                  <select
                    className={inp}
                    value={form.difficulty_score ?? ""}
                    onChange={(e) =>
                      set(
                        "difficulty_score",
                        e.target.value as unknown as number,
                      )
                    }
                  >
                    <option value="">— select —</option>
                    <option value="1">1 — Easy</option>
                    <option value="2">2 — Relatively easy</option>
                    <option value="3">3 — Moderately difficult</option>
                    <option value="4">4 — Difficult</option>
                    <option value="5">5 — Very Difficult</option>
                  </select>
                </div>
              </div>
              {/* Force priority override */}
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-[10.5px] font-semibold text-slate-500 shrink-0">
                    Force priority:
                  </span>
                  <select
                    className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 bg-white"
                    value={form.forced_priority}
                    onChange={(e) => set("forced_priority", e.target.value)}
                  >
                    <option value="">— auto (P×L×D) —</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                {form.forced_priority ? (
                  <p className="text-[10px] text-amber-600 flex items-center gap-1">
                    <AlertTriangle size={10} /> Manual override active — PLD
                    score ignored
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400">
                    Auto: P×L×D ={" "}
                    {pScore != null ? (
                      <span className="font-semibold">{pScore}</span>
                    ) : (
                      "—"
                    )}{" "}
                    → <span className="font-semibold">{pCat ?? "—"}</span>
                  </p>
                )}
              </div>
            </div>
          )}
          <div>
            <label className={label}>Comments</label>
            <textarea
              rows={2}
              className={`${inp} resize-none`}
              value={form.comments}
              onChange={(e) => set("comments", e.target.value)}
            />
          </div>
        </div>

        {/* STP study — only for Sourcing / Technical Productivity, same form & save */}
        {showStpSection && (
          <div className="order-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <FileText size={11} /> STP Study — Sourcing &amp; Technical
              Productivity
            </p>
            <p className="text-[11px] text-slate-500">
              Workbook-aligned inputs. Prices &amp; quantities below drive the
              savings estimate shown in the Financial baseline above.
            </p>

            {canEditStpDirectly && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <strong>Director / VP override.</strong> The STP baseline is
                normally locked in execution, but as an approver you can edit
                prices, quantities and bonuses directly here — changes save
                immediately, no revision request needed.
              </div>
            )}

            {stpReadOnly && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {pendingApproval ? (
                  <>
                    <strong>STP awaiting a gate decision.</strong> It has been
                    submitted for review, so it is locked to keep it identical
                    to the version the reviewer received. It unlocks if the gate
                    returns it for rework.
                  </>
                ) : isStpPhase23 ? (
                  <div className="flex flex-col gap-2">
                    <p>
                      <strong>STP locked in execution.</strong> Prices and
                      quantities are committed. Only the Purchasing Director or
                      VP Conversion can change them at this stage.
                    </p>
                    {/* DISABLED — Request Revision creation turned off; PD/VPC edit
                        directly instead (see canEditStpDirectly above). Re-enable by
                        uncommenting this block and the matching backend endpoint in
                        purchasing_value/router.py. */}
                    {false && !hasPendingSTPRevision && (
                      <button
                        type="button"
                        onClick={() => setStpRevModal(true)}
                        className="self-start rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        Request Revision
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <strong>STP locked.</strong> Prices, quantities and the
                    savings baseline can be filled and revised in Phase 0–1.
                    From Phase 2 onward the opportunity is committed to
                    execution, so the STP is read-only here.
                    {isBudgeted &&
                      " Changing a committed baseline requires a reviewed Revise, not a silent edit."}
                  </>
                )}
              </div>
            )}

            {/* Pending revision banner — shown while awaiting Director decision */}
            {hasPendingSTPRevision &&
              (() => {
                const rev = opp.pending_stp_revision as Record<string, unknown>;
                const requested_at = rev.requested_at as string | undefined;
                const director_emails = rev.director_emails as
                  | string[]
                  | undefined;
                const note = rev.note as string | undefined;
                const proposed = rev.proposed_fields as
                  | Record<string, unknown>
                  | undefined;
                const preview = rev.computed_preview as
                  | Record<string, unknown>
                  | undefined;
                return (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
                        <Clock size={13} /> Revision pending Director approval
                      </p>
                      {canDecideStpRevision && (
                        <button
                          type="button"
                          onClick={() => setStpDecModal(true)}
                          className="rounded-lg bg-blue-700 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-800"
                        >
                          Approve / Reject
                        </button>
                      )}
                    </div>
                    {director_emails && director_emails.length > 0 && (
                      <p className="text-xs text-blue-700">
                        Sent to <strong>{director_emails.join(", ")}</strong>
                        {requested_at &&
                          ` on ${new Date(requested_at).toLocaleDateString("en-GB")}`}
                      </p>
                    )}
                    {note && (
                      <p className="text-xs text-blue-600 italic">"{note}"</p>
                    )}
                    {proposed && (
                      <div className="text-xs text-blue-700 grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1">
                        {(
                          [
                            "current_price",
                            "proposed_price",
                            "proposed_price_n1",
                            "proposed_price_n2",
                            "proposed_price_n3",
                          ] as const
                        ).map((k) =>
                          proposed[k] != null ? (
                            <span key={k}>
                              <span className="font-semibold">
                                {k.replace(/_/g, " ")}
                              </span>
                              : {String(proposed[k])}
                            </span>
                          ) : null,
                        )}
                        {preview && preview.period_saving != null && (
                          <span className="col-span-2 font-semibold text-blue-800 pt-0.5">
                            Projected saving: €
                            {Number(preview.period_saving).toLocaleString(
                              "en-GB",
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

            <fieldset
              disabled={stpReadOnly}
              className={stpReadOnly ? "space-y-4 opacity-80" : "space-y-4"}
            >
              {/* Why checkboxes */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Why
                </p>
                <div className="flex flex-wrap gap-3">
                  {[
                    ["reason_productivity", "Productivity"],
                    ["reason_quality", "Quality"],
                    ["reason_capacity", "Capacity"],
                  ].map(([k, lbl]) => (
                    <label
                      key={k}
                      className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="accent-blue-600"
                        checked={form[k as keyof typeof form] as boolean}
                        onChange={(e) =>
                          set(k, e.target.checked as unknown as string)
                        }
                      />
                      {lbl}
                    </label>
                  ))}
                  <input
                    className={`${inp} flex-1 min-w-[120px]`}
                    placeholder="Other..."
                    value={form.reason_other}
                    onChange={(e) => set("reason_other", e.target.value)}
                  />
                </div>
              </div>

              {/* Scope, customers, plants & annual quantities */}
              <div
                className={`rounded-xl border bg-white p-3 space-y-3 ${gateHighlight && missingFlags.scope ? "border-2 border-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]" : "border-slate-200"}`}
              >
                <p
                  className={`text-[10px] font-bold uppercase tracking-widest ${gateHighlight && missingFlags.scope ? "text-rose-600" : "text-slate-400"}`}
                >
                  Scope &amp; Customers
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={hiLabel(missingFlags.scopeIn)}>
                      Scope IN (part numbers)
                    </label>
                    <input
                      disabled={locked}
                      className={`${hi(missingFlags.scopeIn)} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
                      placeholder="27102500010"
                      value={form.scope_in}
                      onChange={(e) => set("scope_in", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label}>Scope OUT</label>
                    <input
                      disabled={locked}
                      className={`${inp} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
                      placeholder="NA"
                      value={form.scope_out}
                      onChange={(e) => set("scope_out", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={hiLabel(missingFlags.customers)}>
                      Customers
                    </label>
                    <input
                      className={hi(missingFlags.customers)}
                      placeholder="Valeo, Multipe..."
                      value={form.customers}
                      onChange={(e) => set("customers", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label}>Main Avocarbon Plant</label>
                    <select
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
                  <div>
                    <label className={label}>Secondary plants</label>
                    <input
                      className={inp}
                      placeholder="Kunshan, Tianjin..."
                      value={form.secondary_plants}
                      onChange={(e) => set("secondary_plants", e.target.value)}
                    />
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <p className={label}>
                    Annual Quantities{" "}
                    <span className="font-normal text-slate-400">
                      — N1 is used to auto-calc the first-year saving
                    </span>
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    {(
                      [
                        ["annual_quantity_n1", "N1"],
                        ["annual_quantity_n2", "N2"],
                        ["annual_quantity_n3", "N3"],
                        ["annual_quantity_n4", "N4"],
                      ] as [string, string][]
                    ).map(([k, lbl]) => {
                      const isMissing =
                        k === "annual_quantity_n1" && missingFlags.quantity;
                      return (
                        <div key={k}>
                          <label className={hiLabel(isMissing)}>{lbl}</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            disabled={locked}
                            className={`${hi(isMissing)} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
                            value={fmtIntInput(
                              form[k as keyof typeof form] as string,
                            )}
                            onChange={(e) => set(k, stripInt(e.target.value))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Initial Step */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Initial Step
                </p>
                <p className="text-[11px] text-slate-500">
                  Has the current supplier been formally given a chance to
                  decrease the price?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Answer</label>
                    <select
                      className={inp}
                      value={form.supplier_asked}
                      onChange={(e) => set("supplier_asked", e.target.value)}
                    >
                      <option value="">— Select —</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  <div>
                    <label className={label}>Result / explanation</label>
                    <input
                      className={inp}
                      placeholder="e.g. Declined to match price"
                      value={form.supplier_asked_result}
                      onChange={(e) =>
                        set("supplier_asked_result", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Current supplier class evaluation — read from existing DB (PldClassEvaluationInput) */}
              {currentSupplierEval && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                    Current Supplier — Latest Class Evaluation (from panel)
                  </p>
                  <p className="text-[10px] text-emerald-500">
                    This data is read from the existing supplier evaluation — no
                    need to re-enter it.
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
                    {[
                      ["Supplier status", "supplier_status"],
                      ["Class", "class_value_relation"],
                      ["Operational grade", "operational_grade"],
                      ["Final grade", "final_grade"],
                      ["Panel decision", "panel_decision"],
                      ["TOP (payment terms)", "top"],
                      ["LTA", "lta"],
                      ["Competitiveness", "competitiveness"],
                      ["SQMA", "sqma"],
                      ["Financial health", "financial_health"],
                      ["Geo coverage", "geo_coverage"],
                      ["Family coverage", "family_coverage"],
                    ].map(([lbl, key]) =>
                      currentSupplierEval[key] != null ? (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-slate-400 w-36 shrink-0">
                            {lbl}
                          </span>
                          <span className="font-semibold text-slate-700">
                            {String(currentSupplierEval[key])}
                          </span>
                        </div>
                      ) : null,
                    )}
                  </div>
                </div>
              )}

              {/* Supplier before/after — full STP comparison */}
              <FormSection
                title="Supplier Comparison (Before → After)"
                defaultOpen={true}
                highlight={
                  gateHighlight &&
                  (missingFlags.prices ||
                    missingFlags.logistics ||
                    missingFlags.supplierName)
                }
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Current Supplier — Before</label>
                    {isPhase0 ? (
                      <>
                        <select
                          className={inp}
                          value={form.supplier_id}
                          onChange={(e) => set("supplier_id", e.target.value)}
                        >
                          <option value="">— Select current supplier —</option>
                          {suppliersForPlant.map((s) => (
                            <option
                              key={s.id_supplier_unit}
                              value={s.id_supplier_unit}
                            >
                              {[s.group_name, s.supplier_name, s.city]
                                .filter(Boolean)
                                .join(" · ")}
                            </option>
                          ))}
                        </select>
                        {suppliersForPlant.length === 0 && opp.plant_id && (
                          <p className="text-[10px] text-amber-500 mt-1">
                            No suppliers linked to this plant yet.
                          </p>
                        )}
                      </>
                    ) : (
                      (() => {
                        const before = suppliersForPlant.find(
                          (s) =>
                            s.id_supplier_unit ===
                            (opp.supplier_id ??
                              parseInt(form.supplier_id || "0")),
                        );
                        return (
                          <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 min-h-[28px]">
                            {before
                              ? [
                                  before.group_name,
                                  before.supplier_name,
                                  before.city,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")
                              : opp.supplier_id
                                ? `ID ${opp.supplier_id}`
                                : "—"}
                          </div>
                        );
                      })()
                    )}
                  </div>
                  <div>
                    <label className={hiLabel(missingFlags.supplierName)}>
                      Proposed New Supplier — After
                    </label>
                    {isPhase0 ? (
                      <>
                        <input
                          className={hi(missingFlags.supplierName)}
                          placeholder="Longrun, Haihe... (free text in Phase 0)"
                          value={form.proposed_supplier_name}
                          onChange={(e) =>
                            set("proposed_supplier_name", e.target.value)
                          }
                        />
                        <p className="text-[9.5px] text-slate-400 mt-0.5">
                          Free text in Phase 0 — link to panel from Phase 1
                        </p>
                      </>
                    ) : (
                      <>
                        <select
                          className={hi(missingFlags.supplierName)}
                          value={form.proposed_supplier_id}
                          onChange={(e) =>
                            set("proposed_supplier_id", e.target.value)
                          }
                        >
                          <option value="">— Select from panel —</option>
                          {suppliersForPlant.map((s) => (
                            <option
                              key={s.id_supplier_unit}
                              value={s.id_supplier_unit}
                            >
                              {[s.group_name, s.supplier_name, s.city]
                                .filter(Boolean)
                                .join(" · ")}
                            </option>
                          ))}
                        </select>
                        {opp.proposed_supplier_name && (
                          <p className="text-[9.5px] text-slate-400 mt-0.5">
                            Phase 0 candidate:{" "}
                            <span className="font-medium text-slate-600">
                              {opp.proposed_supplier_name}
                            </span>
                          </p>
                        )}
                        {suppliersForPlant.length === 0 && opp.plant_id && (
                          <p className="text-[10px] text-amber-500 mt-1">
                            No suppliers linked to this plant yet.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {/* Logistics: Before / After table */}
                <div className="scroll-x-visible">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-3 py-2 text-left font-semibold text-slate-500 w-1/3">
                          Field
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">
                          Before
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">
                          After
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Country — Before is derived from the selected supplier (form.supplier_id) */}
                      {(() => {
                        const currentSupplierCountry =
                          suppliersForPlant.find(
                            (s) =>
                              s.id_supplier_unit ===
                              (parseInt(form.supplier_id || "0") ||
                                opp.supplier_id),
                          )?.city ?? null;
                        return (
                          <tr className="border-t border-slate-100">
                            <td className="px-3 py-1.5 font-semibold text-slate-500">
                              Country
                            </td>
                            <td className="px-3 py-1.5">
                              {currentSupplierCountry ? (
                                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                                  {currentSupplierCountry}{" "}
                                  <span className="font-normal text-emerald-500">
                                    (from panel)
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-300 text-[10px]">
                                  Select supplier above
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                className={hiCell(missingFlags.countryAfter)}
                                placeholder="China"
                                value={form.country_after}
                                onChange={(e) =>
                                  set("country_after", e.target.value)
                                }
                              />
                            </td>
                          </tr>
                        );
                      })()}
                      {/* Incoterms — dropdown of the standard ICC abbreviations */}
                      <tr className="border-t border-slate-100">
                        <td className="px-3 py-1.5 font-semibold text-slate-500">
                          Incoterms
                        </td>
                        {(["incoterms_before", "incoterms_after"] as const).map(
                          (k) => (
                            <td key={k} className="px-3 py-1.5">
                              <select
                                className={hiCell(
                                  k === "incoterms_before" &&
                                    missingFlags.incoterms,
                                )}
                                value={form[k as keyof typeof form] as string}
                                onChange={(e) => set(k, e.target.value)}
                              >
                                <option value="">—</option>
                                {INCOTERMS_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.value} — {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                          ),
                        )}
                      </tr>
                      {/* Place of Incoterms — free text (e.g. named port/place) */}
                      <tr className="border-t border-slate-100">
                        <td className="px-3 py-1.5 font-semibold text-slate-500">
                          Place of Incoterms
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            className={hiCell(false)}
                            placeholder="Shanghai"
                            value={form.place_of_incoterms_before}
                            onChange={(e) =>
                              set("place_of_incoterms_before", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            className={hiCell(false)}
                            placeholder="Poitiers"
                            value={form.place_of_incoterms_after}
                            onChange={(e) =>
                              set("place_of_incoterms_after", e.target.value)
                            }
                          />
                        </td>
                      </tr>
                      {(
                        [
                          [
                            "top_days_before",
                            "top_days_after",
                            "TOP (days)",
                            "45",
                            "105",
                          ],
                          [
                            "transit_days_before",
                            "transit_days_after",
                            "Transit time (days)",
                            "3",
                            "6",
                          ],
                          [
                            "bonus_before",
                            "bonus_after",
                            "Bonus / business link",
                            "0",
                            "0",
                          ],
                        ] as [string, string, string, string, string][]
                      ).map(([kb, ka, lbl, ph1, ph2]) => {
                        const rowMissing =
                          kb === "incoterms_before" && missingFlags.incoterms;
                        return (
                          <tr key={kb} className="border-t border-slate-100">
                            <td className="px-3 py-1.5 font-semibold text-slate-500">
                              {lbl}
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                className={hiCell(rowMissing)}
                                placeholder={ph1}
                                value={form[kb as keyof typeof form] as string}
                                onChange={(e) => set(kb, e.target.value)}
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                className={hiCell(rowMissing)}
                                placeholder={ph2}
                                value={form[ka as keyof typeof form] as string}
                                onChange={(e) => set(ka, e.target.value)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                      {/* Consignment — Yes/No selects (needed for inventory gap formula) */}
                      <tr className="border-t border-slate-100">
                        <td className="px-3 py-1.5 font-semibold text-slate-500">
                          Consignment
                        </td>
                        {(
                          ["consignment_before", "consignment_after"] as const
                        ).map((k) => (
                          <td key={k} className="px-3 py-1.5">
                            <select
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 bg-white"
                              value={form[k as keyof typeof form] as string}
                              onChange={(e) => set(k, e.target.value)}
                            >
                              <option value="">—</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </td>
                        ))}
                      </tr>
                      {(
                        [
                          [
                            "current_price",
                            "proposed_price",
                            "Delivered price, including taxes and freight (€/unit)",
                            "0.4000",
                            "0.1300",
                          ],
                          [
                            "current_price_n1",
                            "proposed_price_n1",
                            "Price N+1",
                            "0.3880",
                            "0.1261",
                          ],
                          [
                            "current_price_n2",
                            "proposed_price_n2",
                            "Price N+2",
                            "0.3762",
                            "0.1223",
                          ],
                          [
                            "current_price_n3",
                            "proposed_price_n3",
                            "Price N+3",
                            "0.3650",
                            "0.1186",
                          ],
                        ] as [string, string, string, string, string][]
                      ).map(([kb, ka, lbl, ph1, ph2]) => {
                        const rowMissing =
                          kb === "current_price" && missingFlags.prices;
                        return (
                          <tr key={ka} className="border-t border-slate-100">
                            <td className="px-3 py-1.5 font-semibold text-slate-500">
                              {lbl}
                            </td>
                            <td className="px-3 py-1.5">
                              {kb ? (
                                <input
                                  type="number"
                                  step="0.000001"
                                  disabled={locked}
                                  className={`${hiCell(rowMissing)} ${locked ? "bg-slate-100" : ""}`}
                                  placeholder={ph1}
                                  value={
                                    form[kb as keyof typeof form] as string
                                  }
                                  onChange={(e) => set(kb, e.target.value)}
                                />
                              ) : (
                                <span className="text-slate-300 text-[10px]">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="number"
                                step="0.000001"
                                disabled={locked}
                                className={`${hiCell(rowMissing)} ${locked ? "bg-slate-100" : ""}`}
                                placeholder={ph2}
                                value={form[ka as keyof typeof form] as string}
                                onChange={(e) => set(ka, e.target.value)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!locked && fullYearSaving != null && (
                    <p className="mt-1 text-[10px] text-emerald-600 font-semibold px-3">
                      Auto-calculated saving: (€
                      {parseFloat(form.current_price).toFixed(4)} − €
                      {parseFloat(form.proposed_price).toFixed(4)}) ×{" "}
                      {parseInt(form.annual_quantity_n1).toLocaleString(
                        "en-GB",
                      )}
                      {bonusDelta !== 0 && (
                        <>
                          {" "}
                          {bonusDelta > 0 ? "+" : "−"} €
                          {Math.abs(bonusDelta).toLocaleString("en-GB")} bonus
                        </>
                      )}{" "}
                      ={" "}
                      <strong>
                        €{autoSaving?.toLocaleString("en-GB")}/year
                      </strong>
                    </p>
                  )}
                </div>
              </FormSection>

              {/* Risks */}
              <FormSection
                title="Risks"
                highlight={
                  gateHighlight &&
                  !(
                    opp.stp_risks?.material_indexation_before &&
                    opp.stp_risks?.material_indexation_after
                  )
                }
              >
                <div className="scroll-x-visible">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-3 py-2 text-left font-semibold text-slate-500 w-[22%]">
                          Risk
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500 w-[14%]">
                          Before
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500 w-[14%]">
                          After
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">
                          Description / Mitigation approach
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          [
                            "risk_material_indexation_before",
                            "risk_material_indexation_after",
                            "risk_material_indexation_desc",
                            "Material indexation",
                          ],
                          [
                            "risk_exchange_rate_before",
                            "risk_exchange_rate_after",
                            "risk_exchange_rate_desc",
                            "Exchange rate",
                          ],
                          [
                            "risk_local_content_before",
                            "risk_local_content_after",
                            "risk_local_content_desc",
                            "Local content",
                          ],
                          [
                            "risk_quality_before",
                            "risk_quality_after",
                            "risk_quality_desc",
                            "Quality",
                          ],
                          [
                            "risk_other_before",
                            "risk_other_after",
                            "risk_other_desc",
                            "Other",
                          ],
                        ] as [string, string, string, string][]
                      ).map(([kb, ka, kd, lbl]) => (
                        <tr key={kb} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 font-semibold text-slate-500">
                            {lbl}
                          </td>
                          <td className="px-3 py-1.5">
                            <select
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 bg-white"
                              value={form[kb as keyof typeof form] as string}
                              onChange={(e) => set(kb, e.target.value)}
                            >
                              <option value="">—</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <select
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 bg-white"
                              value={form[ka as keyof typeof form] as string}
                              onChange={(e) => set(ka, e.target.value)}
                            >
                              <option value="">—</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300"
                              placeholder="If needed — describe risk or mitigation..."
                              value={form[kd as keyof typeof form] as string}
                              onChange={(e) => set(kd, e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                      {/* Divider before spec questions */}
                      <tr>
                        <td colSpan={4} className="px-3 pt-3 pb-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Specification Assumptions
                          </span>
                        </td>
                      </tr>
                      {(
                        [
                          [
                            "material_same_spec",
                            "Will material spec & appearance be the same?",
                          ],
                          ["same_tooling", "Same tooling?"],
                          ["same_dimension", "Same dimensions & appearance?"],
                          ["same_process", "Same process?"],
                        ] as [string, string][]
                      ).map(([k, lbl]) => (
                        <tr key={k} className="border-t border-slate-100">
                          <td
                            className="px-3 py-1.5 font-semibold text-slate-500"
                            colSpan={2}
                          >
                            {lbl}
                          </td>
                          <td className="px-3 py-1.5" colSpan={2}>
                            <select
                              className="w-36 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 bg-white"
                              value={form[k as keyof typeof form] as string}
                              onChange={(e) => set(k, e.target.value)}
                            >
                              <option value="">—</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                              <option value="N/A">N/A</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FormSection>

              {/* Benefits */}
              <FormSection
                title="Benefits"
                highlight={
                  gateHighlight &&
                  !(opp.stp_benefits?.if_we_do || opp.stp_benefits?.if_not)
                }
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>If we do</label>
                    <textarea
                      rows={2}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 resize-none"
                      placeholder="Expected benefits if we proceed..."
                      value={form.benefit_if_we_do}
                      onChange={(e) => set("benefit_if_we_do", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label}>If we don't</label>
                    <textarea
                      rows={2}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 resize-none"
                      placeholder="Risk of not proceeding..."
                      value={form.benefit_if_not}
                      onChange={(e) => set("benefit_if_not", e.target.value)}
                    />
                  </div>
                </div>
              </FormSection>

              {/* Investment costs */}
              <FormSection title="Investment Costs">
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className={label}>Tooling (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={inp}
                      value={fmtDecInput(form.tooling_cost)}
                      onChange={(e) =>
                        set("tooling_cost", stripDec(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <label className={label}>Travel (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={inp}
                      value={fmtDecInput(form.travel_cost)}
                      onChange={(e) =>
                        set("travel_cost", stripDec(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <label className={label}>Qualification (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={inp}
                      value={fmtDecInput(form.qualification_cost)}
                      onChange={(e) =>
                        set("qualification_cost", stripDec(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <label className={label}>Other (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={inp}
                      value={fmtDecInput(form.other_cost)}
                      onChange={(e) =>
                        set("other_cost", stripDec(e.target.value))
                      }
                    />
                  </div>
                </div>
                {_pldTotalInv > 0 && (
                  <div className="mt-2 text-xs text-slate-500">
                    Total investment:{" "}
                    <strong>€{_pldTotalInv.toLocaleString("en-GB")}</strong>
                  </div>
                )}
              </FormSection>

              {/* EBITDA & Cash savings — live, Excel "format STP rev 1.2" formulas */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                  EBITDA &amp; Cash Savings — auto-calculated (STP rev 1.2
                  formulas)
                </p>
                <p className="text-[10px] text-emerald-500">
                  Computed live from prices, quantities, bonus, costs and
                  logistics — same formulas as the STP workbook.
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  {(
                    [
                      ["EBITDA Full year (1st)", fullYearSaving, "€", ""],
                      ["EBITDA Period (N1–N4)", periodSaving, "€", ""],
                      ["ROI Full year", roiFullYear, "", "%"],
                      ["ROI Period", roiPeriod, "", "%"],
                      ["Est. Inventory gap", inventoryGap, "€", ""],
                      ["Est. AP gap", apGap, "€", ""],
                    ] as [string, number | null, string, string][]
                  ).map(([lbl, val, pre, suf]) => {
                    // Snap negative-zero / sub-cent values to 0 so they don't render as "-0"
                    const shown =
                      val != null && Math.abs(val) < 0.005 ? 0 : val;
                    return (
                      <div
                        key={lbl}
                        className="flex items-center justify-between gap-2 border-b border-emerald-100/60 pb-1"
                      >
                        <span className="text-slate-500">{lbl}</span>
                        <span
                          className={`font-bold ${shown != null && shown < 0 ? "text-red-600" : "text-slate-700"}`}
                        >
                          {shown != null
                            ? `${pre}${shown.toLocaleString("en-GB", { maximumFractionDigits: 2 })}${suf}`
                            : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {savingPerYear != null && (
                  <div className="pt-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">
                      Est. Saving per year
                    </p>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {(["N", "N+1", "N+2", "N+3"] as const).map((yr, i) => (
                        <div
                          key={yr}
                          className="rounded-lg bg-white/70 border border-emerald-100 px-2 py-1"
                        >
                          <div className="text-[10px] text-slate-400">
                            Year {yr}
                          </div>
                          <div
                            className={`font-bold ${savingPerYear[i] < 0 ? "text-red-600" : "text-slate-700"}`}
                          >
                            €
                            {savingPerYear[i].toLocaleString("en-GB", {
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {savingByYear != null && savingByYear.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">
                      Est. Saving by calendar year (from savings start)
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {savingByYear.map(({ year, amount }) => (
                        <div
                          key={year}
                          className="rounded-lg bg-white/70 border border-emerald-100 px-2 py-1"
                        >
                          <div className="text-[10px] text-slate-400">
                            {year}
                          </div>
                          <div
                            className={`font-bold ${amount < 0 ? "text-red-600" : "text-slate-700"}`}
                          >
                            €
                            {amount.toLocaleString("en-GB", {
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Planning */}
              <FormSection
                title="Estimated Planning (weeks)"
                highlight={
                  gateHighlight &&
                  !isNegotiation &&
                  !(opp.phase1_weeks && opp.phase1_weeks > 0)
                }
              >
                <div>
                  <label className={label}>Phase 1 Starting Date</label>
                  <input
                    type="date"
                    className={inp}
                    value={form.execution_start_date}
                    onChange={(e) =>
                      set("execution_start_date", e.target.value)
                    }
                  />
                  <p className="text-[9.5px] text-slate-400 mt-0.5">
                    All phase dates chain from this. Defaults to study start if
                    not set.
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    ["phase1_weeks", "Phase 1 (weeks)"],
                    ["phase2_weeks", "Phase 2 (weeks)"],
                    ["phase3_weeks", "Phase 3 (weeks)"],
                    ["phase4_weeks", "Phase 4 (weeks)"],
                  ].map(([k, lbl]) => (
                    <div key={k}>
                      <label className={label}>{lbl}</label>
                      <input
                        type="number"
                        min="1"
                        className={inp}
                        value={form[k as keyof typeof form] as string}
                        onChange={(e) => set(k, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                {phaseDates && (
                  <div className="grid grid-cols-4 gap-2 text-[10px] text-slate-500">
                    {phaseDates.map((p, i) => (
                      <div key={i}>
                        {p ? (
                          <>
                            {p.start} →{" "}
                            <span className="font-semibold">{p.end}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </div>
                    ))}
                    <p className="col-span-4 text-emerald-600 font-semibold">
                      Tentative date for start of savings (start of Phase 3):{" "}
                      {phaseDates[2]?.start ?? "—"}
                    </p>
                  </div>
                )}
              </FormSection>
            </fieldset>
          </div>
        )}

        {/* STP completeness bar — shown near Save so user sees it before submitting */}
        {showStpSection &&
          (() => {
            const stpSections = [
              { label: "Scope", ok: !!(form.scope_in && form.customers) },
              {
                label: "Quantities",
                ok: !!(
                  form.annual_quantity_n1 &&
                  parseInt(form.annual_quantity_n1) > 0
                ),
              },
              {
                label: "Prices",
                ok: !!(
                  form.current_price &&
                  parseFloat(form.current_price) > 0 &&
                  form.proposed_price &&
                  parseFloat(form.proposed_price) > 0
                ),
              },
              {
                label: "Logistics",
                ok: !!(
                  form.incoterms_before &&
                  form.incoterms_after &&
                  form.country_after
                ),
              },
              {
                label: "Risks",
                ok: !!(
                  form.risk_material_indexation_before &&
                  form.risk_material_indexation_after
                ),
              },
              {
                label: "Benefits",
                ok: !!(form.benefit_if_we_do || form.benefit_if_not),
              },
              {
                label: "Planning",
                // Negotiation may leave the phase weeks at 0 — not required.
                ok:
                  isNegotiation ||
                  !!(form.phase1_weeks && parseInt(form.phase1_weeks) > 0),
              },
            ];
            const done = stpSections.filter((s) => s.ok).length;
            const total = stpSections.length;
            const pct = Math.round((done / total) * 100);
            const incomplete = stpSections.filter((s) => !s.ok);
            const allDone = done === total;
            const barColor = allDone
              ? "bg-emerald-500"
              : done >= 5
                ? "bg-blue-400"
                : done >= 3
                  ? "bg-amber-400"
                  : "bg-slate-300";
            return (
              <div
                className={`order-4 rounded-xl border px-4 py-3 space-y-2 ${allDone ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    STP Completeness
                  </span>
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${allDone ? "text-emerald-600" : "text-amber-700"}`}
                  >
                    {done}/{total} sections filled
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stpSections.map((s) => (
                    <span
                      key={s.label}
                      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${s.ok ? "bg-emerald-100 text-emerald-700" : "bg-white border border-amber-200 text-amber-600"}`}
                    >
                      {s.ok ? "✓" : "○"} {s.label}
                    </span>
                  ))}
                </div>
                {!allDone && (
                  <p className="text-[10.5px] text-amber-600">
                    {incomplete.map((s) => s.label).join(", ")} — save first,
                    then complete before Gate review.
                  </p>
                )}
              </div>
            );
          })()}

        <div className="order-5 pt-2">
          {error && (
            <div className="mb-3 flex justify-end">
              <p className="max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 shadow-sm">
                {error}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading && <RefreshCw size={13} className="animate-spin" />} Save
              Changes
            </button>
          </div>
        </div>
      </form>

      {/* DISABLED — Request Revision creation turned off (backend endpoint
          commented out in purchasing_value/router.py). stpRevModal can never be
          set true from the UI anymore (button above is disabled too), but the
          `false &&` keeps this unreachable even if some other path still flips
          the state, and the whole block stays intact to re-enable later. */}
      {false &&
        stpRevModal &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-base font-bold text-slate-800">
                  Request STP Baseline Revision
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setStpRevModal(false);
                    setStpRevError(null);
                  }}
                  className="rounded-lg p-1 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
              <form
                onSubmit={submitSTPRevisionRequest}
                className="space-y-4 overflow-y-auto px-6 py-5"
              >
                <p className="text-xs text-slate-500">
                  Enter only the values you want to change — leave the rest
                  blank. They will be sent to the Purchasing Director and VP
                  Conversion for approval; current figures remain active until a
                  Director approves.
                </p>

                {(() => {
                  const revInp =
                    "w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";
                  const revLabel =
                    "mb-1 block text-[11px] font-semibold text-slate-500";
                  const setRev = (k: keyof typeof stpRevForm, v: string) =>
                    setStpRevForm((f) => ({ ...f, [k]: v }));
                  const priceField = (
                    key: keyof typeof stpRevForm,
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
                          current != null ? `Current: ${current}` : "New value"
                        }
                        value={stpRevForm[key]}
                        onChange={(e) => setRev(key, e.target.value)}
                      />
                    </div>
                  );
                  const qtyField = (
                    key: keyof typeof stpRevForm,
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
                          current != null ? `Current: ${current}` : "New value"
                        }
                        value={stpRevForm[key]}
                        onChange={(e) => setRev(key, e.target.value)}
                      />
                    </div>
                  );
                  return (
                    <div className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
                        Proposed New Values
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
                })()}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Justification <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Explain why the baseline needs to change (supplier renegotiation, volume update, etc.)"
                    value={stpRevForm.note}
                    onChange={(e) =>
                      setStpRevForm((f) => ({ ...f, note: e.target.value }))
                    }
                  />
                </div>
                {stpRevError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                    {stpRevError}
                  </p>
                )}
                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStpRevModal(false);
                      setStpRevError(null);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      stpRevLoading ||
                      !stpRevForm.note.trim() ||
                      !stpRevHasChange
                    }
                    title={
                      !stpRevHasChange
                        ? "Enter at least one new value above"
                        : undefined
                    }
                    className="flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {stpRevLoading && (
                      <RefreshCw size={13} className="animate-spin" />
                    )}
                    Send for Approval
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* STP Revision Decision modal — portal to escape drawer stacking context & outer form */}
      {stpDecModal &&
        canDecideStpRevision &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-base font-bold text-slate-800">
                  STP Revision Decision
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setStpDecModal(false);
                    setStpDecError(null);
                  }}
                  className="rounded-lg p-1 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
              <form
                onSubmit={submitSTPDecision}
                className="px-6 py-5 space-y-4"
              >
                <p className="text-xs text-slate-500">
                  Approving will immediately apply the proposed prices and
                  quantities and recompute the savings baseline. Rejecting keeps
                  current values.
                </p>
                <div className="flex gap-3">
                  {(["Approved", "Rejected"] as const).map((d) => (
                    <label
                      key={d}
                      className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                        stpDecForm.decision === d
                          ? d === "Approved"
                            ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                            : "border-red-300 bg-red-50 text-red-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name="decision"
                        value={d}
                        checked={stpDecForm.decision === d}
                        onChange={() =>
                          setStpDecForm((f) => ({ ...f, decision: d }))
                        }
                      />
                      {d === "Approved" ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <XCircle size={14} />
                      )}
                      {d}
                    </label>
                  ))}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Note (optional)
                  </label>
                  <textarea
                    rows={2}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Reason or conditions..."
                    value={stpDecForm.note}
                    onChange={(e) =>
                      setStpDecForm((f) => ({ ...f, note: e.target.value }))
                    }
                  />
                </div>
                {stpDecError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                    {stpDecError}
                  </p>
                )}
                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStpDecModal(false);
                      setStpDecError(null);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={stpDecLoading}
                    className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                      stpDecForm.decision === "Approved"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {stpDecLoading && (
                      <RefreshCw size={13} className="animate-spin" />
                    )}
                    {stpDecForm.decision === "Approved" ? "Approve" : "Reject"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

