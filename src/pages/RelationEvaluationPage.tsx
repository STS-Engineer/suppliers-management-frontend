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
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
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
  { id: "history", label: "History & Documents" },
  { id: "decision", label: "Decision & Impact" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-[#062B49]/40 focus:ring-4 focus:ring-[#062B49]/8";

export default function RelationEvaluationPage() {
  const { relationId } = useParams<{ relationId: string }>();
  const relId = Number(relationId);

  const [tab, setTab] = useState<Tab>("class");
  const [form, setForm] = useState<EvaluationDetailsFormData>({
    strategic_mention: "none",
    class_criteria_details: {},
  });
  const [relation, setRelation] = useState<SupplierSiteRelation | null>(null);
  const [siteName, setSiteName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [extra, setExtra] = useState<WorkspaceExtra>({
    baseline_locked: false,
  });
  const [history, setHistory] = useState<SupplierStatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Tab | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [evalDocs, setEvalDocs] = useState<
    WorkspaceExtra["evaluation_documents"]
  >([]);

  // Evaluation date (can differ from today) + initial self-assessment flag
  const [evaluationDate, setEvaluationDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  // Default true — will be set false once baseline is already locked
  const [isInitialSelfAssessment, setIsInitialSelfAssessment] = useState(true);
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
    if (!relId) return;
    setLoading(true);
    setError(null);
    try {
      const [wsRes, sitesRes] = await Promise.all([
        supplierAPI.getRelationEvaluationWorkspace(relId),
        supplierAPI.listSites(),
      ]);
      const ws = wsRes.data as any;
      const rel: SupplierSiteRelation = ws.relation;
      const sites = (
        Array.isArray(sitesRes.data) ? sitesRes.data : []
      ) as any[];
      const site = sites.find((s: any) => s.id_site === rel.id_site);
      setRelation(rel);
      setSiteName(site?.site_name || `Site #${rel.id_site}`);

      // unit_supplier_code is injected by the workspace endpoint
      setUnitName(
        (ws as any).unit_supplier_code ||
          rel.unit_code ||
          `Unit #${rel.id_supplier_unit}`,
      );

      setHistory(ws.status_history || []);
      const baselineLocked = ws.baseline_locked ?? false;
      // Once baseline is locked the initial self-assessment phase is over
      if (baselineLocked) setIsInitialSelfAssessment(false);

      setExtra({
        baseline_locked: baselineLocked,
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

      // Auto-populate quality_certification details from unit certs if not already set
      const qualCert = (ws.unit_certifications ?? []).find(
        (c: any) => c.standard_type === "quality" && c.certification_type,
      );
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
      const sm =
        ws.strategic_mention || ws.relation?.strategic_mention || "none";
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

      const n = (v: any) =>
        v !== undefined && v !== null ? Number(v) : undefined;
      setForm({
        strategic_mention: ws.strategic_mention || "none",
        panel_decision: ws.panel_decision || undefined,
        class_value: ws.class_value ?? undefined,
        class_score: n(ws.class_score),
        operational_grade: ws.operational_grade ?? undefined,
        operational_score: n(ws.operational_score),
        impact_score: ws.impact_score ?? undefined,
        comments: ws.comments || "",
        class_criteria_details: ws.class_criteria_details || {},
        top: ws.top || "",
        lta: ws.lta || "",
        sqma: ws.sqma || "",
        quality_certification: ws.quality_certification || "",
        family_coverage: ws.family_coverage || "",
        competitiveness: ws.competitiveness || "",
        geo_coverage: ws.geo_coverage || "",
        cons_or_wd: ws.cons_or_wd || "",
        financial_health: ws.financial_health || "",
        prod_lia_ins: ws.prod_lia_ins || "",
        prod: ws.prod || "",
        management_system: n(ws.management_system),
        customer_communication: n(ws.customer_communication),
        development_design: n(ws.development_design),
        production_manufacturing: n(ws.production_manufacturing),
        quality_audits: n(ws.quality_audits),
        suppliers_subcontractors: n(ws.suppliers_subcontractors),
        deliveries: n(ws.deliveries),
        environment_ethic_rules: n(ws.environment_ethic_rules),
        impact_question_1: ws.impact_question_1 || "",
        impact_question_2: ws.impact_question_2 || "",
        impact_question_3: ws.impact_question_3 || "",
        impact_question_4: ws.impact_question_4 || "",
        impact_question_5: ws.impact_question_5 || "",
        impact_question_6: ws.impact_question_6 || "",
      });
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
      await supplierAPI.updateRelationClassEvaluation(relId, {
        evaluation_date: evaluationDate,
        cycle_type: isInitialSelfAssessment
          ? "Initial Self-Assessment"
          : "Criteria Change Review",
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

  // Validate completeness before locking the baseline
  const validateInitialSelfAssessment = (): string | null => {
    const cs2 = classScore(form);
    if (cs2.scores.length === 0) {
      return "Class Evaluation: please fill at least one criterion before submitting the initial self-assessment.";
    }
    const opVals = OPERATIONAL_CRITERIA.map(
      ({ key }) => form[key] as number | undefined,
    ).filter((v) => v !== undefined && v !== null);
    if (opVals.length < OPERATIONAL_CRITERIA.length) {
      return `Operational: all 8 criteria must have a score (${opVals.length}/8 filled).`;
    }
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
      if (validationError) { setError(validationError); return; }
    }
    setSaving("operational");
    setError(null);
    try {
      const smValue = Array.from(strategicMentions).join(",") || "none";
      const computed = classScore(form);
      const cycleType = isInitialSelfAssessment ? "Initial Self-Assessment" : "Operational Self-Assessment Refresh";

      // 1. Save class evaluation criteria
      await supplierAPI.updateRelationClassEvaluation(relId, {
        evaluation_date: evaluationDate,
        cycle_type: cycleType,
        top: form.top, lta: form.lta, productivity: form.prod,
        quality_certification: form.quality_certification,
        prod_lia_ins: form.prod_lia_ins, competitiveness: form.competitiveness,
        sqma: form.sqma, family_coverage: form.family_coverage,
        geo_coverage: form.geo_coverage, cons_or_wd: form.cons_or_wd,
        financial_health: form.financial_health,
        class_score: computed.avg, class_value: computed.classValue,
        strategic_mention: smValue,
        panel_decision: form.panel_decision,
        impact_score: impactScore(form),
        impact_question_1: form.impact_question_1,
        impact_question_2: form.impact_question_2,
        impact_question_3: form.impact_question_3,
        impact_question_4: form.impact_question_4,
        impact_question_5: form.impact_question_5,
        impact_question_6: form.impact_question_6,
        class_criteria_details: Object.fromEntries(Object.entries(criteriaDetails)),
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

      showMsg("Initial self-assessment saved and operational baseline locked.");
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
      <div className="flex min-h-screen items-center justify-center gap-3 bg-slate-50">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#062B49]" />
        <span className="text-sm text-slate-400">
          Loading evaluation workspace…
        </span>
      </div>
    );

  const statusCfg = status ? STATUS_FROM_GRADE[status] : null;

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      {/* ── Hero header ── */}
      <div className="bg-[#062B49] shadow-lg shadow-[#062B49]/30">
        <div className="mx-auto max-w-[1400px] px-6 pt-5 pb-0">
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
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-blue-200 select-none">
              <input
                type="checkbox"
                checked={isInitialSelfAssessment}
                onChange={(e) => setIsInitialSelfAssessment(e.target.checked)}
                className="h-4 w-4 rounded border-blue-300 accent-blue-400"
              />
              Initial self-assessment
            </label>
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

      <div className="mx-auto max-w-[1400px] px-6 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
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
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
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

        {/* ── Initial self-assessment mode: all sections on one page ── */}
        {isInitialSelfAssessment && !extra.baseline_locked ? (
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
            error={error}
            onSubmit={saveBaseline}
            validateFn={validateInitialSelfAssessment}
            relationId={relId}
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
                readOnly={extra.baseline_locked && !classEditMode}
                onRequestEdit={() => setClassEditMode(true)}
                onCancelEdit={() => { setClassEditMode(false); load(); }}
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
                readOnly={extra.baseline_locked}
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
  error,
  onSubmit,
  validateFn,
  relationId,
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
  error: string | null;
  onSubmit: () => void;
  validateFn: () => string | null;
}) {
  const [openSection, setOpenSection] = useState<Record<string, boolean>>({
    class: true,
    operational: false,
    decision: false,
  });
  const toggle = (k: string) => setOpenSection((p) => ({ ...p, [k]: !p[k] }));

  // Completion checks
  const classOk = cs.scores.length >= 1;
  const opVals = OPERATIONAL_CRITERIA.map(
    ({ key }) => form[key] as number | undefined,
  ).filter((v) => v !== undefined && v !== null);
  const opOk = opVals.length === OPERATIONAL_CRITERIA.length;
  const decisionOk = !!form.panel_decision;
  const allOk = classOk && opOk && decisionOk;

  const validationMsg = validateFn();

  return (
    <div className="space-y-4">
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
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
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
                className={`text-xs font-bold ${s.ok ? "text-emerald-800" : "text-amber-800"}`}
              >
                {s.label}
              </div>
              <div
                className={`text-[10px] ${s.ok ? "text-emerald-600" : "text-amber-600"}`}
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
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-[#062B49]/5 to-transparent px-5 py-3.5">
            <div>
              <h3 className="text-sm font-bold text-[#062B49]">
                1. Class Evaluation
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {cs.scores.length}/11 criteria filled · Class{" "}
                {cs.classValue ?? "—"} · Score {cs.avg?.toFixed(1) ?? "—"}
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
          />
        </div>
      )}

      {/* Section 2 — Operational */}
      {openSection.operational && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-[#062B49]/5 to-transparent px-5 py-3.5">
            <div>
              <h3 className="text-sm font-bold text-[#062B49]">
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
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-[#062B49]/5 to-transparent px-5 py-3.5">
            <h3 className="text-sm font-bold text-[#062B49]">
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

      {/* Submit panel — validation + API error + button all together */}
      <div className="rounded-2xl border border-[#062B49]/20 bg-[#062B49]/5 px-5 py-4 space-y-3">

        {/* Validation warning (incomplete sections) */}
        {validationMsg && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {validationMsg}
          </div>
        )}

        {/* API / server error */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#062B49]">
              Submit Initial Self-Assessment
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              This will lock the operational baseline permanently. Class
              evaluation and decisions can still be updated later.
            </p>
          </div>
          <button
            onClick={onSubmit}
            disabled={saving}
            className={`rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-md transition disabled:opacity-50 ${
              allOk
                ? "bg-[#062B49] shadow-[#062B49]/20 hover:bg-[#0C5381]"
                : "bg-amber-500 shadow-amber-500/20 hover:bg-amber-600"
            }`}
          >
            {saving
              ? "Submitting…"
              : allOk
                ? "Submit & Lock Baseline"
                : "Submit anyway (incomplete)"}
          </button>
        </div>
      </div>
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
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExp = (k: string) =>
    setExpanded((p) => {
      const n = new Set(p);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  return (
    <div className="divide-y divide-slate-50">
      {CLASS_CRITERIA.map(({ key, label, pldKey }, i) => {
        const val = (form as any)[key] || "";
        const score = val ? (PLD_SCORES[pldKey]?.[val] ?? null) : null;
        const cfg = CRITERIA_DETAIL_CONFIG[pldKey] ?? {};
        const isExpanded = expanded.has(pldKey);
        const detail = criteriaDetails[pldKey] ?? {};
        const isQualCert = pldKey === "quality_certification";
        const qualCerts =
          extra.unit_certifications?.filter(
            (c) => c.standard_type === "quality" && c.certification_type,
          ) ?? [];
        const appliedFromUnit =
          isQualCert && qualCerts.some((c) => c.certification_type === val);
        return (
          <div key={key}>
            <div className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#062B49]/10 text-[10px] font-bold text-[#062B49]">
                {i + 1}
              </span>
              <div className="w-48 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleExp(pldKey)}
                  className="text-left text-sm font-semibold text-[#062B49] hover:underline"
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
                {appliedFromUnit && (
                  <p className="text-[10px] text-blue-500 mt-0.5">
                    From unit certs
                  </p>
                )}
                {detail.validity_end_date && !isExpanded && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Exp. {detail.validity_end_date}
                  </p>
                )}
              </div>
              <div className="flex-1">
                <select
                  value={val}
                  onChange={(e) => {
                    setField(key, e.target.value);
                    if (e.target.value)
                      setExpanded((p) => {
                        const n = new Set(p);
                        n.add(pldKey);
                        return n;
                      });
                    const c2 = CRITERIA_DETAIL_CONFIG[pldKey];
                    if (
                      c2?.autoEndMonths &&
                      detail.validity_start_date &&
                      e.target.value
                    ) {
                      const months = c2.autoEndMonths(e.target.value);
                      if (months)
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
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 bg-slate-50">
          <span className="text-xs text-slate-500">
            Average: <strong>{avg.toFixed(1)}</strong>
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
      <div className="divide-y divide-slate-50">
        {OPERATIONAL_CRITERIA.map(({ key, label, minReq }) => {
          const val = form[key] as number | undefined;
          const score = val !== undefined ? val : null;
          const ok = score !== null && score >= minReq;
          return (
            <div key={key} className="flex items-center gap-4 px-5 py-3.5">
              <div className="w-52 shrink-0 text-sm text-slate-700">
                {label}
              </div>
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
                  style={{ width: `${Math.min(score ?? 0, 100)}%` }}
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
                          ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                          : IMPACT_SCORES[opt] < 0
                            ? "border-red-400 bg-red-50 text-red-700"
                            : "border-slate-400 bg-slate-100 text-slate-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
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
                  : "border-slate-200 bg-white hover:bg-slate-50"
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
}) {
  // All quality certs on the unit (used in summary card only)
  const qualCerts = (extra.unit_certifications ?? []).filter(
    (c) => c.standard_type === "quality" && c.certification_type,
  );

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
            {cs.avg !== null ? cs.avg.toFixed(1) : "—"}
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

        {/* Quality certs from unit */}
        {qualCerts.length > 0 ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-sky-600">
              Unit certifications
            </p>
            <div className="space-y-2.5">
              {qualCerts.map((c) => (
                <div
                  key={c.id_certification}
                  className="flex items-center justify-between gap-2 rounded-xl border border-sky-100 bg-white px-3 py-2.5"
                >
                  <div>
                    <p className="text-xs font-bold text-sky-900">
                      {c.certification_type}
                    </p>
                    {c.end_date && (
                      <p className="text-[10px] text-sky-500 mt-0.5">
                        Expires {c.end_date}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      setField("quality_certification", c.certification_type)
                    }
                    className="shrink-0 rounded-lg bg-sky-100 px-2.5 py-1 text-[10px] font-bold text-sky-700 transition hover:bg-sky-200"
                  >
                    Apply →
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 flex items-center justify-center text-xs text-slate-400">
            No quality certifications on this unit
          </div>
        )}
      </div>

      {/* Criteria list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-[#062B49]/5 to-transparent px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-[#062B49]">11 Classification Criteria</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {readOnly
                ? "Read-only — click \"Update criteria\" to modify and track a change."
                : "Select each criterion — the detail panel opens automatically."}
            </p>
          </div>
          {readOnly ? (
            <button onClick={onRequestEdit}
              className="flex items-center gap-1.5 rounded-xl border border-[#062B49]/30 bg-white px-4 py-2 text-xs font-semibold text-[#062B49] shadow-sm transition hover:bg-[#062B49]/5">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Update criteria
            </button>
          ) : extra.baseline_locked && (
            <button onClick={onCancelEdit}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
              Cancel
            </button>
          )}
        </div>

        {/* Edit mode warning */}
        {!readOnly && extra.baseline_locked && (
          <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50 px-5 py-3 text-xs text-amber-800">
            <svg className="h-4 w-4 shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            You are updating class criteria. Changes will be saved with the evaluation date you set at the top — status will be recomputed.
          </div>
        )}

        <ClassCriteriaBody form={form} setField={setField} extra={extra}
          criteriaDetails={criteriaDetails} onDetailChange={onDetailChange}
          relationId={relationId} readOnly={readOnly} />

        {!readOnly && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-gradient-to-r from-[#062B49]/5 to-transparent px-5 py-4">
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-[#062B49]">{cs.scores.length}</span> of 11 criteria filled
              {cs.avg !== null && <> · avg <span className="font-semibold text-[#062B49]">{cs.avg.toFixed(1)}</span></>}
            </p>
            <button onClick={onSave} disabled={saving}
              className="rounded-xl bg-[#062B49] px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#062B49]/20 transition hover:bg-[#0C5381] disabled:opacity-50">
              {saving ? "Saving…" : extra.baseline_locked ? "Save & Recompute Status" : "Save Class Evaluation"}
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
}: {
  pldKey: string;
  cfg: CriterionDetailConfig;
  detail: CriterionDetail;
  selectedValue: string;
  relationId: number;
  onChange: (field: keyof CriterionDetail, val: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileMsg, setFileMsg] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      if (pldKey === "lta")
        await supplierAPI.uploadLtaDocument(relationId, file);
      else await supplierAPI.uploadEvaluationReference(relationId, file);
      onChange("evidence_file_name", file.name);
      setFileMsg("Uploaded: " + file.name);
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
          <label className="mb-1 block text-[11px] font-semibold text-slate-500">
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
        <label className="mb-1 block text-[11px] font-semibold text-slate-500">
          Validity start
        </label>
        <input
          type="date"
          value={detail.validity_start_date || ""}
          onChange={(e) => handleStartDateChange(e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Validity end — ALL criteria, auto-calculated where possible */}
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-slate-500">
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
          className={inputCls}
        />
      </div>

      {/* Coverage amount — Prod Lia Ins */}
      {cfg.hasAmountValue && (
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-500">
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
          <label className="mb-1 block text-[11px] font-semibold text-slate-500">
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
        <label className="mb-1 block text-[11px] font-semibold text-slate-500">
          Supporting document
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
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
        <label className="mb-1 block text-[11px] font-semibold text-slate-500">
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
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm">
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

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Self-Assessment Baseline
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Original operational evaluation scores — read-only
              </p>
            </div>
            <div className="flex items-center gap-3">
              {baselineAvg !== undefined && (
                <span className="text-sm font-bold text-slate-700">
                  Avg: {Number(baselineAvg).toFixed(1)}
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
          <div className="divide-y divide-slate-50">
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
                  <div className="min-w-[220px] text-sm text-slate-700">
                    {label}
                  </div>
                  <div className="flex flex-1 items-center gap-4 mx-6">
                    <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${ok ? "bg-emerald-500" : "bg-amber-400"}`}
                        style={{ width: `${Math.min(score ?? 0, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      Min: {minReq}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-bold w-12 text-right ${ok ? "text-emerald-700" : "text-amber-700"}`}
                  >
                    {score !== null ? score.toFixed(1) : "—"}
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
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-3 text-sm text-blue-800">
        <strong>Initial Self-Assessment</strong> — Enter the 8 operational
        scores (0–100) from the supplier self-assessment. Once submitted this
        baseline will be <strong>permanently locked</strong>.
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              8 Operational Criteria
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Score 0–100 per criterion. Average → Grade A/B/C/D.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {avg !== null && (
              <span className="text-sm font-semibold text-slate-700">
                Avg: {avg.toFixed(1)}
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
                        style={{ width: `${Math.min(score ?? 0, 100)}%` }}
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
// Tab 3 — History & Documents
// ---------------------------------------------------------------------------

function HistoryTab({
  history,
  relationId,
  evalDocs,
  onDocUploaded,
}: {
  history: SupplierStatusHistoryEntry[];
  relationId: number;
  evalDocs?: WorkspaceExtra["evaluation_documents"];
  onDocUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
      {/* Status history */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
          <h2 className="text-sm font-bold text-slate-900">Status History</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            All grade and status changes for this relation
          </p>
        </div>
        {history.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            No evaluation history yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {[
                    "Date",
                    "Grade",
                    "Class",
                    "Final Grade",
                    "Status",
                    "Changed by",
                  ].map((h) => (
                    <th key={h} className="px-5 py-3 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map((entry) => (
                  <tr key={entry.id_history} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-500">
                      {fmt(entry.changed_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        {entry.old_grade && (
                          <span
                            className={`rounded px-1.5 py-0.5 font-semibold ${GRADE_CLR[entry.old_grade] || ""}`}
                          >
                            {entry.old_grade}
                          </span>
                        )}
                        {entry.new_grade &&
                          entry.new_grade !== entry.old_grade && (
                            <>
                              <span className="text-slate-400">→</span>
                              <span
                                className={`rounded px-1.5 py-0.5 font-semibold ${GRADE_CLR[entry.new_grade] || ""}`}
                              >
                                {entry.new_grade}
                              </span>
                            </>
                          )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {entry.new_class ?? "—"}
                    </td>
                    <td className="px-5 py-3 font-bold text-slate-800">
                      {entry.new_final_grade || "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500 max-w-[180px] truncate">
                      {entry.new_status || "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-400">
                      {entry.changed_by || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
            <h2 className="text-sm font-bold text-slate-900">
              Evaluation Documents
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Reference files for this relation
            </p>
          </div>
          <div className="p-5">
            {/* Upload */}
            <div
              onClick={() => fileRef.current?.click()}
              className="mb-4 flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 transition hover:border-[#062B49]/30 hover:bg-white"
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
            {msg && <p className="mb-3 text-xs text-emerald-600">{msg}</p>}

            {/* List */}
            {!evalDocs || evalDocs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">
                No documents uploaded yet.
              </p>
            ) : (
              <div className="space-y-2">
                {evalDocs.map((doc) => (
                  <div
                    key={doc.id_document}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
                  >
                    <svg
                      className="h-4 w-4 shrink-0 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-slate-800">
                        {doc.document_name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {doc.document_type === "lta_agreement"
                          ? "LTA"
                          : "Eval ref"}{" "}
                        · {fmt(doc.uploaded_at)}
                      </div>
                    </div>
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-[#062B49] transition hover:bg-slate-50"
                      >
                        View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
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
          <svg className="h-4 w-4 shrink-0 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          Decision &amp; Impact was recorded with the initial self-assessment and <strong className="ml-1">cannot be modified</strong>.
        </div>
      )}

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {/* Impact questions */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Supplier Impact
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
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
        <div className="divide-y divide-slate-50">
          {impactKeys.map((key, i) => {
            const val = form[key] as string;
            const score = val ? IMPACT_SCORES[val] : null;
            return (
              <div key={key} className="px-5 py-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-700">
                    <span className="mr-1.5 inline-block w-5 shrink-0 text-slate-400">
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
                      onClick={() => !readOnly && setField(key, val === opt ? "" : opt)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${readOnly ? "cursor-not-allowed opacity-70" : ""} ${
                        val === opt
                          ? IMPACT_SCORES[opt] > 0
                            ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                            : IMPACT_SCORES[opt] < 0
                              ? "border-red-400 bg-red-50 text-red-700"
                              : "border-slate-400 bg-slate-100 text-slate-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
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
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
            <h2 className="text-sm font-bold text-slate-900">
              Strategic Mention
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Filled by Avocarbon Purchasing — multiple selections allowed (e.g.
              Strategic + Directed).
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
                        ? "border-[#062B49] bg-[#062B49] text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
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

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
            <h2 className="text-sm font-bold text-slate-900">
              Committee Decision
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Panel decision — to be validated
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {PANEL_DECISION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={readOnly}
                onClick={() => !readOnly && setField("panel_decision", opt.value)}
                className={`flex w-full items-center gap-3 px-5 py-4 text-left text-sm transition ${readOnly ? "cursor-not-allowed" : ""} ${
                  form.panel_decision === opt.value
                    ? "bg-[#062B49]/5"
                    : "hover:bg-slate-50"
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
                  className={`font-medium ${form.panel_decision === opt.value ? "text-[#062B49]" : "text-slate-700"}`}
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
