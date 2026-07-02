/**
 * RelationEvaluationPage — redesigned 4-tab evaluation workspace
 *
 * Tab 1 — Class Evaluation   : 11 criteria, live score, LTA file upload
 * Tab 2 — Operational         : initial self-assessment baseline (locked once submitted) + radar
 * Tab 3 — History & Documents : status history timeline + evaluation reference upload
 * Tab 4 — Decision & Impact   : 6 impact questions + panel decision
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supplierAPI } from "../services/supplierOnboardingAPI";
import { useAuth } from "../context/AuthContext";
import CommitteeReviewPanel from "../components/committee/CommitteeReviewPanel";
import {
  CERTIFICATION_STANDARD_TYPE_OPTIONS,
  CERT_TYPES_BY_STANDARD,
} from "../utils/onboarding";
import {
  EvaluationDetailsFormData,
  SupplierSiteRelation,
  SupplierStatusHistoryEntry,
} from "../types/onboarding";

// ---------------------------------------------------------------------------
// PLD scoring tables (mirrored from pld_scoring_rules)
// ---------------------------------------------------------------------------

const PLD_SCORES: Record<string, Record<string, number>> = {
  top: {
    "60 days end of month or +": 100,
    "60 days net": 80,
    "30 days end of month or +": 50,
    "30 days net": 30,
    "Cash in Advance": 0,
  },
  lta: { "3 years/+": 100, "2 years": 80, "1 year": 50, "None/Invalid": 0 },
  productivity: {
    "3% or +": 100,
    "2% or +": 80,
    "1% or +": 50,
    "less than 1%": 30,
    Neg: 0,
  },
  quality_certification: {
    "IATF / ISO9001 (cat BCD)": 100,
    "IATF 16949:2016": 100,
    "ISO 9001 (cat BCD)": 100,
    ISO9001: 50,
    "ISO 9001": 50,
    Distributor: 0,
    None: 0,
  },
  prod_lia_ins: { "2M$ or +": 100, "1M$ or +": 50, None: 0 },
  competitiveness: {
    "Best in Fam.": 100,
    "Almost Best in Fam.": 80,
    "Ave. in Fam.": 50,
    "Less Avg": 30,
    "Not Comp.": 0,
  },
  sqma: {
    Signed: 100,
    "Signed m.res.": 80,
    "Signed M/Res/not sent": 30,
    Rejected: 0,
  },
  family_coverage: {
    "Supplier can make all the family requirements": 100,
    "Supplier can make the main family requirements": 80,
    "Supplier can make only of few family requirements": 50,
    "Supplier can make 1 family requirements": 0,
  },
  geo_coverage: {
    "Main plants covered": 100,
    "More than 50% plants are covered": 50,
    "1 plant is covered": 30,
    None: 0,
  },
  cons_or_wd: {
    "Cons. Or Daily Deliveries": 100,
    "DDP or Weekly Del.": 50,
    "Biweekly Del.": 30,
    Other: 0,
  },
  financial_health: { Good: 100, "To Monitor": 50, "At Risk": 0 },
};

const PLD_OPTIONS: Record<string, string[]> = {
  top: [
    "60 days end of month or +",
    "60 days net",
    "30 days end of month or +",
    "30 days net",
    "Cash in Advance",
  ],
  lta: ["3 years/+", "2 years", "1 year", "None/Invalid"],
  productivity: ["3% or +", "2% or +", "1% or +", "less than 1%", "Neg"],
  quality_certification: [
    "IATF / ISO9001 (cat BCD)",
    "ISO9001",
    "ISO 9001",
    "ISO 9001 (cat BCD)",
    "IATF 16949:2016",
    "Distributor",
    "None",
  ],
  prod_lia_ins: ["2M$ or +", "1M$ or +", "None"],
  competitiveness: [
    "Best in Fam.",
    "Almost Best in Fam.",
    "Ave. in Fam.",
    "Less Avg",
    "Not Comp.",
  ],
  sqma: ["Signed", "Signed m.res.", "Signed M/Res/not sent", "Rejected"],
  family_coverage: [
    "Supplier can make all the family requirements",
    "Supplier can make the main family requirements",
    "Supplier can make only of few family requirements",
    "Supplier can make 1 family requirements",
  ],
  geo_coverage: [
    "Main plants covered",
    "More than 50% plants are covered",
    "1 plant is covered",
    "None",
  ],
  cons_or_wd: [
    "Cons. Or Daily Deliveries",
    "DDP or Weekly Del.",
    "Biweekly Del.",
    "Other",
  ],
  financial_health: ["Good", "To Monitor", "At Risk"],
};

// ---------------------------------------------------------------------------
// Per-criterion detail configuration
// ---------------------------------------------------------------------------

interface CriterionDetailConfig {
  hasSignatureDate?: boolean;
  hasApproverEmail?: boolean;
  hasAmountValue?: boolean;
  /** Returns months to add to start_date to compute end_date automatically */
  autoEndMonths?: (selectedValue: string) => number | null;
}

// Every criterion gets validity dates + file upload by default.
// This map only overrides or adds extra fields beyond that base.
const CRITERIA_DETAIL_CONFIG: Record<string, CriterionDetailConfig> = {
  lta: {
    hasSignatureDate: true,
    autoEndMonths: (v) =>
      v === "3 years/+"
        ? 36
        : v === "2 years"
          ? 24
          : v === "1 year"
            ? 12
            : null,
  },
  sqma: {
    hasSignatureDate: true,
    hasApproverEmail: true,
    autoEndMonths: () => 12,
  },
  quality_certification: {
    autoEndMonths: () => 36,
  },
  financial_health: {
    autoEndMonths: (v) => (v === "Good" ? 24 : 12),
  },
  prod_lia_ins: {
    hasAmountValue: true,
    autoEndMonths: () => 12,
  },
  // All other criteria (top, productivity, competitiveness, family_coverage,
  // geo_coverage, cons_or_wd) → base only (dates + file), no extra fields
};

function addMonthsToDate(dateStr: string, months: number): string {
  if (!Number.isFinite(months)) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + months);
  const result = d.toISOString();
  if (!result) return "";
  return result.slice(0, 10);
}

function safeToFixed(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return v.toFixed(decimals);
}

function safeNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function safeWidth(score: number | null | undefined): string {
  const v = score ?? 0;
  return `${isFinite(v) ? Math.min(v, 100) : 0}%`;
}

// ---------------------------------------------------------------------------
// Types for criterion detail
// ---------------------------------------------------------------------------

interface CriterionDetail {
  validity_start_date?: string;
  validity_end_date?: string;
  signature_date?: string;
  evidence_file_name?: string;
  auto_validity_end_date?: boolean;
  amount_value?: string;
  amount_currency?: string;
  approver_email?: string;
  comments?: string;
}

// ---------------------------------------------------------------------------
// Criteria list
// ---------------------------------------------------------------------------

const CLASS_CRITERIA: {
  key: keyof EvaluationDetailsFormData;
  label: string;
  pldKey: string;
}[] = [
  { key: "top", label: "Terms of Payments", pldKey: "top" },
  { key: "lta", label: "Long Term Agreement (LTA)", pldKey: "lta" },
  { key: "prod", label: "Productivity", pldKey: "productivity" },
  {
    key: "quality_certification",
    label: "Quality Certification",
    pldKey: "quality_certification",
  },
  {
    key: "prod_lia_ins",
    label: "Product Liability Insurance",
    pldKey: "prod_lia_ins",
  },
  {
    key: "competitiveness",
    label: "Competitiveness",
    pldKey: "competitiveness",
  },
  { key: "sqma", label: "SQMA", pldKey: "sqma" },
  {
    key: "family_coverage",
    label: "Family / Commodity Coverage",
    pldKey: "family_coverage",
  },
  { key: "geo_coverage", label: "Geographic Coverage", pldKey: "geo_coverage" },
  { key: "cons_or_wd", label: "Consignment / WD", pldKey: "cons_or_wd" },
  {
    key: "financial_health",
    label: "Financial Health",
    pldKey: "financial_health",
  },
];

const OPERATIONAL_CRITERIA: {
  key: keyof EvaluationDetailsFormData;
  label: string;
  minReq: number;
}[] = [
  { key: "management_system", label: "Management System", minReq: 78 },
  {
    key: "customer_communication",
    label: "Customer Communication",
    minReq: 75,
  },
  { key: "development_design", label: "Development / Design", minReq: 70 },
  {
    key: "production_manufacturing",
    label: "Production / Manufacturing",
    minReq: 70,
  },
  { key: "quality_audits", label: "Quality and Audits", minReq: 70 },
  {
    key: "suppliers_subcontractors",
    label: "Suppliers & Sub-contractors",
    minReq: 70,
  },
  { key: "deliveries", label: "Deliveries", minReq: 75 },
  {
    key: "environment_ethic_rules",
    label: "Environment and Ethics",
    minReq: 70,
  },
];

const IMPACT_QUESTIONS = [
  "Add competitiveness to the group (cash, price, ...)",
  "Help in decreasing the Carbon Footprint",
  "Improve operational performances (PPM, OTD, support, ...)",
  "Reduce risk of limited supply from a monopolistic supplier",
  "Be able to supply material or components not in the existing base",
  "Offering a large number of products in the family / commodity",
];

const IMPACT_OPTIONS = ["Major +", "Minor +", "None", "Minor -", "Major -"];
const IMPACT_SCORES: Record<string, number> = {
  "Major +": 5,
  "Minor +": 3,
  None: 0,
  "Minor -": -3,
  "Major -": -5,
};

const STRATEGIC_MENTION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "strategic", label: "Strategic" },
  { value: "monopolistic", label: "Monopolistic" },
  { value: "directed", label: "Directed" },
];

const PANEL_DECISION_OPTIONS = [
  { value: "panel_add", label: "Supplier can be added to the Panel" },
  {
    value: "panel_add_exec_committee",
    label: "Supplier added with Executive Committee Agreement",
  },
  { value: "panel_reject", label: "Supplier cannot be added to the Panel" },
];

const UI_CRITERIA_VALUE_NORMALIZATION: Record<
  string,
  Record<string, string>
> = {
  top: {
    "60 days eom or +": "60 days end of month or +",
  },
  sqma: {
    "Signed M.Res/not sent": "Signed M/Res/not sent",
  },
  family_coverage: {
    "100% Cov.": "Supplier can make all the family requirements",
    "Main sub-Fam Cov.": "Supplier can make the main family requirements",
    "1 sub-F or refs Cov.": "Supplier can make only of few family requirements",
    "1 ref": "Supplier can make 1 family requirements",
  },
  cons_or_wd: {
    "Cons. or WD": "Cons. Or Daily Deliveries",
  },
  quality_certification: {
    "ISO9001 (cat BCD)": "IATF / ISO9001 (cat BCD)",
    "IS09001 (cat BCD)": "IATF / ISO9001 (cat BCD)",
  },
};

function normalizeUiCriteriaValue(
  field: string,
  value: string | null | undefined,
): string {
  if (!value) return "";
  return UI_CRITERIA_VALUE_NORMALIZATION[field]?.[value] ?? value;
}

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

function classScore(form: EvaluationDetailsFormData): {
  scores: number[];
  avg: number | null;
  classValue: number | null;
} {
  const scores: number[] = [];
  for (const { key, pldKey } of CLASS_CRITERIA) {
    const val = form[key] as string | undefined;
    if (!val) continue;
    const s = PLD_SCORES[pldKey]?.[val];
    if (s !== undefined) scores.push(s);
  }
  if (scores.length === 0) return { scores: [], avg: null, classValue: null };
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const classValue = avg >= 90 ? 1 : avg >= 75 ? 2 : avg >= 60 ? 3 : 4;
  return { scores, avg, classValue };
}

function operationalAvg(form: EvaluationDetailsFormData): number | null {
  const vals: number[] = [];
  for (const { key } of OPERATIONAL_CRITERIA) {
    const v = form[key] as number | undefined;
    if (v !== undefined && v !== null) vals.push(Number(v));
  }
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function operationalGrade(avg: number | null): string | null {
  if (avg === null) return null;
  if (avg >= 80) return "A";
  if (avg >= 60) return "B";
  if (avg >= 50) return "C";
  return "D";
}

function impactScore(form: EvaluationDetailsFormData): number {
  return [
    form.impact_question_1,
    form.impact_question_2,
    form.impact_question_3,
    form.impact_question_4,
    form.impact_question_5,
    form.impact_question_6,
  ].reduce((sum, v) => sum + (IMPACT_SCORES[v as string] ?? 0), 0);
}

function finalGrade(opGrade: string | null, cls: number | null): string | null {
  if (!opGrade || !cls) return null;
  return `${opGrade}${cls}`;
}

const STATUS_FROM_GRADE: Record<string, { label: string; color: string }> = {
  "Can Quote and Be Awarded": {
    label: "Can Quote & Be Awarded",
    color: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  "Can Quote but Not be Awarded": {
    label: "Can Quote / Not Be Awarded",
    color: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  "New business on Hold": {
    label: "New Business on Hold",
    color: "bg-red-50 text-red-700 ring-red-200",
  },
};

function deriveStatus(fg: string | null): string | null {
  if (!fg) return null;
  const n = fg.toUpperCase();
  if (["A1", "B1", "A2", "B2"].includes(n)) return "Can Quote and Be Awarded";
  if (["A3", "B3", "C1", "C2", "C3"].includes(n))
    return "Can Quote but Not be Awarded";
  return "New business on Hold";
}

const GRADE_CLR: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800",
  B: "bg-blue-100 text-blue-800",
  C: "bg-amber-100 text-amber-800",
  D: "bg-red-100 text-red-800",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceExtra {
  baseline_locked: boolean;
  reevaluation_type?: "initial" | "preliminary" | null;
  relation_validation_status?: string;
  review_comment?: string | null;
  baseline_data?: {
    management_system?: number;
    customer_communication?: number;
    development_design?: number;
    production_manufacturing?: number;
    quality_audits?: number;
    suppliers_subcontractors?: number;
    deliveries?: number;
    environment_ethic_rules?: number;
    average_score?: number;
    operational_grade?: string;
  } | null;
  unit_certifications?: Array<{
    id_certification: number;
    standard_type?: string;
    certification_type?: string;
    certificate_name?: string;
    start_date?: string;
    end_date?: string;
  }>;
  evaluation_documents?: Array<{
    id_document: number;
    document_type: string;
    document_name: string;
    file_url?: string;
    uploaded_at?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TABS = [
  { id: "class", label: "Class Evaluation" },
  { id: "operational", label: "Operational" },
  { id: "decision", label: "Decision & Impact" },
  { id: "history", label: "History & Documents" },
  { id: "certifications", label: "Certifications" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-[#062B49]/40 focus:ring-4 focus:ring-[#062B49]/8 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/10";

// ---------------------------------------------------------------------------
// VP Conversion inline review bar
// ---------------------------------------------------------------------------

function VpReviewBar({ relationId, onDone }: { relationId: number; onDone: () => void }) {
  const [action, setAction] = useState<"idle" | "approving" | "rejecting">("idle");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (type: "approve" | "reject") => {
    if (type === "reject" && !comment.trim()) {
      setErr("A rejection reason is required.");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      if (type === "approve") await supplierAPI.approveRelationReview(relationId, comment || undefined);
      else await supplierAPI.rejectRelationReview(relationId, comment.trim());
      onDone();
    } catch (e: any) {
      setErr(e.message ?? "Action failed.");
      setLoading(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-900/15">
      <p className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
        This relation is awaiting your review. Modify the evaluation if needed, then approve or reject.
      </p>
      {action === "idle" ? (
        <div className="flex gap-2">
          <button onClick={() => setAction("approving")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
            Approve
          </button>
          <button onClick={() => setAction("rejecting")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-600 dark:bg-transparent dark:text-red-400">
            Reject
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder={action === "approving" ? "Optional comment…" : "Rejection reason (required)…"}
            className={`w-full rounded-lg border px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none dark:bg-slate-800 dark:text-slate-100 ${action === "rejecting" && !comment.trim() && err ? "border-red-400 bg-red-50" : "border-slate-300 bg-white dark:border-slate-600"}`}
          />
          {err && <p className="text-xs font-medium text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button onClick={() => submit(action === "approving" ? "approve" : "reject")}
              disabled={loading}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${action === "approving" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
              {loading ? "Processing…" : action === "approving" ? "Confirm Approval" : "Confirm Rejection"}
            </button>
            <button onClick={() => { setAction("idle"); setComment(""); setErr(null); }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RejectionBanner({
  comment,
  onRevise,
  revising,
}: {
  comment?: string | null;
  onRevise: () => void;
  revising: boolean;
}) {
  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-4 dark:border-red-500/30 dark:bg-red-900/15">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-red-800 dark:text-red-300">
            Relation rejected by VP Conversion
          </p>
          {comment && (
            <p className="mt-1 text-sm text-red-700 dark:text-red-400">
              <span className="font-semibold">Reason: </span>{comment}
            </p>
          )}
          <p className="mt-2 text-xs text-red-600/80 dark:text-red-400/70">
            Revise the evaluation and resubmit for review.
          </p>
        </div>
        <button
          type="button"
          onClick={onRevise}
          disabled={revising}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {revising ? "Resetting…" : "Revise & Resubmit"}
        </button>
      </div>
    </div>
  );
}

export default function RelationEvaluationPage() {
  const { relationId } = useParams<{ relationId: string }>();
  const relId = relationId ? Number(relationId) : NaN;
  const { user } = useAuth();
  const isVpConversion = user?.access_profile === "vp_conversion";
  const isPrivileged = ["vp_conversion", "purchasing_director"].includes(user?.access_profile ?? "");

  const [tab, setTab] = useState<Tab>("class");
  const [form, setForm] = useState<EvaluationDetailsFormData>({
    strategic_mention: "none",
    class_criteria_details: {},
  });
  const [relation, setRelation] = useState<SupplierSiteRelation | null>(null);
  const [siteName, setSiteName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [unitIsActive, setUnitIsActive] = useState(true);
  const [unitInactivatedAt, setUnitInactivatedAt] = useState<string | null>(
    null,
  );
  const [extra, setExtra] = useState<WorkspaceExtra>({
    baseline_locked: false,
  });
  const [history, setHistory] = useState<SupplierStatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Tab | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [evalDocs, setEvalDocs] = useState<
    WorkspaceExtra["evaluation_documents"]
  >([]);
  const [revising, setRevising] = useState(false);

  // Evaluation date (can differ from today)
  const [evaluationDate, setEvaluationDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  // Derived: true when no baseline has been locked yet (no self_assessment record)
  const isInitialSelfAssessment = !extra.baseline_locked;
  // Non-vp users are read-only once they've submitted (relation no longer draft)
  const relationStatus = extra.relation_validation_status ?? "draft";
  const nonVpLocked = !isPrivileged && relationStatus !== "draft";
  // Per-criterion detail data (validity dates, signature, files)
  const [criteriaDetails, setCriteriaDetails] = useState<
    Record<string, CriterionDetail>
  >({});
  // Strategic mention as multi-select set
  const [strategicMentions, setStrategicMentions] = useState<Set<string>>(
    new Set(["none"]),
  );
  // Class edit mode — locked (read-only) by default once baseline exists
  const [classEditMode, setClassEditMode] = useState(false);

  const load = useCallback(async () => {
    if (!relId || isNaN(relId)) return;
    setLoading(true);
    setError(null);
    try {
      const [wsRes, sitesRes] = await Promise.all([
        supplierAPI.getRelationEvaluationWorkspace(relId),
        supplierAPI.listSites(),
      ]);
      const ws = wsRes.data as any;
      if (!ws?.relation) {
        setError("No relation data returned from server.");
        setLoading(false);
        return;
      }
      const rel: SupplierSiteRelation = ws.relation;
      const sites = (
        Array.isArray(sitesRes.data) ? sitesRes.data : []
      ) as any[];
      const site = sites.find((s: any) => s.id_site === rel.id_site);
      setRelation(rel);
      setSiteName(site?.site_name || `Site #${rel.id_site}`);

      // unit_supplier_name is injected by the workspace endpoint
      setUnitName(
        (ws as any).unit_supplier_name ||
          rel.unit_code ||
          `Unit #${rel.id_supplier_unit}`,
      );

      setHistory(ws.status_history || []);
      const baselineLocked = ws.baseline_locked ?? false;

      setUnitIsActive(ws.unit_is_active ?? true);
      setUnitInactivatedAt(ws.unit_inactivated_at ?? null);

      setExtra({
        baseline_locked: baselineLocked,
        reevaluation_type: ws.reevaluation_type ?? null,
        relation_validation_status: ws.relation_validation_status ?? "draft",
        review_comment: ws.review_comment ?? null,
        baseline_data: ws.baseline_data ?? null,
        unit_certifications: ws.unit_certifications ?? [],
        evaluation_documents: ws.evaluation_documents ?? [],
      });
      setEvalDocs(ws.evaluation_documents ?? []);

      // Seed criteria details from existing class_criteria_details
      const existingDetails = ws.class_criteria_details ?? {};
      const seededDetails: Record<string, CriterionDetail> = {};
      for (const [k, v] of Object.entries(existingDetails)) {
        seededDetails[k] = v as CriterionDetail;
      }

      // Auto-populate quality_certification details from the best-scoring non-expired unit cert
      const CERT_SCORE_ORDER = [
        "IATF / ISO9001 (cat BCD)",
        "IATF 16949:2016",
        "ISO 9001 (cat BCD)",
        "ISO9001 (cat BCD)",
        "ISO9001",
        "ISO 9001",
      ];
      const today = new Date().toISOString().slice(0, 10);
      const qualCertsAll = (ws.unit_certifications ?? []).filter(
        (c: any) => c.certification_type,
      );
      // Prefer non-expired; fall back to expired if all are expired
      const qualCertsValid = qualCertsAll.filter(
        (c: any) => !c.end_date || c.end_date >= today,
      );
      const qualCertPool = qualCertsValid.length > 0 ? qualCertsValid : qualCertsAll;
      const qualCert = [...qualCertPool].sort((a: any, b: any) => {
        const ra = CERT_SCORE_ORDER.indexOf(a.certification_type);
        const rb = CERT_SCORE_ORDER.indexOf(b.certification_type);
        return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
      })[0];
      if (
        qualCert &&
        !seededDetails["quality_certification"]?.validity_start_date
      ) {
        seededDetails["quality_certification"] = {
          ...seededDetails["quality_certification"],
          validity_start_date: qualCert.start_date ?? undefined,
          validity_end_date: qualCert.end_date ?? undefined,
        };
      }
      setCriteriaDetails(seededDetails);

      // Seed strategic mentions (may be comma-separated in future or single)
      const smRaw =
        ws.strategic_mention || ws.relation?.strategic_mention || "none";
      const sm = typeof smRaw === "string" ? smRaw : "none";
      setStrategicMentions(
        new Set(
          sm
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean),
        ),
      );
      if (ws.relation?.last_evaluation_date) {
        setEvaluationDate(ws.relation.last_evaluation_date);
      }

      const n = (v: any) => {
        if (v === undefined || v === null) return undefined;
        const num = Number(v);
        return isFinite(num) ? num : undefined;
      };

      // If a draft exists and baseline is not yet locked, restore the draft values
      const draft = !baselineLocked ? (ws.evaluation_draft ?? null) : null;
      setHasDraft(draft !== null);
      const src = draft ?? ws;

      setForm({
        strategic_mention: src.strategic_mention || "none",
        panel_decision: src.panel_decision || undefined,
        class_value: src.class_value ?? undefined,
        class_score: n(src.class_score),
        operational_grade: src.operational_grade ?? undefined,
        operational_score: n(src.operational_score),
        impact_score: src.impact_score ?? undefined,
        comments: src.comments || "",
        class_criteria_details: src.class_criteria_details || {},
        top: normalizeUiCriteriaValue("top", src.top),
        lta: normalizeUiCriteriaValue("lta", src.lta),
        sqma: normalizeUiCriteriaValue("sqma", src.sqma),
        quality_certification: normalizeUiCriteriaValue(
          "quality_certification",
          src.quality_certification || qualCert?.certification_type,
        ),
        family_coverage: normalizeUiCriteriaValue(
          "family_coverage",
          src.family_coverage,
        ),
        competitiveness: normalizeUiCriteriaValue(
          "competitiveness",
          src.competitiveness,
        ),
        geo_coverage: normalizeUiCriteriaValue(
          "geo_coverage",
          src.geo_coverage,
        ),
        cons_or_wd: normalizeUiCriteriaValue("cons_or_wd", src.cons_or_wd),
        financial_health: normalizeUiCriteriaValue(
          "financial_health",
          src.financial_health,
        ),
        prod_lia_ins: normalizeUiCriteriaValue(
          "prod_lia_ins",
          src.prod_lia_ins,
        ),
        prod: normalizeUiCriteriaValue("productivity", src.prod),
        management_system: n(src.management_system),
        customer_communication: n(src.customer_communication),
        development_design: n(src.development_design),
        production_manufacturing: n(src.production_manufacturing),
        quality_audits: n(src.quality_audits),
        suppliers_subcontractors: n(src.suppliers_subcontractors),
        deliveries: n(src.deliveries),
        environment_ethic_rules: n(src.environment_ethic_rules),
        impact_question_1: src.impact_question_1 || "",
        impact_question_2: src.impact_question_2 || "",
        impact_question_3: src.impact_question_3 || "",
        impact_question_4: src.impact_question_4 || "",
        impact_question_5: src.impact_question_5 || "",
        impact_question_6: src.impact_question_6 || "",
      });
      if (draft?.criteria_details) {
        setCriteriaDetails(draft.criteria_details);
      }
      if (draft?.strategic_mentions) {
        setStrategicMentions(new Set(draft.strategic_mentions));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load evaluation workspace",
      );
    } finally {
      setLoading(false);
    }
  }, [relId]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key: keyof EvaluationDetailsFormData, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setCriterionDetail = (
    pldKey: string,
    field: keyof CriterionDetail,
    value: string,
  ) => {
    setCriteriaDetails((prev) => {
      const existing = prev[pldKey] ?? {};
      const updated: CriterionDetail = { ...existing, [field]: value };

      // Auto-calculate end date when start date changes and auto flag is set
      if (field === "validity_start_date" && value) {
        const criterionKey = CLASS_CRITERIA.find(
          (c) => c.pldKey === pldKey,
        )?.key;
        const selectedVal = criterionKey ? (form as any)[criterionKey] : null;
        const cfg = CRITERIA_DETAIL_CONFIG[pldKey];
        const months =
          cfg?.autoEndMonths && selectedVal
            ? cfg.autoEndMonths(selectedVal)
            : null;
        if (months && existing.auto_validity_end_date !== false) {
          updated.validity_end_date = addMonthsToDate(value, months);
          updated.auto_validity_end_date = true;
        }
      }
      return { ...prev, [pldKey]: updated };
    });
  };

  const toggleStrategicMention = (value: string) => {
    setStrategicMentions((prev) => {
      const next = new Set(prev);
      if (value === "none") return new Set(["none"]);
      next.delete("none");
      if (next.has(value)) next.delete(value);
      else next.add(value);
      if (next.size === 0) return new Set(["none"]);
      return next;
    });
  };

  const showMsg = (msg: string) => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(null), 3000);
  };

  const saveClass = async () => {
    setSaving("class");
    setError(null);
    try {
      const computed = classScore(form);
      const smValue = Array.from(strategicMentions).join(",") || "none";
      const classCycleType =
        extra.reevaluation_type === "initial"
          ? "Initial Re-evaluation"
          : extra.reevaluation_type === "preliminary"
            ? "Preliminary Re-evaluation"
            : isInitialSelfAssessment
              ? "Initial Self-Assessment"
              : "Criteria Change Review";
      await supplierAPI.updateRelationClassEvaluation(relId, {
        evaluation_date: evaluationDate,
        cycle_type: classCycleType,
        top: form.top,
        lta: form.lta,
        productivity: form.prod,
        quality_certification: form.quality_certification,
        prod_lia_ins: form.prod_lia_ins,
        competitiveness: form.competitiveness,
        sqma: form.sqma,
        family_coverage: form.family_coverage,
        geo_coverage: form.geo_coverage,
        cons_or_wd: form.cons_or_wd,
        financial_health: form.financial_health,
        class_score: computed.avg,
        class_value: computed.classValue,
        strategic_mention: smValue,
        panel_decision: form.panel_decision,
        impact_score: form.impact_score,
        // Pass per-criterion detail data
        class_criteria_details: Object.fromEntries(
          Object.entries(criteriaDetails).map(([k, v]) => [k, v]),
        ),
      });
      showMsg("Class evaluation saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  // Save raw form state as a draft — zero business logic, no grade/status changes
  const saveDraft = async () => {
    setSavingDraft(true);
    setError(null);
    try {
      await supplierAPI.saveEvaluationDraft(relId, {
        // Class criteria
        top: form.top,
        lta: form.lta,
        prod: form.prod,
        quality_certification: form.quality_certification,
        prod_lia_ins: form.prod_lia_ins,
        competitiveness: form.competitiveness,
        sqma: form.sqma,
        family_coverage: form.family_coverage,
        geo_coverage: form.geo_coverage,
        cons_or_wd: form.cons_or_wd,
        financial_health: form.financial_health,
        // Per-criterion detail (dates, signatures, doc refs)
        criteria_details: criteriaDetails,
        // Operational scores (partial is fine)
        management_system: form.management_system,
        customer_communication: form.customer_communication,
        development_design: form.development_design,
        production_manufacturing: form.production_manufacturing,
        quality_audits: form.quality_audits,
        suppliers_subcontractors: form.suppliers_subcontractors,
        deliveries: form.deliveries,
        environment_ethic_rules: form.environment_ethic_rules,
        // Impact & decision
        impact_question_1: form.impact_question_1,
        impact_question_2: form.impact_question_2,
        impact_question_3: form.impact_question_3,
        impact_question_4: form.impact_question_4,
        impact_question_5: form.impact_question_5,
        impact_question_6: form.impact_question_6,
        panel_decision: form.panel_decision,
        strategic_mention: form.strategic_mention,
        // Preserve strategic mentions multi-select set
        strategic_mentions: Array.from(strategicMentions),
        comments: form.comments,
      });
      setHasDraft(true);
      showMsg("Draft saved — you can complete and submit later.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft save failed.");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleRevise = async () => {
    setRevising(true);
    try {
      await supplierAPI.resetRelationToDraft(relId);
      await load();
    } catch (e: any) {
      setError(e.message ?? "Failed to reset relation.");
    } finally {
      setRevising(false);
    }
  };

  // Validate completeness before locking the baseline
  const validateInitialSelfAssessment = (): string | null => {
    const cs2 = classScore(form);
    const opVals = OPERATIONAL_CRITERIA.map(
      ({ key }) => form[key] as number | undefined,
    ).filter((v) => v !== undefined && v !== null);
    const missing: string[] = [];
    if (cs2.scores.length === 0)
      missing.push("Class Evaluation (fill at least one criterion)");
    if (opVals.length < OPERATIONAL_CRITERIA.length)
      missing.push(`Operational (${opVals.length}/8 scores filled)`);
    if (!form.panel_decision)
      missing.push("Decision & Impact (panel decision missing)");
    if (missing.length > 0) return missing.join(" · ");
    const sm = Array.from(strategicMentions).filter((s) => s !== "none");
    if (sm.length === 0 && !strategicMentions.has("none")) {
      return "Decision & Impact: please set the Strategic Mention.";
    }
    if (!form.panel_decision) {
      return "Decision & Impact: please set the Committee Decision (Panel Decision).";
    }
    return null;
  };

  const saveBaseline = async () => {
    if (isInitialSelfAssessment) {
      const validationError = validateInitialSelfAssessment();
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    setSaving("operational");
    setError(null);
    try {
      const smValue = Array.from(strategicMentions).join(",") || "none";
      const computed = classScore(form);
      const cycleType =
        extra.reevaluation_type === "initial"
          ? "Initial Re-evaluation"
          : extra.reevaluation_type === "preliminary"
            ? "Preliminary Re-evaluation"
            : isInitialSelfAssessment
              ? "Initial Self-Assessment"
              : "Operational Self-Assessment Refresh";

      // 1. Save class evaluation criteria
      await supplierAPI.updateRelationClassEvaluation(relId, {
        evaluation_date: evaluationDate,
        cycle_type: cycleType,
        top: form.top,
        lta: form.lta,
        productivity: form.prod,
        quality_certification: form.quality_certification,
        prod_lia_ins: form.prod_lia_ins,
        competitiveness: form.competitiveness,
        sqma: form.sqma,
        family_coverage: form.family_coverage,
        geo_coverage: form.geo_coverage,
        cons_or_wd: form.cons_or_wd,
        financial_health: form.financial_health,
        class_score: computed.avg,
        class_value: computed.classValue,
        strategic_mention: smValue,
        panel_decision: form.panel_decision,
        impact_score: impactScore(form),
        impact_question_1: form.impact_question_1,
        impact_question_2: form.impact_question_2,
        impact_question_3: form.impact_question_3,
        impact_question_4: form.impact_question_4,
        impact_question_5: form.impact_question_5,
        impact_question_6: form.impact_question_6,
        class_criteria_details: Object.fromEntries(
          Object.entries(criteriaDetails),
        ),
      });

      // 2. Save and lock operational baseline
      await supplierAPI.updateRelationOperationalEvaluation(relId, {
        evaluation_date: evaluationDate,
        source_type: "self_assessment",
        cycle_type: cycleType,
        management_system: form.management_system,
        customer_communication: form.customer_communication,
        development_design: form.development_design,
        production_manufacturing: form.production_manufacturing,
        quality_audits: form.quality_audits,
        suppliers_subcontractors: form.suppliers_subcontractors,
        deliveries: form.deliveries,
        environment_ethic_rules: form.environment_ethic_rules,
      });

      // 3. Clear the draft now that real data is committed
      await supplierAPI.clearEvaluationDraft(relId).catch(() => undefined);
      setHasDraft(false);

      // 4. For vp_conversion: approve the relation directly. Others: submit for review.
      if (isVpConversion) {
        await supplierAPI.approveRelationReview(relId).catch(() => undefined);
      } else {
        await supplierAPI.submitRelationForReview(relId).catch(() => undefined);
      }

      const successMsg = isVpConversion
        ? "Baseline locked and relation approved for panel."
        : "Evaluation submitted for VP Conversion review.";
      showMsg(successMsg);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const saveDecision = async () => {
    setSaving("decision");
    setError(null);
    try {
      const computed = impactScore(form);
      await supplierAPI.updateRelationClassEvaluation(relId, {
        cycle_type: "Decision & Impact Update",
        strategic_mention: form.strategic_mention,
        panel_decision: form.panel_decision,
        impact_score: computed,
        impact_question_1: form.impact_question_1,
        impact_question_2: form.impact_question_2,
        impact_question_3: form.impact_question_3,
        impact_question_4: form.impact_question_4,
        impact_question_5: form.impact_question_5,
        impact_question_6: form.impact_question_6,
      });
      showMsg("Decision & impact saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  // Computed live values
  const cs = classScore(form);
  const opAvg = operationalAvg(form);
  const opGrade = operationalGrade(opAvg);
  const impact = impactScore(form);
  const fg = finalGrade(
    relation?.operational_grade || opGrade,
    cs.classValue || relation?.class_value || null,
  );
  const status = deriveStatus(fg);

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#062B49]" />
        <span className="text-sm text-slate-400">
          Loading evaluation workspace…
        </span>
      </div>
    );

  const statusCfg = status ? STATUS_FROM_GRADE[status] : null;

  return (
    <div className="flex flex-col gap-0">
      {/* ── Hero header ── */}
      <div className="relative -mx-4 overflow-hidden bg-[#0f2744] shadow-[0_4px_24px_rgba(15,23,42,0.18)] sm:-mx-6">
        {/* Radial accent — matches PageIntro */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.22),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(14,165,233,0.12),transparent_50%)]" />
        <div className="relative px-4 pt-5 pb-0 sm:px-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[11px] text-blue-300/80">
            <Link
              to="/suppliers"
              className="hover:text-white transition-colors"
            >
              Suppliers
            </Link>
            <svg
              className="h-3 w-3 opacity-40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            {/* supplier code = human readable name, not UNT-XXXXXX */}
            <span className="font-semibold text-blue-200">{unitName}</span>
            <svg
              className="h-3 w-3 opacity-40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span className="text-white/70">{siteName}</span>
          </div>

          {/* Title row */}
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">
                Evaluation Workspace
              </h1>
              <p className="mt-0.5 text-xs text-blue-300/70">
                {unitName} · {siteName}
              </p>
            </div>

            {/* Grade + status chips */}
            <div className="flex flex-wrap items-center gap-2">
              {fg && (
                <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
                  <span className="text-[11px] font-semibold text-blue-300">
                    Grade
                  </span>
                  <span className="text-xl font-bold text-white">{fg}</span>
                </div>
              )}
              {statusCfg && (
                <span
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 ${statusCfg.color}`}
                >
                  {statusCfg.label}
                </span>
              )}
            </div>
          </div>

          {/* Controls row */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2">
              <span className="text-[11px] font-semibold text-blue-300 whitespace-nowrap">
                Evaluation date
              </span>
              <input
                type="date"
                value={evaluationDate}
                onChange={(e) => setEvaluationDate(e.target.value)}
                className="border-0 bg-transparent text-sm font-semibold text-white outline-none [color-scheme:dark]"
              />
            </div>
            {extra.reevaluation_type === "initial" ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-orange-400/40 bg-orange-400/15 px-3 py-2">
                <svg
                  className="h-3.5 w-3.5 text-orange-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="text-[11px] font-semibold text-orange-200">
                  Initial Re-evaluation Required
                </span>
              </div>
            ) : extra.reevaluation_type === "preliminary" ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/15 px-3 py-2">
                <svg
                  className="h-3.5 w-3.5 text-amber-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="text-[11px] font-semibold text-amber-200">
                  Preliminary Re-evaluation Required
                </span>
              </div>
            ) : isInitialSelfAssessment ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/15 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="text-[11px] font-semibold text-amber-200">
                  Initial Self-Assessment
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-400/15 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-[11px] font-semibold text-emerald-200">
                  Baseline Locked
                </span>
              </div>
            )}

            {!unitIsActive && (
              <div className="flex items-center gap-1.5 rounded-xl border border-red-400/40 bg-red-400/15 px-3 py-2">
                <svg
                  className="h-3.5 w-3.5 text-red-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
                <span className="text-[11px] font-semibold text-red-300">
                  Inactive
                  {unitInactivatedAt ? (() => {
                    const d = new Date(unitInactivatedAt);
                    return !isNaN(d.getTime()) ? ` since ${d.toLocaleDateString()}` : "";
                  })() : ""}
                </span>
              </div>
            )}
          </div>

          {/* Tab bar — sits on the dark header */}
          <div className="mt-4 flex gap-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
                  tab === t.id
                    ? "border-sky-400 text-white"
                    : "border-transparent text-blue-300/60 hover:text-blue-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="py-6">
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </div>
        )}
        {saveMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-300">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            {saveMsg}
          </div>
        )}

        {/* ── VP Conversion review action bar (shown when relation is pending_review) ── */}
        {isVpConversion && relationStatus === "pending_review" && (
          <VpReviewBar relationId={relId} onDone={load} />
        )}

        {/* ── Rejection banner — shown to all roles when relation is rejected ── */}
        {relationStatus === "rejected" && !isVpConversion && (
          <RejectionBanner
            comment={extra.review_comment}
            onRevise={handleRevise}
            revising={revising}
          />
        )}

        {/* ── Initial self-assessment mode: all sections on one page ── */}
        {isInitialSelfAssessment ? (
          <InitialSelfAssessmentView
            form={form}
            setField={setField}
            extra={extra}
            cs={cs}
            criteriaDetails={criteriaDetails}
            onDetailChange={setCriterionDetail}
            strategicMentions={strategicMentions}
            onToggleStrategic={toggleStrategicMention}
            impact={impact}
            saving={saving === "operational"}
            savingDraft={savingDraft}
            hasDraft={hasDraft}
            error={error}
            onSubmit={saveBaseline}
            onSaveDraft={saveDraft}
            validateFn={validateInitialSelfAssessment}
            relationId={relId}
            reevaluationType={extra.reevaluation_type}
            onFileUploaded={load}
            isVpConversion={isVpConversion}
            readOnly={nonVpLocked}
            evalDocs={evalDocs}
          />
        ) : (
          <>
            {tab === "class" && (
              <ClassTab
                form={form}
                setField={setField}
                extra={extra}
                cs={cs}
                saving={saving === "class"}
                onSave={saveClass}
                criteriaDetails={criteriaDetails}
                onDetailChange={setCriterionDetail}
                relationId={relId}
                readOnly={(extra.baseline_locked && !classEditMode) || nonVpLocked}
                onRequestEdit={() => !nonVpLocked && setClassEditMode(true)}
                onCancelEdit={() => {
                  setClassEditMode(false);
                  load();
                }}
                onFileUploaded={load}
              />
            )}
            {tab === "operational" && (
              <OperationalTab
                form={form}
                setField={setField}
                extra={extra}
                saving={saving === "operational"}
                onSubmitBaseline={saveBaseline}
              />
            )}
            {tab === "history" && (
              <HistoryTab
                history={history}
                relationId={relId}
                evalDocs={evalDocs}
                onDocUploaded={load}
                panelDecision={form.panel_decision}
                isVpConversion={isVpConversion}
              />
            )}
            {tab === "decision" && (
              <DecisionTab
                form={form}
                setField={setField}
                impact={impact}
                saving={saving === "decision"}
                onSave={saveDecision}
                strategicMentions={strategicMentions}
                onToggleStrategic={toggleStrategicMention}
                readOnly={(!isPrivileged && extra.baseline_locked) || nonVpLocked}
              />
            )}
            {tab === "certifications" && (
              <CertificationsTab
                unitId={relation?.id_supplier_unit ?? 0}
                unitName={unitName}
                certs={extra.unit_certifications ?? []}
                onRefresh={load}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1 — Class Evaluation
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Evaluation file upload card (used inside InitialSelfAssessmentView)
// ---------------------------------------------------------------------------

function EvalFileUploadCard({
  relationId,
  evalDocs,
  onUploaded,
  readOnly,
}: {
  relationId: number;
  evalDocs?: WorkspaceExtra["evaluation_documents"];
  onUploaded?: () => void;
  readOnly?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refDocs = (evalDocs ?? []).filter(
    (d) => d.document_type === "evaluation_reference",
  );

  const handleFile = async (file: File) => {
    setMsg(null);
    setUploading(true);
    try {
      await supplierAPI.uploadEvaluationReference(relationId, file);
      setMsg("File uploaded successfully.");
      onUploaded?.();
    } catch {
      setMsg("Upload failed — please try again.");
    } finally {
      setUploading(false);
    }
  };

  const fmtDate = (d?: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/50 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-900/10">
      <div className="flex items-center justify-between border-b border-emerald-200/60 bg-emerald-50 px-5 py-3.5 dark:border-emerald-500/20 dark:bg-emerald-900/20">
        <div className="flex items-center gap-2.5">
          <svg
            className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <div>
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              Evaluation File
              {!readOnly && <span className="ml-1 text-red-500">*</span>}
            </p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-500">
              {readOnly
                ? "Completed Excel scorecard attached to this evaluation"
                : "Required — attach the completed Excel scorecard before submitting"}
            </p>
          </div>
        </div>
        {refDocs.length > 0 && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
            {refDocs.length} file{refDocs.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="p-5">
        {!readOnly && (
          <div
            onClick={() => !uploading && fileRef.current?.click()}
            className="mb-4 flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-emerald-300 bg-white px-4 py-4 transition hover:border-emerald-400 hover:bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-white/[0.02] dark:hover:border-emerald-400/40 dark:hover:bg-white/[0.04]"
          >
            <svg
              className="h-5 w-5 text-emerald-500 dark:text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div className="text-center">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {uploading ? "Uploading…" : "Click to upload"}
              </p>
              <p className="text-[11px] text-emerald-500 dark:text-emerald-500">
                .xlsx, .xls, .pdf accepted · max 10 MB
              </p>
            </div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />

        {msg && (
          <p
            className={`mb-3 text-xs font-medium ${
              msg.includes("failed")
                ? "text-red-600 dark:text-red-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {msg}
          </p>
        )}

        {refDocs.length === 0 ? (
          <p className="text-center text-[11px] text-slate-400">
            No evaluation file attached yet.
          </p>
        ) : (
          <div className="space-y-2">
            {refDocs.map((doc) => (
              <div
                key={doc.id_document}
                className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200/60 bg-white px-3 py-2.5 dark:border-emerald-500/20 dark:bg-white/[0.03]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {doc.document_name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {fmtDate(doc.uploaded_at)}
                  </p>
                </div>
                {doc.file_url && (
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-300"
                  >
                    Download
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Initial Self-Assessment — all 3 sections on one page
// ---------------------------------------------------------------------------

function InitialSelfAssessmentView({
  form,
  setField,
  extra,
  cs,
  criteriaDetails,
  onDetailChange,
  strategicMentions,
  onToggleStrategic,
  impact,
  saving,
  savingDraft,
  hasDraft,
  error,
  onSubmit,
  onSaveDraft,
  validateFn,
  relationId,
  reevaluationType,
  onFileUploaded,
  isVpConversion,
  onSubmitForReview,
  readOnly,
  evalDocs,
}: {
  form: EvaluationDetailsFormData;
  setField: (k: keyof EvaluationDetailsFormData, v: any) => void;
  extra: WorkspaceExtra;
  cs: { scores: number[]; avg: number | null; classValue: number | null };
  criteriaDetails: Record<string, CriterionDetail>;
  onDetailChange: (
    pldKey: string,
    field: keyof CriterionDetail,
    value: string,
  ) => void;
  relationId: number;
  strategicMentions: Set<string>;
  onToggleStrategic: (v: string) => void;
  impact: number;
  saving: boolean;
  savingDraft?: boolean;
  hasDraft?: boolean;
  error: string | null;
  onSubmit: () => void;
  onSaveDraft?: () => void;
  validateFn: () => string | null;
  reevaluationType?: "initial" | "preliminary" | null;
  onFileUploaded?: () => void;
  isVpConversion?: boolean;
  onSubmitForReview?: () => void;
  readOnly?: boolean;
  evalDocs?: WorkspaceExtra["evaluation_documents"];
}) {
  const [openSection, setOpenSection] = useState<Record<string, boolean>>({
    class: true,
    operational: true,
    decision: true,
  });
  const toggle = (k: string) => setOpenSection((p) => ({ ...p, [k]: !p[k] }));

  // Completion checks
  const classOk = cs.scores.length >= 1;
  const opVals = OPERATIONAL_CRITERIA.map(
    ({ key }) => form[key] as number | undefined,
  ).filter((v) => v !== undefined && v !== null);
  const opOk = opVals.length === OPERATIONAL_CRITERIA.length;
  const decisionOk = !!form.panel_decision;
  const fileOk = (evalDocs ?? []).some((d) => d.document_type === "evaluation_reference");
  const allOk = classOk && opOk && decisionOk && fileOk;

  const validationMsg = validateFn();

  const submitLabel = isVpConversion
    ? reevaluationType === "initial"
      ? "Submit Initial Re-evaluation"
      : reevaluationType === "preliminary"
        ? "Submit Preliminary Re-evaluation"
        : "Submit & Lock Baseline"
    : "Submit for Review";

  const statusBannerConfig: Record<string, { bg: string; text: string; label: string }> = {
    pending_review: {
      bg: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-300",
      text: "Awaiting VP Conversion review. The evaluation has been submitted and is locked.",
      label: "Pending Review",
    },
    approved: {
      bg: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-300",
      text: "This relation has been approved and is visible in the supplier panel.",
      label: "Approved",
    },
    rejected: {
      bg: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300",
      text: "This relation was rejected by VP Conversion.",
      label: "Rejected",
    },
  };
  const statusBanner = readOnly && extra.relation_validation_status
    ? statusBannerConfig[extra.relation_validation_status]
    : null;

  return (
    <div className="space-y-4">
      {/* Relation validation status banner */}
      {statusBanner && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${statusBanner.bg}`}>
          <span className="font-semibold">{statusBanner.label}:</span>
          <span>{statusBanner.text}</span>
        </div>
      )}

      {/* Re-evaluation context notice */}
      {reevaluationType && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 dark:border-orange-500/30 dark:bg-orange-900/20 dark:text-orange-300">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-orange-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <div>
            <p className="font-semibold">
              {reevaluationType === "initial"
                ? "Initial Re-evaluation Required"
                : "Preliminary Re-evaluation Required"}
            </p>
            <p className="mt-0.5 text-orange-700 dark:text-orange-400">
              {reevaluationType === "initial"
                ? "This supplier has been inactive for 3+ years. Per procedure C2Pr3, a full initial evaluation (process audit) is required, equivalent to a new supplier."
                : "This supplier has been inactive for 1+ year. Per procedure C2Pr3, a preliminary evaluation is required before returning to regular scorecards."}
            </p>
          </div>
        </div>
      )}

      {/* Draft restored banner */}
      {hasDraft && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-300">
          <svg
            className="h-4 w-4 shrink-0 text-amber-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
            />
          </svg>
          <span>
            <span className="font-semibold">Draft restored.</span> Your
            previously saved progress has been loaded. Complete all 3 sections
            and submit to lock the baseline.
          </span>
        </div>
      )}

      {/* Progress strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            key: "class",
            label: "Class Evaluation",
            ok: classOk,
            detail: `${cs.scores.length}/11 criteria`,
          },
          {
            key: "operational",
            label: "Operational",
            ok: opOk,
            detail: `${opVals.length}/8 scores`,
          },
          {
            key: "decision",
            label: "Decision & Impact",
            ok: decisionOk,
            detail: form.panel_decision
              ? "Panel decision set"
              : "Panel decision missing",
          },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => toggle(s.key)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
              s.ok
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-900/20"
                : "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-900/20"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                s.ok ? "bg-emerald-500 text-white" : "bg-amber-400 text-white"
              }`}
            >
              {s.ok ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                "!"
              )}
            </span>
            <div>
              <div
                className={`text-xs font-bold ${s.ok ? "text-emerald-800 dark:text-emerald-300" : "text-amber-800 dark:text-amber-300"}`}
              >
                {s.label}
              </div>
              <div
                className={`text-[10px] ${s.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
              >
                {s.detail}
              </div>
            </div>
            <svg
              className={`ml-auto h-4 w-4 transition-transform ${openSection[s.key] ? "rotate-180" : ""} ${s.ok ? "text-emerald-500" : "text-amber-500"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        ))}
      </div>

      {/* Section 1 — Class Evaluation */}
      {openSection.class && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-[#062B49]/5 to-transparent dark:border-white/[0.06] dark:bg-transparent dark:from-white/[0.04] px-5 py-3.5">
            <div>
              <h3 className="text-sm font-bold text-[#062B49] dark:text-slate-100">
                1. Class Evaluation
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {cs.scores.length}/11 criteria filled · Class{" "}
                {cs.classValue ?? "—"} · Score {safeToFixed(cs.avg)}
              </p>
            </div>
            {cs.classValue && (
              <span
                className={`rounded-xl px-3 py-1.5 text-sm font-bold ${
                  cs.classValue === 1
                    ? "bg-emerald-100 text-emerald-700"
                    : cs.classValue === 2
                      ? "bg-blue-100 text-blue-700"
                      : cs.classValue === 3
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                }`}
              >
                Class {cs.classValue}
              </span>
            )}
          </div>
          <ClassCriteriaBody
            form={form}
            setField={setField}
            extra={extra}
            criteriaDetails={criteriaDetails}
            onDetailChange={onDetailChange}
            relationId={relationId}
            onFileUploaded={onFileUploaded}
            readOnly={readOnly}
          />
        </div>
      )}

      {/* Section 2 — Operational */}
      {openSection.operational && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-[#062B49]/5 to-transparent dark:border-white/[0.06] dark:bg-transparent dark:from-white/[0.04] px-5 py-3.5">
            <div>
              <h3 className="text-sm font-bold text-[#062B49] dark:text-slate-100">
                2. Operational Evaluation
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {opVals.length}/8 scores filled
              </p>
            </div>
          </div>
          <OperationalBody form={form} setField={setField} />
        </div>
      )}

      {/* Section 3 — Decision & Impact */}
      {openSection.decision && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
          <div className="border-b border-slate-100 bg-gradient-to-r from-[#062B49]/5 to-transparent dark:border-white/[0.06] dark:bg-transparent dark:from-white/[0.04] px-5 py-3.5">
            <h3 className="text-sm font-bold text-[#062B49] dark:text-slate-100">
              3. Decision &amp; Impact
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-2">
            <ImpactQuestionsBody
              form={form}
              setField={setField}
              impact={impact}
            />
            <DecisionBody
              form={form}
              setField={setField}
              strategicMentions={strategicMentions}
              onToggleStrategic={onToggleStrategic}
            />
          </div>
        </div>
      )}

      {/* Submit panel — hidden when read-only (already submitted) */}
      {!readOnly && <div className="rounded-2xl border border-[#062B49]/20 bg-[#062B49]/5 px-5 py-4 space-y-3">
        {/* Validation warning (incomplete sections) */}
        {validationMsg && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-300">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-semibold">Cannot submit yet</p>
              <p className="mt-0.5">{validationMsg}</p>
            </div>
          </div>
        )}

        {/* API / server error */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </div>
        )}

        {/* ── Evaluation file upload ── */}
        <EvalFileUploadCard
          relationId={relationId}
          evalDocs={evalDocs}
          onUploaded={onFileUploaded}
          readOnly={readOnly}
        />

        {/* ── Committee outcome explanation ── */}
        {form.panel_decision === "panel_add_exec_committee" && (
          <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/20 dark:bg-indigo-900/10">
            <div className="flex items-center gap-2.5 border-b border-indigo-200/60 bg-indigo-50 px-5 py-3 dark:border-indigo-500/20 dark:bg-indigo-900/20">
              <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-xs font-bold text-indigo-800 dark:text-indigo-200">What happens after submission?</p>
            </div>
            <div className="space-y-3 p-5 text-xs text-slate-600 dark:text-slate-300">
              <p>This supplier's panel decision requires <strong>executive committee validation</strong>. After the evaluation is submitted, the VP Conversion can send the evaluation file to all committee members for review.</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-900/10">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-white text-[9px] font-bold">✓</span>
                  <div>
                    <p className="font-semibold text-emerald-800 dark:text-emerald-300">If all members approve</p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">The VP Conversion confirms the final decision and the supplier is added to the panel.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-500/20 dark:bg-amber-900/10">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-amber-500 text-white text-[9px] font-bold">!</span>
                  <div>
                    <p className="font-semibold text-amber-800 dark:text-amber-300">If one or more members reject</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">The VP Conversion reviews all individual responses and makes the final decision — they can still approve the supplier or confirm the rejection, regardless of individual votes.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#062B49] dark:text-blue-300">
              {allOk ? "Ready to Submit" : !fileOk && classOk && opOk && decisionOk ? "Evaluation file required" : "Complete all sections to submit"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">
              {allOk
                ? isVpConversion
                  ? reevaluationType
                    ? "This will update the operational baseline with the new re-evaluation results."
                    : "This will lock the operational baseline permanently. Class evaluation and decisions can still be updated later."
                  : "This will send the evaluation to VP Conversion for review and approval."
                : !fileOk && classOk && opOk && decisionOk
                  ? "Upload the completed Excel scorecard above before submitting."
                  : "Fill Class Evaluation, Operational, and Decision & Impact — then upload the evaluation file."}
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            {/* Draft button — always available when not fully complete */}
            {!allOk && onSaveDraft && (
              <button
                onClick={onSaveDraft}
                disabled={savingDraft || saving}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-300"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
                {savingDraft ? "Saving…" : "Save Draft"}
              </button>
            )}

            {/* Submit button — disabled when sections are incomplete */}
            <button
              onClick={isVpConversion ? onSubmit : (onSubmitForReview ?? onSubmit)}
              disabled={saving || !allOk}
              title={
                !allOk
                  ? !fileOk && classOk && opOk && decisionOk
                    ? "Upload the evaluation file before submitting"
                    : "Complete all sections before submitting"
                  : undefined
              }
              className="inline-flex items-center gap-2 rounded-xl bg-[#062B49] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#0C5381] disabled:cursor-not-allowed disabled:opacity-40 dark:shadow-[#062B49]/20"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {saving ? "Submitting…" : submitLabel}
            </button>
          </div>
        </div>
      </div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Extracted sub-bodies reused in both single-page and tab views
// ---------------------------------------------------------------------------

function ClassCriteriaBody({
  form,
  setField,
  extra,
  criteriaDetails,
  onDetailChange,
  relationId,
  readOnly,
  onFileUploaded,
}: {
  form: EvaluationDetailsFormData;
  setField: (k: keyof EvaluationDetailsFormData, v: any) => void;
  extra: WorkspaceExtra;
  criteriaDetails: Record<string, CriterionDetail>;
  onDetailChange: (
    pldKey: string,
    field: keyof CriterionDetail,
    value: string,
  ) => void;
  relationId: number;
  readOnly?: boolean;
  onFileUploaded?: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExp = (k: string) =>
    setExpanded((p) => {
      const n = new Set(p);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  return (
    <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
      {CLASS_CRITERIA.map(({ key, label, pldKey }, i) => {
        const val = (form as any)[key] || "";
        const score = val ? (PLD_SCORES[pldKey]?.[val] ?? null) : null;
        const cfg = CRITERIA_DETAIL_CONFIG[pldKey] ?? {};
        const isExpanded = expanded.has(pldKey);
        const detail = criteriaDetails[pldKey] ?? {};
        const isQualCert = pldKey === "quality_certification";
        return (
          <div key={key}>
            <div className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors dark:hover:bg-white/[0.03]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#062B49]/10 text-[10px] font-bold text-[#062B49] dark:bg-blue-500/10 dark:text-blue-300">
                {i + 1}
              </span>
              <div className="w-48 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleExp(pldKey)}
                  className="text-left text-sm font-semibold text-[#062B49] hover:underline dark:text-blue-300"
                >
                  {label}
                  <svg
                    className={`ml-1 inline h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isQualCert && (
                  <p className="text-[10px] text-blue-500 mt-0.5">
                    From unit certs (locked)
                  </p>
                )}
                {detail.validity_end_date && !isExpanded && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Exp. {detail.validity_end_date}
                  </p>
                )}
              </div>
              <div className="flex-1">
                {isQualCert ? (
                  <div
                    title="Determined automatically from the unit's certifications — edit certifications in the Certification Tracker to change this."
                    className={`${inputCls} flex items-center justify-between gap-2 text-xs cursor-not-allowed bg-slate-50 text-slate-600`}
                  >
                    <span className="truncate">{val || "— None —"}</span>
                    <svg
                      className="h-3.5 w-3.5 shrink-0 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v2"
                      />
                    </svg>
                  </div>
                ) : (
                  <select
                    value={val}
                    onChange={(e) => {
                      const newVal = e.target.value;
                      setField(key, newVal);
                      if (newVal)
                        setExpanded((p) => {
                          const n = new Set(p);
                          n.add(pldKey);
                          return n;
                        });
                      const c2 = CRITERIA_DETAIL_CONFIG[pldKey];
                      if (
                        c2?.autoEndMonths &&
                        detail.validity_start_date &&
                        newVal
                      ) {
                        const months = c2.autoEndMonths(newVal);
                        if (typeof months === "number" && months > 0)
                          onDetailChange(
                            pldKey,
                            "validity_end_date",
                            addMonthsToDate(detail.validity_start_date, months),
                          );
                      }
                    }}
                    disabled={readOnly}
                    className={`${inputCls} text-xs ${readOnly ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""}`}
                  >
                    <option value="">— Select —</option>
                    {(PLD_OPTIONS[pldKey] || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="w-14 shrink-0 text-center">
                {score !== null ? (
                  <span
                    className={`inline-block rounded-lg px-2 py-1 text-xs font-bold ${
                      score === 100
                        ? "bg-emerald-50 text-emerald-700"
                        : score >= 50
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                    }`}
                  >
                    {score}
                  </span>
                ) : (
                  <span className="text-slate-300 text-xs">—</span>
                )}
              </div>
              <div className="w-20 shrink-0">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  {score !== null && (
                    <div
                      className={`h-full rounded-full transition-all ${score === 100 ? "bg-emerald-500" : score >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${score}%` }}
                    />
                  )}
                </div>
              </div>
            </div>
            {isExpanded && (
              <div className="border-t border-[#062B49]/8 bg-gradient-to-r from-[#062B49]/5 to-slate-50 px-5 py-4">
                <CriterionDetailPanel
                  pldKey={pldKey}
                  cfg={cfg}
                  detail={detail}
                  selectedValue={val}
                  relationId={relationId}
                  onChange={(field, v) => onDetailChange(pldKey, field, v)}
                  onFileUploaded={onFileUploaded}
                  lockValidityDates={isQualCert}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OperationalBody({
  form,
  setField,
}: {
  form: EvaluationDetailsFormData;
  setField: (k: keyof EvaluationDetailsFormData, v: any) => void;
}) {
  const avg = operationalAvg(form);
  const grade = operationalGrade(avg);
  return (
    <div>
      {avg !== null && (
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 bg-slate-50 dark:border-white/[0.06] dark:bg-[#0d1929]">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Average: <strong>{safeToFixed(avg)}</strong>
          </span>
          {grade && (
            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-bold ${GRADE_CLR[grade] || ""}`}
            >
              Grade {grade}
            </span>
          )}
        </div>
      )}
      <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
        {OPERATIONAL_CRITERIA.map(({ key, label, minReq }) => {
          const val = form[key] as number | undefined;
          const score = val !== undefined ? val : null;
          const ok = score !== null && score >= minReq;
          return (
            <div key={key} className="flex items-center gap-4 px-5 py-3.5">
              <div className="w-52 shrink-0 text-sm text-slate-700 dark:text-slate-300">
                {label}
              </div>
              <input
                type="number"
                min={0}
                max={100}
                value={score ?? ""}
                onChange={(e) => {
                  if (!e.target.value) { setField(key, undefined); return; }
                  const v = Math.min(100, Math.max(0, Number(e.target.value)));
                  setField(key, v);
                }}
                className={`w-24 rounded-xl border px-3 py-2 text-sm font-semibold text-center shadow-sm outline-none transition ${
                  score === null
                    ? "border-slate-200"
                    : ok
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-amber-300 bg-amber-50 text-amber-800"
                } focus:border-[#062B49]/40 focus:ring-4 focus:ring-[#062B49]/8`}
              />
              <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${ok ? "bg-emerald-500" : "bg-amber-400"}`}
                  style={{ width: safeWidth(score) }}
                />
              </div>
              <span className="shrink-0 text-xs text-slate-400">
                Min: {minReq}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ImpactQuestionsBody({
  form,
  setField,
  impact,
}: {
  form: EvaluationDetailsFormData;
  setField: (k: keyof EvaluationDetailsFormData, v: any) => void;
  impact: number;
}) {
  const keys: (keyof EvaluationDetailsFormData)[] = [
    "impact_question_1",
    "impact_question_2",
    "impact_question_3",
    "impact_question_4",
    "impact_question_5",
    "impact_question_6",
  ];
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold text-slate-700">Impact Questions</p>
        <span
          className={`text-sm font-bold ${impact > 0 ? "text-emerald-700" : impact < 0 ? "text-red-700" : "text-slate-500"}`}
        >
          Score: {impact > 0 ? "+" : ""}
          {impact}
        </span>
      </div>
      <div className="space-y-3">
        {keys.map((key, i) => {
          const val = form[key] as string;
          return (
            <div key={key}>
              <p className="mb-1.5 text-xs text-slate-600">
                <span className="font-semibold">{i + 1}.</span>{" "}
                {IMPACT_QUESTIONS[i]}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {IMPACT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setField(key, val === opt ? "" : opt)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                      val === opt
                        ? IMPACT_SCORES[opt] > 0
                          ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : IMPACT_SCORES[opt] < 0
                            ? "border-red-400 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-900/30 dark:text-red-300"
                            : "border-slate-400 bg-slate-100 text-slate-700 dark:border-white/20 dark:bg-white/10 dark:text-slate-300"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-white/20"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DecisionBody({
  form,
  setField,
  strategicMentions,
  onToggleStrategic,
}: {
  form: EvaluationDetailsFormData;
  setField: (k: keyof EvaluationDetailsFormData, v: any) => void;
  strategicMentions: Set<string>;
  onToggleStrategic: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-bold text-slate-700">
          Strategic Mention{" "}
          <span className="font-normal text-slate-400">(multi-select)</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {STRATEGIC_MENTION_OPTIONS.map((opt) => {
            const active =
              opt.value === "none"
                ? strategicMentions.has("none") || strategicMentions.size === 0
                : strategicMentions.has(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToggleStrategic(opt.value)}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                  active
                    ? "border-[#062B49] bg-[#062B49] text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {opt.label}
                {active && opt.value !== "none" && (
                  <svg
                    className="h-3.5 w-3.5 opacity-80"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold text-slate-700">
          Committee Decision <span className="text-red-500">*</span>
        </p>
        <div className="space-y-2">
          {PANEL_DECISION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setField("panel_decision", opt.value)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-xs transition ${
                form.panel_decision === opt.value
                  ? "border-[#062B49] bg-[#062B49]/5"
                  : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#0d1929] dark:hover:bg-white/[0.04]"
              }`}
            >
              <div
                className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${form.panel_decision === opt.value ? "border-[#062B49] bg-[#062B49]" : "border-slate-300"}`}
              >
                {form.panel_decision === opt.value && (
                  <svg
                    className="h-2.5 w-2.5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span
                className={`font-semibold ${form.panel_decision === opt.value ? "text-[#062B49]" : "text-slate-700"}`}
              >
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClassTab (used in normal/post-baseline mode)
// ---------------------------------------------------------------------------

function ClassTab({
  form,
  setField,
  extra,
  cs,
  saving,
  onSave,
  criteriaDetails,
  onDetailChange,
  relationId,
  readOnly,
  onRequestEdit,
  onCancelEdit,
  onFileUploaded,
}: {
  form: EvaluationDetailsFormData;
  setField: (k: keyof EvaluationDetailsFormData, v: any) => void;
  extra: WorkspaceExtra;
  cs: { scores: number[]; avg: number | null; classValue: number | null };
  saving: boolean;
  onSave: () => void;
  criteriaDetails: Record<string, CriterionDetail>;
  onDetailChange: (
    pldKey: string,
    field: keyof CriterionDetail,
    value: string,
  ) => void;
  relationId: number;
  readOnly?: boolean;
  onRequestEdit?: () => void;
  onCancelEdit?: () => void;
  onFileUploaded?: () => void;
}) {
  const qualCerts = extra.unit_certifications ?? [];

  return (
    <div className="space-y-5">
      {/* Score summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Average score */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#062B49] to-[#0C5381] p-5 shadow-md shadow-[#062B49]/20">
          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-300">
            Average Score
          </p>
          <p className="mt-2 text-4xl font-bold text-white">
            {safeToFixed(cs.avg)}
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-sky-400 transition-all"
              style={{ width: `${cs.avg ?? 0}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-blue-200/70">
            {cs.scores.length} / {CLASS_CRITERIA.length} criteria filled
          </p>
          {/* decorative circle */}
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5" />
        </div>

        {/* Supplier class */}
        <div
          className={`relative overflow-hidden rounded-2xl p-5 shadow-md ${
            cs.classValue === 1
              ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30"
              : cs.classValue === 2
                ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/30"
                : cs.classValue === 3
                  ? "bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/30"
                  : cs.classValue === 4
                    ? "bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/30"
                    : "bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-400/20"
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">
            Supplier Class
          </p>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-6xl font-black text-white leading-none">
              {cs.classValue ?? "—"}
            </span>
            <div className="mb-1 text-xs text-white/70 leading-relaxed">
              <div>1: ≥ 90</div>
              <div>2: ≥ 75</div>
              <div>3: ≥ 60</div>
              <div>4: &lt; 60</div>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
        </div>

        {/* Certifications count */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 p-5 shadow-md shadow-sky-500/30">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">
            Unit Certifications
          </p>
          <p className="mt-2 text-4xl font-bold text-white leading-none">
            {qualCerts.length}
          </p>
          <p className="mt-1.5 text-[11px] text-white/60">
            {qualCerts.length === 1 ? "certification registered" : "certifications registered"}
          </p>
          <div className="pointer-events-none absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
        </div>
      </div>

      {/* Criteria list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-[#062B49]/5 to-transparent dark:border-white/[0.06] dark:bg-transparent dark:from-white/[0.04] px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-[#062B49] dark:text-slate-100">
              11 Classification Criteria
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {readOnly
                ? 'Read-only — click "Update criteria" to modify and track a change.'
                : "Select each criterion — the detail panel opens automatically."}
            </p>
          </div>
          {readOnly ? (
            <button
              onClick={onRequestEdit}
              className="flex items-center gap-1.5 rounded-xl border border-[#062B49]/30 bg-white px-4 py-2 text-xs font-semibold text-[#062B49] shadow-sm transition hover:bg-[#062B49]/5 dark:border-blue-400/30 dark:bg-white/[0.04] dark:text-blue-300 dark:hover:bg-white/[0.08]"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Update criteria
            </button>
          ) : (
            extra.baseline_locked && (
              <button
                onClick={onCancelEdit}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400 dark:hover:bg-white/[0.08]"
              >
                Cancel
              </button>
            )
          )}
        </div>

        {/* Edit mode warning */}
        {!readOnly && extra.baseline_locked && (
          <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50 px-5 py-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-900/20 dark:text-amber-300">
            <svg
              className="h-4 w-4 shrink-0 text-amber-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            You are updating class criteria. Changes will be saved with the
            evaluation date you set at the top — status will be recomputed.
          </div>
        )}

        <ClassCriteriaBody
          form={form}
          setField={setField}
          extra={extra}
          criteriaDetails={criteriaDetails}
          onDetailChange={onDetailChange}
          relationId={relationId}
          readOnly={readOnly}
          onFileUploaded={onFileUploaded}
        />

        {!readOnly && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-gradient-to-r from-[#062B49]/5 to-transparent px-5 py-4 dark:border-white/[0.06] dark:bg-transparent dark:from-white/[0.04]">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-[#062B49] dark:text-blue-300">
                {cs.scores.length}
              </span>{" "}
              of 11 criteria filled
              {cs.avg !== null && (
                <>
                  {" "}
                  · avg{" "}
                  <span className="font-semibold text-[#062B49] dark:text-blue-300">
                    {safeToFixed(cs.avg)}
                  </span>
                </>
              )}
            </p>
            <button
              onClick={onSave}
              disabled={saving}
              className="rounded-xl bg-[#062B49] px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#062B49]/20 transition hover:bg-[#0C5381] disabled:opacity-50"
            >
              {saving
                ? "Saving…"
                : extra.baseline_locked
                  ? "Save & Recompute Status"
                  : "Save Class Evaluation"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Criterion detail panel (validity dates, signature, file)
// ---------------------------------------------------------------------------

function CriterionDetailPanel({
  pldKey,
  cfg,
  detail,
  selectedValue,
  relationId,
  onChange,
  onFileUploaded,
  lockValidityDates,
}: {
  pldKey: string;
  cfg: CriterionDetailConfig;
  detail: CriterionDetail;
  selectedValue: string;
  relationId: number;
  onChange: (field: keyof CriterionDetail, val: string) => void;
  onFileUploaded?: () => void;
  lockValidityDates?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileMsg, setFileMsg] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      await supplierAPI.uploadRelationCriterionDocument(
        relationId,
        pldKey,
        file,
      );
      onChange("evidence_file_name", file.name);
      setFileMsg("Uploaded: " + file.name);
      onFileUploaded?.();
    } catch {
      setFileMsg("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleStartDateChange = (val: string) => {
    onChange("validity_start_date", val);
    if (val && selectedValue && cfg.autoEndMonths) {
      const months = cfg.autoEndMonths(selectedValue);
      if (months) {
        onChange("validity_end_date", addMonthsToDate(val, months));
        onChange("auto_validity_end_date", "true");
      }
    }
  };

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
      {/* Signature date — for LTA, SQMA */}
      {cfg.hasSignatureDate && (
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Signature / Agreement date
          </label>
          <input
            type="date"
            value={detail.signature_date || ""}
            onChange={(e) => onChange("signature_date", e.target.value)}
            className={inputCls}
          />
        </div>
      )}

      {/* Validity start — ALL criteria */}
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Validity start
        </label>
        <input
          type="date"
          value={detail.validity_start_date || ""}
          onChange={(e) => handleStartDateChange(e.target.value)}
          disabled={lockValidityDates}
          title={lockValidityDates ? "Determined automatically from the unit's certifications." : undefined}
          className={`${inputCls} ${lockValidityDates ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""}`}
        />
      </div>

      {/* Validity end — ALL criteria, auto-calculated where possible */}
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Validity end
          {detail.auto_validity_end_date === true && (
            <span className="ml-1.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] text-blue-600">
              auto
            </span>
          )}
        </label>
        <input
          type="date"
          value={detail.validity_end_date || ""}
          onChange={(e) => {
            onChange("validity_end_date", e.target.value);
            onChange("auto_validity_end_date", "false");
          }}
          disabled={lockValidityDates}
          title={lockValidityDates ? "Determined automatically from the unit's certifications." : undefined}
          className={`${inputCls} ${lockValidityDates ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""}`}
        />
      </div>

      {/* Coverage amount — Prod Lia Ins */}
      {cfg.hasAmountValue && (
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Coverage amount
          </label>
          <input
            type="text"
            placeholder="e.g. 2 000 000"
            value={detail.amount_value || ""}
            onChange={(e) => onChange("amount_value", e.target.value)}
            className={inputCls}
          />
        </div>
      )}

      {/* Approver email — SQMA */}
      {cfg.hasApproverEmail && (
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Approver email (person who approved the SQMA)
          </label>
          <input
            type="email"
            placeholder="approver@supplier.com"
            value={detail.approver_email || ""}
            onChange={(e) => onChange("approver_email", e.target.value)}
            className={inputCls}
          />
        </div>
      )}

      {/* File upload — ALL criteria */}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Supporting document
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400 dark:hover:bg-white/[0.08]"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
            {uploading
              ? "Uploading…"
              : detail.evidence_file_name
                ? "Replace"
                : "Attach file"}
          </button>
          {(fileMsg || detail.evidence_file_name) && (
            <span className="truncate max-w-xs text-[11px] text-slate-500">
              {fileMsg || detail.evidence_file_name}
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileUpload(f);
            }}
          />
        </div>
      </div>

      {/* Notes — ALL criteria */}
      <div className="sm:col-span-4">
        <label className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Notes
        </label>
        <input
          type="text"
          placeholder="Optional notes for this criterion…"
          value={detail.comments || ""}
          onChange={(e) => onChange("comments", e.target.value)}
          className={inputCls}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2 — Operational
// ---------------------------------------------------------------------------

function OperationalTab({
  form,
  setField,
  extra,
  saving,
  onSubmitBaseline,
}: {
  form: EvaluationDetailsFormData;
  setField: (k: keyof EvaluationDetailsFormData, v: any) => void;
  extra: WorkspaceExtra;
  saving: boolean;
  onSubmitBaseline: () => void;
}) {
  const avg = operationalAvg(form);
  const grade = operationalGrade(avg);
  const baseline = extra.baseline_data;

  if (extra.baseline_locked && baseline) {
    // Read-only locked view
    const baselineAvg = baseline.average_score;
    const baselineGrade = baseline.operational_grade;
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm dark:border-amber-500/30 dark:bg-amber-900/20">
          <svg
            className="h-4 w-4 shrink-0 text-amber-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-semibold text-amber-800">
            Operational baseline locked
          </span>
          <span className="text-amber-700">
            — This self-assessment was submitted and cannot be modified.
            Subsequent scorecards (batch upload) update the grade going forward.
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
          <div className="border-b border-slate-100 bg-slate-50 dark:border-white/[0.06] dark:bg-[#0d1929] px-5 py-3.5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Self-Assessment Baseline
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Original operational evaluation scores — read-only
              </p>
            </div>
            <div className="flex items-center gap-3">
              {baselineAvg !== undefined && (
                <span className="text-sm font-bold text-slate-700">
                  Avg: {safeToFixed(safeNum(baselineAvg))}
                </span>
              )}
              {baselineGrade && (
                <span
                  className={`rounded-lg px-3 py-1 text-sm font-bold ${GRADE_CLR[baselineGrade] || "bg-slate-100 text-slate-700"}`}
                >
                  Grade {baselineGrade}
                </span>
              )}
            </div>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
            {OPERATIONAL_CRITERIA.map(({ key, label, minReq }) => {
              const val = (baseline as any)[key.toString()];
              const score =
                val !== undefined && val !== null ? Number(val) : null;
              const ok = score !== null && score >= minReq;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between px-5 py-3.5"
                >
                  <div className="min-w-[220px] text-sm text-slate-700 dark:text-slate-300">
                    {label}
                  </div>
                  <div className="flex flex-1 items-center gap-4 mx-6">
                    <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]">
                      <div
                        className={`h-full rounded-full transition-all ${ok ? "bg-emerald-500" : "bg-amber-400"}`}
                        style={{ width: safeWidth(score) }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 dark:text-slate-500">
                      Min: {minReq}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-bold w-12 text-right ${ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
                  >
                    {safeToFixed(score)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Editable form (first time)
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-900/20 dark:text-blue-300">
        <strong>Initial Self-Assessment</strong> — Enter the 8 operational
        scores (0–100) from the supplier self-assessment. Once submitted this
        baseline will be <strong>permanently locked</strong>.
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
        <div className="border-b border-slate-100 bg-slate-50 dark:border-white/[0.06] dark:bg-[#0d1929] px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              8 Operational Criteria
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Score 0–100 per criterion. Average → Grade A/B/C/D.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {avg !== null && (
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Avg: {safeToFixed(avg)}
              </span>
            )}
            {grade && (
              <span
                className={`rounded-lg px-3 py-1 text-sm font-bold ${GRADE_CLR[grade] || ""}`}
              >
                Grade {grade}
              </span>
            )}
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {OPERATIONAL_CRITERIA.map(({ key, label, minReq }) => {
            const val = form[key] as number | undefined;
            const score = val !== undefined && val !== null ? val : null;
            const ok = score !== null && score >= minReq;
            return (
              <div key={key} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-52 shrink-0 text-sm text-slate-700">
                  {label}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={score ?? ""}
                      onChange={(e) =>
                        setField(
                          key,
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                      className={`w-24 rounded-xl border px-3 py-2 text-sm font-semibold text-center shadow-sm outline-none transition ${
                        score === null
                          ? "border-slate-200"
                          : ok
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-amber-300 bg-amber-50 text-amber-800"
                      } focus:border-[#062B49]/40 focus:ring-4 focus:ring-[#062B49]/8`}
                    />
                    <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${ok ? "bg-emerald-500" : "bg-amber-400"}`}
                        style={{ width: safeWidth(score) }}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      Min: {minReq}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-4">
          <p className="text-xs text-red-600 font-medium">
            This action is irreversible — baseline will be locked after
            submission.
          </p>
          <button
            onClick={onSubmitBaseline}
            disabled={saving}
            className="rounded-xl bg-[#062B49] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0C5381] disabled:opacity-50"
          >
            {saving ? "Submitting…" : "Submit & Lock Baseline"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3 — History & Documents  (cycle audit timeline)
// ---------------------------------------------------------------------------

interface CycleHistoryEntry {
  cycle_id: number;
  cycle_type: string;
  cycle_date: string | null;
  submitted_by: string | null;
  class_value: number | null;
  operational_grade: string | null;
  final_grade: string | null;
  impact_score: number | null;
  panel_decision: string | null;
  strategic_mention: string | null;
  class_criteria: Record<string, string | number | null> | null;
  operational_scores: Record<string, number | string | null> | null;
  class_criteria_diffs: Record<
    string,
    { from: string | null; to: string | null }
  >;
}

const CYCLE_TYPE_STYLE: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  "Initial Self-Assessment": {
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-800",
    dot: "bg-amber-400",
  },
  "Initial Re-evaluation": {
    bg: "bg-orange-50 border-orange-200",
    text: "text-orange-800",
    dot: "bg-orange-400",
  },
  "Preliminary Re-evaluation": {
    bg: "bg-orange-50 border-orange-200",
    text: "text-orange-800",
    dot: "bg-orange-400",
  },
  "Criteria Change Review": {
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-800",
    dot: "bg-blue-400",
  },
  "Decision & Impact Update": {
    bg: "bg-purple-50 border-purple-200",
    text: "text-purple-800",
    dot: "bg-purple-400",
  },
  "Operational Self-Assessment Refresh": {
    bg: "bg-sky-50 border-sky-200",
    text: "text-sky-800",
    dot: "bg-sky-400",
  },
};

const CRITERIA_LABEL: Record<string, string> = {
  top: "Terms of Payment",
  lta: "LTA",
  productivity: "Productivity",
  quality_certification: "Quality Cert.",
  prod_lia_ins: "Prod. Liability Ins.",
  competitiveness: "Competitiveness",
  sqma: "SQMA",
  family_coverage: "Family Coverage",
  geo_coverage: "Geo Coverage",
  cons_or_wd: "Consignment/WD",
  financial_health: "Financial Health",
};

const OP_LABELS: Record<string, string> = {
  management_system: "Management System",
  customer_communication: "Customer Comm.",
  development_design: "Development/Design",
  production_manufacturing: "Production/Mfg.",
  quality_audits: "Quality & Audits",
  suppliers_subcontractors: "Suppliers & Subs.",
  deliveries: "Deliveries",
  environment_ethic_rules: "Environment & Ethics",
};

function deriveStatusColor(fg: string | null): string | null {
  if (!fg) return null;
  const n = fg.toUpperCase();
  if (["A1", "B1", "A2", "B2"].includes(n))
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["A3", "B3", "C1", "C2", "C3"].includes(n))
    return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-red-50 text-red-700 ring-red-200";
}

function deriveStatusLabel(fg: string | null): string | null {
  if (!fg) return null;
  const n = fg.toUpperCase();
  if (["A1", "B1", "A2", "B2"].includes(n)) return "Can Quote & Be Awarded";
  if (["A3", "B3", "C1", "C2", "C3"].includes(n))
    return "Can Quote / Not Awarded";
  return "New Business on Hold";
}

function CycleCard({
  entry,
  isFirst,
}: {
  entry: CycleHistoryEntry;
  isFirst: boolean;
}) {
  const [expanded, setExpanded] = useState(isFirst);
  const style = CYCLE_TYPE_STYLE[entry.cycle_type] ?? {
    bg: "bg-slate-50 border-slate-200",
    text: "text-slate-700",
    dot: "bg-slate-400",
  };
  const hasDiffs = Object.keys(entry.class_criteria_diffs).length > 0;
  const hasOpScores =
    !!entry.operational_scores &&
    Object.entries(entry.operational_scores).some(
      ([k, v]) => OP_LABELS[k] !== undefined && typeof v === "number",
    );

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return "—";
      return dt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  return (
    <div className="relative pl-6">
      <span
        className={`absolute left-[-1px] top-4 h-3 w-3 -translate-x-1/2 rounded-full ring-2 ring-white dark:ring-[#0d1929] ${style.dot}`}
      />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
        {/* Header row */}
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${style.bg} ${style.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
              {entry.cycle_type}
            </span>
            {entry.class_value != null && (
              <span
                className={`rounded-lg px-2 py-0.5 text-xs font-bold ${
                  entry.class_value === 1
                    ? "bg-emerald-100 text-emerald-800"
                    : entry.class_value === 2
                      ? "bg-blue-100 text-blue-800"
                      : entry.class_value === 3
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                }`}
              >
                Class {entry.class_value}
              </span>
            )}
            {entry.operational_grade && (
              <span
                className={`rounded-lg px-2 py-0.5 text-xs font-bold ${GRADE_CLR[entry.operational_grade] || ""}`}
              >
                Op {entry.operational_grade}
              </span>
            )}
            {entry.final_grade && (
              <span className="rounded-lg bg-[#062B49] px-2 py-0.5 text-xs font-bold text-white">
                {entry.final_grade}
              </span>
            )}
            {entry.final_grade && deriveStatusColor(entry.final_grade) && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${deriveStatusColor(entry.final_grade)}`}
              >
                {deriveStatusLabel(entry.final_grade)}
              </span>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
              {fmtDate(entry.cycle_date)}
            </span>
            {entry.submitted_by && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {entry.submitted_by}
              </span>
            )}
            <svg
              className={`mt-1 h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </button>

        {/* Changed fields strip — always visible when diffs exist */}
        {hasDiffs && (
          <div className="flex flex-wrap items-center gap-2 border-t border-amber-100 bg-amber-50/60 px-5 py-2.5 dark:border-amber-500/20 dark:bg-amber-900/10">
            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 mr-1">
              Changed
            </span>
            {Object.entries(entry.class_criteria_diffs).map(([field, diff]) => (
              <span
                key={field}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2 py-0.5 text-[10px] dark:border-amber-500/30 dark:bg-amber-900/20"
              >
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {CRITERIA_LABEL[field] ?? field}:
                </span>
                {diff.from && (
                  <span className="text-red-500 line-through">{diff.from}</span>
                )}
                {diff.from && diff.to && (
                  <span className="text-slate-400">→</span>
                )}
                {diff.to && (
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {diff.to}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t border-slate-100 dark:border-white/[0.06]">
            {/* Class criteria snapshot */}
            {entry.class_criteria && (
              <div className="px-5 py-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Class Criteria Snapshot
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
                  {Object.entries(CRITERIA_LABEL).map(([key, label]) => {
                    const val = entry.class_criteria?.[key];
                    const isDiff = key in entry.class_criteria_diffs;
                    return (
                      <div
                        key={key}
                        className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 ${isDiff ? "bg-amber-50 dark:bg-amber-900/20" : ""}`}
                      >
                        <span className="text-[11px] shrink-0 text-slate-500 dark:text-slate-400">
                          {label}
                        </span>
                        <span
                          className={`text-[11px] font-semibold truncate max-w-[130px] ${val ? "text-slate-800 dark:text-slate-200" : "text-slate-300 dark:text-slate-600"}`}
                        >
                          {val != null ? String(val) : "—"}
                        </span>
                      </div>
                    );
                  })}
                  {entry.class_criteria.class_score != null && (
                    <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1">
                      <span className="text-[11px] shrink-0 text-slate-500 dark:text-slate-400">
                        Score
                      </span>
                      <span className="text-[11px] font-bold text-[#062B49] dark:text-blue-300">
                        {safeToFixed(safeNum(entry.class_criteria?.class_score))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Operational scores */}
            {hasOpScores && (
              <div className="border-t border-slate-100 dark:border-white/[0.06] px-5 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Operational Scores
                    {entry.operational_scores?.source_type && (
                      <span className="ml-2 normal-case font-normal">
                        ({entry.operational_scores.source_type})
                      </span>
                    )}
                  </p>
                  {entry.operational_scores?.average_score != null && (
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold ${GRADE_CLR[String(entry.operational_scores.operational_grade)] || "bg-slate-100 text-slate-600"}`}
                    >
                      Avg{" "}
                      {safeToFixed(safeNum(entry.operational_scores?.average_score))}{" "}
                      · Grade{" "}
                      {entry.operational_scores.operational_grade ?? "—"}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
                  {Object.entries(OP_LABELS).map(([key, label]) => {
                    const val = entry.operational_scores?.[key];
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1"
                      >
                        <span className="text-[11px] shrink-0 text-slate-500 dark:text-slate-400">
                          {label}
                        </span>
                        <span
                          className={`text-[11px] font-semibold ${val != null ? "text-slate-800 dark:text-slate-200" : "text-slate-300 dark:text-slate-600"}`}
                        >
                          {safeToFixed(safeNum(val), 0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Decision footer */}
            {(entry.panel_decision ||
              (entry.strategic_mention && entry.strategic_mention !== "none") ||
              entry.impact_score != null) && (
              <div className="flex flex-wrap gap-4 border-t border-slate-100 dark:border-white/[0.06] px-5 py-3">
                {entry.panel_decision && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Panel:{" "}
                    </span>
                    {entry.panel_decision}
                  </span>
                )}
                {entry.strategic_mention &&
                  entry.strategic_mention !== "none" && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Strategic:{" "}
                      </span>
                      {entry.strategic_mention}
                    </span>
                  )}
                {entry.impact_score != null && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Impact:{" "}
                    </span>
                    <span
                      className={
                        entry.impact_score > 0
                          ? "text-emerald-700"
                          : entry.impact_score < 0
                            ? "text-red-700"
                            : ""
                      }
                    >
                      {entry.impact_score > 0 ? "+" : ""}
                      {entry.impact_score}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryTab({
  history,
  relationId,
  evalDocs,
  onDocUploaded,
  panelDecision,
  isVpConversion,
}: {
  history: SupplierStatusHistoryEntry[];
  relationId: number;
  evalDocs?: WorkspaceExtra["evaluation_documents"];
  onDocUploaded: () => void;
  panelDecision?: string | null;
  isVpConversion?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cycles, setCycles] = useState<CycleHistoryEntry[]>([]);
  const [cyclesLoading, setCyclesLoading] = useState(true);

  useEffect(() => {
    supplierAPI
      .getCycleHistory(relationId)
      .then((res: any) =>
        setCycles(
          Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [],
        ),
      )
      .catch(() => setCycles([]))
      .finally(() => setCyclesLoading(false));
  }, [relationId]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await supplierAPI.uploadEvaluationReference(relationId, file);
      setMsg("Reference document uploaded.");
      onDocUploaded();
    } catch {
      setMsg("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const fmt = (d?: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-5">
      {panelDecision === "panel_add_exec_committee" && (
        <CommitteeReviewPanel
          relationId={relationId}
          isVpConversion={!!isVpConversion}
        />
      )}
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
      {/* Left — cycle timeline */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Evaluation Cycle History
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Full audit trail — criteria snapshots and change diffs
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">
            {cycles.length} record{cycles.length !== 1 ? "s" : ""}
          </span>
        </div>

        {cyclesLoading ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-12 dark:border-white/[0.08] dark:bg-[#111e30]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-[#062B49]" />
            <span className="text-sm text-slate-400">Loading history…</span>
          </div>
        ) : cycles.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center dark:border-white/[0.08] dark:bg-[#111e30]">
            <svg
              className="h-8 w-8 text-slate-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm text-slate-400">
              No evaluation cycles recorded yet.
            </p>
          </div>
        ) : (
          <div className="relative space-y-3 border-l-2 border-slate-200 dark:border-white/[0.08]">
            {cycles.map((entry, i) => (
              <CycleCard key={entry.cycle_id} entry={entry} isFirst={i === 0} />
            ))}
          </div>
        )}

        {/* Status transitions compact table */}
        {history.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
            <div className="border-b border-slate-100 bg-slate-50 dark:border-white/[0.06] dark:bg-[#0d1929] px-5 py-3">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Status Transitions
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Automatic log of every grade and status change
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:border-white/[0.06]">
                    {[
                      "Date",
                      "Old → New Grade",
                      "Class",
                      "Final",
                      "Status",
                      "By",
                    ].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/[0.04]">
                  {history.map((entry) => (
                    <tr
                      key={entry.id_history}
                      className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {fmt(entry.changed_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          {entry.old_grade && (
                            <span
                              className={`rounded px-1.5 py-0.5 font-bold ${GRADE_CLR[entry.old_grade] || ""}`}
                            >
                              {entry.old_grade}
                            </span>
                          )}
                          {entry.new_grade &&
                            entry.new_grade !== entry.old_grade && (
                              <>
                                <span className="text-slate-400">→</span>
                                <span
                                  className={`rounded px-1.5 py-0.5 font-bold ${GRADE_CLR[entry.new_grade] || ""}`}
                                >
                                  {entry.new_grade}
                                </span>
                              </>
                            )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                        {entry.new_class ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-100">
                        {entry.new_final_grade || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 max-w-[160px] truncate dark:text-slate-400">
                        {entry.new_status || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {entry.changed_by || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Right — documents */}
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
          <div className="border-b border-slate-100 bg-slate-50 dark:border-white/[0.06] dark:bg-[#0d1929] px-5 py-3.5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Evaluation Documents
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Reference files for this relation
            </p>
          </div>
          <div className="p-5">
            <div
              onClick={() => fileRef.current?.click()}
              className="mb-4 flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 transition hover:border-[#062B49]/30 hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-blue-500/30 dark:hover:bg-white/[0.04]"
            >
              <svg
                className="h-5 w-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-sm text-slate-500">
                {uploading ? "Uploading…" : "Upload evaluation reference"}
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.png,.jpg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
            {msg && (
              <p className="mb-3 text-xs text-emerald-600 dark:text-emerald-400">
                {msg}
              </p>
            )}
            {(evalDocs ?? []).length === 0 ? (
              <p className="text-center text-xs text-slate-400">
                No documents yet.
              </p>
            ) : (
              <div className="space-y-2">
                {(evalDocs ?? []).map((doc) => {
                  const typeLabel =
                    doc.document_type === "lta_agreement"
                      ? "LTA"
                      : doc.document_type === "evaluation_criterion_evidence"
                        ? "Evidence"
                        : "Reference";
                  const typeCls =
                    doc.document_type === "lta_agreement"
                      ? "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
                      : doc.document_type === "evaluation_criterion_evidence"
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                        : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400";
                  return (
                    <div
                      key={doc.id_document}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${typeCls}`}
                          >
                            {typeLabel}
                          </span>
                          <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {doc.document_name}
                          </p>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {fmt(doc.uploaded_at)}
                        </p>
                      </div>
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400"
                        >
                          View
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4 — Decision & Impact
// ---------------------------------------------------------------------------

function DecisionTab({
  form,
  setField,
  impact,
  saving,
  onSave,
  strategicMentions,
  onToggleStrategic,
  readOnly,
}: {
  form: EvaluationDetailsFormData;
  setField: (k: keyof EvaluationDetailsFormData, v: any) => void;
  impact: number;
  saving: boolean;
  onSave: () => void;
  strategicMentions: Set<string>;
  onToggleStrategic: (value: string) => void;
  readOnly?: boolean;
}) {
  const impactKeys: (keyof EvaluationDetailsFormData)[] = [
    "impact_question_1",
    "impact_question_2",
    "impact_question_3",
    "impact_question_4",
    "impact_question_5",
    "impact_question_6",
  ];

  return (
    <div className="space-y-4">
      {/* Locked banner */}
      {readOnly && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-600">
          <svg
            className="h-4 w-4 shrink-0 text-slate-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          Decision &amp; Impact was recorded with the initial self-assessment
          and <strong className="ml-1">cannot be modified</strong>.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Impact questions */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
          <div className="border-b border-slate-100 bg-slate-50 dark:border-white/[0.06] dark:bg-[#0d1929] px-5 py-3.5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Supplier Impact
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                6 strategic impact questions
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-400">Impact Score</p>
              <p
                className={`text-xl font-bold ${impact > 0 ? "text-emerald-700" : impact < 0 ? "text-red-700" : "text-slate-600"}`}
              >
                {impact > 0 ? "+" : ""}
                {impact}
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
            {impactKeys.map((key, i) => {
              const val = form[key] as string;
              const score = val ? IMPACT_SCORES[val] : null;
              return (
                <div key={key} className="px-5 py-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="mr-1.5 inline-block w-5 shrink-0 text-slate-400 dark:text-slate-500">
                        {i + 1}.
                      </span>
                      {IMPACT_QUESTIONS[i]}
                    </p>
                    {score !== null && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          score > 0
                            ? "bg-emerald-50 text-emerald-700"
                            : score < 0
                              ? "bg-red-50 text-red-700"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {score > 0 ? `+${score}` : score}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {IMPACT_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        disabled={readOnly}
                        onClick={() =>
                          !readOnly && setField(key, val === opt ? "" : opt)
                        }
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${readOnly ? "cursor-not-allowed opacity-70" : ""} ${
                          val === opt
                            ? IMPACT_SCORES[opt] > 0
                              ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : IMPACT_SCORES[opt] < 0
                                ? "border-red-400 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-900/30 dark:text-red-300"
                                : "border-slate-400 bg-slate-100 text-slate-700 dark:border-white/20 dark:bg-white/10 dark:text-slate-300"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-white/20"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Decision */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
            <div className="border-b border-slate-100 bg-slate-50 dark:border-white/[0.06] dark:bg-[#0d1929] px-5 py-3.5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Strategic Mention
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Filled by Avocarbon Purchasing — multiple selections allowed
                (e.g. Strategic + Directed).
              </p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-2">
                {STRATEGIC_MENTION_OPTIONS.map((opt) => {
                  const active =
                    opt.value === "none"
                      ? strategicMentions.has("none") ||
                        strategicMentions.size === 0
                      : strategicMentions.has(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={readOnly}
                      onClick={() => !readOnly && onToggleStrategic(opt.value)}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${readOnly ? "cursor-not-allowed" : ""} ${
                        active
                          ? "border-[#062B49] bg-[#062B49] text-white shadow-sm dark:border-blue-500 dark:bg-blue-600"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-white/20"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {active && opt.value !== "none" && (
                        <svg
                          className="h-4 w-4 opacity-80"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Show combined label when multiple selected */}
              {strategicMentions.size > 1 && (
                <p className="mt-3 text-xs text-[#062B49] font-semibold">
                  Selected: {Array.from(strategicMentions).join(" + ")}
                </p>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
            <div className="border-b border-slate-100 bg-slate-50 dark:border-white/[0.06] dark:bg-[#0d1929] px-5 py-3.5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Committee Decision
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Panel decision — to be validated
              </p>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
              {PANEL_DECISION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={readOnly}
                  onClick={() =>
                    !readOnly && setField("panel_decision", opt.value)
                  }
                  className={`flex w-full items-center gap-3 px-5 py-4 text-left text-sm transition ${readOnly ? "cursor-not-allowed" : ""} ${
                    form.panel_decision === opt.value
                      ? "bg-[#062B49]/5 dark:bg-blue-500/10"
                      : "hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <div
                    className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition ${
                      form.panel_decision === opt.value
                        ? "border-[#062B49] bg-[#062B49]"
                        : "border-slate-300"
                    }`}
                  >
                    {form.panel_decision === opt.value && (
                      <svg
                        className="h-2.5 w-2.5 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <span
                    className={`font-medium ${form.panel_decision === opt.value ? "text-[#062B49] dark:text-blue-300" : "text-slate-700 dark:text-slate-300"}`}
                  >
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {!readOnly && (
            <div className="flex justify-end">
              <button
                onClick={onSave}
                disabled={saving}
                className="rounded-xl bg-[#062B49] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0C5381] disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Decision & Impact"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 5 — Certifications
// Certifications are per supplier unit. Adding a quality cert (IATF / ISO 9001)
// automatically re-derives the quality_certification score on all active
// evaluations for that unit (handled by the backend on POST).
// ---------------------------------------------------------------------------

type CertRow = {
  standard_type: string;
  certification_type: string;
  certificate_name: string;
  start_date: string;
  end_date: string;
  comments: string;
};

const EMPTY_CERT_ROW: CertRow = {
  standard_type: "",
  certification_type: "",
  certificate_name: "",
  start_date: "",
  end_date: "",
  comments: "",
};

const QUALITY_STANDARDS = new Set(["quality"]);

function CertificationsTab({
  unitId,
  unitName,
  certs,
  onRefresh,
}: {
  unitId: number;
  unitName: string;
  certs: Array<{
    id_certification: number;
    standard_type?: string;
    certification_type?: string;
    certificate_name?: string;
    start_date?: string;
    end_date?: string;
  }>;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CertRow>({ ...EMPTY_CERT_ROW });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const isQualityStandard = QUALITY_STANDARDS.has(form.standard_type);

  const typeOptions = form.standard_type
    ? (CERT_TYPES_BY_STANDARD[form.standard_type] ?? [])
    : [];

  const setField = (k: keyof CertRow, v: string) => {
    setForm((p) => ({
      ...p,
      [k]: v,
      ...(k === "standard_type" ? { certification_type: "" } : {}),
    }));
  };

  const handleSubmit = async () => {
    if (!form.standard_type || !form.certification_type) {
      setError("Standard type and certification are required.");
      return;
    }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setError("Expiry date must be after issue date.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await supplierAPI.addCertificationToUnit(unitId, {
        standard_type: form.standard_type,
        certification_type: form.certification_type,
        certificate_name: form.certificate_name || undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        comments: form.comments || undefined,
      });
      setForm({ ...EMPTY_CERT_ROW });
      setShowForm(false);
      setSuccess(
        isQualityStandard
          ? "Certification added. The Quality Certification score in Class Evaluation has been updated automatically."
          : "Certification added successfully.",
      );
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add certification.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Certifications
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Unit: <span className="font-semibold text-slate-700 dark:text-slate-300">{unitName}</span>
            {" "}— certifications are attached to the supplier unit, not the relation.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => { setShowForm(true); setSuccess(null); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#062B49] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0C5381]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add certification
          </button>
        )}
      </div>

      {/* Success notice */}
      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-300">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          {success}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[#0d1929]">
          <h4 className="mb-4 text-sm font-bold text-slate-900 dark:text-slate-100">
            New certification
          </h4>

          {/* Quality cert info banner */}
          {isQualityStandard && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800 dark:border-sky-500/30 dark:bg-sky-900/20 dark:text-sky-300">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Quality certifications (IATF 16949, ISO 9001…) automatically update the
              <strong className="mx-1">Quality Certification score</strong>
              in Class Evaluation once saved.
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Standard type */}
            <CertField label="Standard Type *">
              <select
                value={form.standard_type}
                onChange={(e) => setField("standard_type", e.target.value)}
                className={inputCls}
              >
                <option value="">Select type…</option>
                {CERTIFICATION_STANDARD_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </CertField>

            {/* Certification (cascades from standard_type) */}
            <CertField label="Certification *">
              <select
                value={form.certification_type}
                onChange={(e) => setField("certification_type", e.target.value)}
                disabled={!form.standard_type}
                className={inputCls}
              >
                <option value="">
                  {form.standard_type ? "Select certification…" : "Select a standard first"}
                </option>
                {typeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </CertField>

            {/* Certificate name / reference */}
            <CertField label="Reference / Name" span={2}>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. IATF-2024-CN-001"
                value={form.certificate_name}
                onChange={(e) => setField("certificate_name", e.target.value)}
              />
            </CertField>

            {/* Dates */}
            <CertField label="Issue Date">
              <input
                type="date"
                className={inputCls}
                value={form.start_date}
                onChange={(e) => setField("start_date", e.target.value)}
              />
            </CertField>

            <CertField label="Expiry Date">
              <input
                type="date"
                className={inputCls}
                value={form.end_date}
                onChange={(e) => setField("end_date", e.target.value)}
              />
            </CertField>

            {/* Comments */}
            <CertField label="Comments" span={2}>
              <textarea
                className={`${inputCls} min-h-[64px]`}
                rows={2}
                placeholder="Optional notes…"
                value={form.comments}
                onChange={(e) => setField("comments", e.target.value)}
              />
            </CertField>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm({ ...EMPTY_CERT_ROW }); setError(null); }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-xl bg-[#062B49] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0C5381] disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save certification"}
            </button>
          </div>
        </div>
      )}

      {/* Existing certifications list */}
      {certs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center dark:border-white/[0.08]">
          <svg className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No certifications yet</p>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            Click "Add certification" to register the first one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {certs.map((c) => {
            const expired = c.end_date ? c.end_date < today : false;
            const expiringSoon =
              !expired && c.end_date
                ? c.end_date <= new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
                : false;
            const isQuality = c.standard_type === "quality";
            return (
              <div
                key={c.id_certification}
                className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-white/[0.08] dark:bg-[#0d1929]"
              >
                {/* Icon */}
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  isQuality
                    ? "bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400"
                    : "bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400"
                }`}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {c.certification_type || "—"}
                    </span>
                    {isQuality && (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:ring-sky-700">
                        Quality · affects score
                      </span>
                    )}
                    {expired ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-700">
                        Expired
                      </span>
                    ) : expiringSoon ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-700">
                        Expiring soon
                      </span>
                    ) : null}
                  </div>
                  {c.certificate_name && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{c.certificate_name}</p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                    {c.standard_type && <span>Standard: {c.standard_type}</span>}
                    {c.start_date && <span>Issued: {c.start_date}</span>}
                    {c.end_date && (
                      <span className={expired ? "font-semibold text-red-500" : expiringSoon ? "font-semibold text-amber-500" : ""}>
                        Expires: {c.end_date}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// CertField — lightweight label wrapper used only in CertificationsTab
function CertField({
  label,
  span,
  children,
}: {
  label: string;
  span?: 2;
  children: React.ReactNode;
}) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}
