/**
 * Evaluation Details Form
 * Premium upgraded UI
 * Captures class criteria, operational self-assessment, impact, and decisions.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileUp,
  Gauge,
  Layers3,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { FormInput, FormSelect, FormTextarea } from "./FormElements";
import { supplierAPI } from "../../services/supplierOnboardingAPI";
import {
  ClassCriterionDetailFormData,
  EvaluationDetailsFormData,
  OnboardingSelectionOptions,
} from "../../types/onboarding";
import {
  calculateImpactScore,
  getPldOnboardingOptions,
  IMPACT_RESULT_OPTIONS,
  PANEL_DECISION_OPTIONS,
  STRATEGIC_MENTION_OPTIONS,
} from "../../utils/onboarding";

interface EvaluationDetailsFormProps {
  data: EvaluationDetailsFormData;
  errors?: { [key: string]: string };
  onChange: (field: keyof EvaluationDetailsFormData, value: any) => void;
  relationId?: number | null;
  mode?: "all" | "class" | "operational" | "impact-decision";
  showHeader?: boolean;
}

interface EvaluationSectionProps {
  title: string;
  subtitle: string;
  tone: "amber" | "blue" | "emerald" | "indigo";
  icon: React.ReactNode;
  children: React.ReactNode;
}

type PldOptionSet = Pick<
  OnboardingSelectionOptions,
  | "top"
  | "lta"
  | "sqma"
  | "quality_certification"
  | "family_coverage"
  | "competitiveness"
  | "geo_coverage"
  | "cons_or_wd"
  | "financial_health"
  | "prod_lia_ins"
  | "prod"
>;

type CriterionFieldName =
  | "top"
  | "lta"
  | "prod"
  | "quality_certification"
  | "prod_lia_ins"
  | "competitiveness"
  | "sqma"
  | "family_coverage"
  | "geo_coverage"
  | "cons_or_wd"
  | "financial_health";

const DEFAULT_PLD_OPTIONS =
  getPldOnboardingOptions() as unknown as PldOptionSet;

const EVALUATION_CHANGE_TYPE_OPTIONS = [
  { value: "Criteria Change Review", label: "Criteria Change Review" },
  { value: "Class Reassessment", label: "Class Reassessment" },
  { value: "Annual Review", label: "Annual Review" },
  { value: "Exceptional Panel Review", label: "Exceptional Panel Review" },
];

const SCORE_BY_VALUE: Record<string, number> = {
  "60 days end of month or +": 100,
  "60 days net": 80,
  "30 days end of month or +": 50,
  "30 days net": 30,
  "Cash in Advance": 0,
  "3 years/+": 100,
  "2 years": 80,
  "1 year": 50,
  "None/Invalid": 0,
  "3% or +": 100,
  "2% or +": 80,
  "1% or +": 50,
  "less than 1%": 30,
  Neg: 0,
  "IATF / ISO9001 (cat BCD)": 100,
  ISO9001: 50,
  None: 0,
  "2M$ or +": 100,
  "1M$ or +": 50,
  "Almost Best in Fam.": 80,
  "Best in Fam.": 100,
  "Ave. in Fam.": 50,
  "Less Avg": 30,
  "Not Comp.": 0,
  Rejected: 0,
  Signed: 100,
  "Signed m.res.": 80,
  "Signed M/Res/not sent": 30,
  "Supplier can make 1 family requirements": 0,
  "Supplier can make all the family requirements": 100,
  "Supplier can make only of few family requirements": 50,
  "Supplier can make the main family requirements": 80,
  "1 plant is covered": 30,
  "Main plants covered": 100,
  "More than 50% plants are covered": 50,
  "Biweekly Del.": 30,
  "Cons. Or Daily Deliveries": 100,
  "DDP or Weekly Del.": 50,
  Other: 0,
  Good: 100,
  "To Monitor": 50,
  "At Risk": 0,
};

const CLASS_CRITERIA: Array<{
  field: CriterionFieldName;
  detailKey: string;
  label: string;
  placeholder: string;
  optionsKey: keyof PldOptionSet;
  evidence: {
    file?: boolean;
    validity?: boolean;
    signature?: boolean;
    update?: boolean;
    amount?: boolean;
  };
}> = [
  {
    field: "top",
    detailKey: "top",
    label: "Terms of Payments (TOP)",
    placeholder: "Select TOP",
    optionsKey: "top",
    evidence: {},
  },
  {
    field: "lta",
    detailKey: "lta",
    label: "Long Term Agreement",
    placeholder: "Select LTA",
    optionsKey: "lta",
    evidence: { validity: true, update: true },
  },
  {
    field: "prod",
    detailKey: "productivity",
    label: "Productivity",
    placeholder: "Select Productivity",
    optionsKey: "prod",
    evidence: { file: true, validity: true, update: true },
  },
  {
    field: "quality_certification",
    detailKey: "quality_certification",
    label: "Quality Certification",
    placeholder: "Select certification rule",
    optionsKey: "quality_certification",
    evidence: { file: true, validity: true, signature: true, update: true },
  },
  {
    field: "prod_lia_ins",
    detailKey: "prod_lia_ins",
    label: "Product Liability Insurance",
    placeholder: "Select insurance coverage",
    optionsKey: "prod_lia_ins",
    evidence: { validity: true, amount: true },
  },
  {
    field: "competitiveness",
    detailKey: "competitiveness",
    label: "Competitiveness",
    placeholder: "Select competitiveness",
    optionsKey: "competitiveness",
    evidence: {},
  },
  {
    field: "sqma",
    detailKey: "sqma",
    label: "SQMA",
    placeholder: "Select SQMA status",
    optionsKey: "sqma",
    evidence: { file: true, validity: true, signature: true, update: true },
  },
  {
    field: "family_coverage",
    detailKey: "family_coverage",
    label: "Family Coverage (Fam. Cov.)",
    placeholder: "Select family coverage",
    optionsKey: "family_coverage",
    evidence: {},
  },
  {
    field: "geo_coverage",
    detailKey: "geo_coverage",
    label: "Geographic Coverage (Geo. Cov.)",
    placeholder: "Select geographic coverage",
    optionsKey: "geo_coverage",
    evidence: {},
  },
  {
    field: "cons_or_wd",
    detailKey: "cons_or_wd",
    label: "Consistency / Worldwide Distribution (Cons. / WD)",
    placeholder: "Select coverage mode",
    optionsKey: "cons_or_wd",
    evidence: {},
  },
  {
    field: "financial_health",
    detailKey: "financial_health",
    label: "Financial Health",
    placeholder: "Select financial health",
    optionsKey: "financial_health",
    evidence: { file: true, validity: true, update: true },
  },
];

const OPERATIONAL_FIELDS: Array<{
  key: keyof EvaluationDetailsFormData;
  label: string;
  minRequirement: number;
}> = [
  { key: "management_system", label: "Management System", minRequirement: 78 },
  {
    key: "customer_communication",
    label: "Customer Communication",
    minRequirement: 75,
  },
  {
    key: "development_design",
    label: "Development / Design",
    minRequirement: 70,
  },
  {
    key: "production_manufacturing",
    label: "Production / Manufacturing",
    minRequirement: 70,
  },
  { key: "quality_audits", label: "Quality and Audits", minRequirement: 70 },
  {
    key: "suppliers_subcontractors",
    label: "Suppliers and Sub-Contractors",
    minRequirement: 70,
  },
  { key: "deliveries", label: "Deliveries", minRequirement: 75 },
  {
    key: "environment_ethic_rules",
    label: "Environment and Ethic Rules",
    minRequirement: 70,
  },
];

const IMPACT_QUESTIONS: Array<{
  key: keyof EvaluationDetailsFormData;
  label: string;
}> = [
  {
    key: "impact_question_1",
    label: "Add competitiveness to the group (cash, price, ...)",
  },
  {
    key: "impact_question_2",
    label: "Help in decreasing the Carbon Footprint",
  },
  {
    key: "impact_question_3",
    label: "Improve operational performances (PPM, OTD, support, etc...)",
  },
  {
    key: "impact_question_4",
    label:
      "Reduce the risk of limited supply from a monopolistic supplier or product",
  },
  {
    key: "impact_question_5",
    label:
      "Be able to supply material or components not in the existing supplier base",
  },
  {
    key: "impact_question_6",
    label:
      "Offer a large number of product in the family / commodity to replace an existing supplier",
  },
];

const TONE_STYLES: Record<
  EvaluationSectionProps["tone"],
  {
    shell: string;
    icon: string;
    badge: string;
    accent: string;
  }
> = {
  amber: {
    shell:
      "border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(255,251,235,0.82))]",
    icon: "bg-amber-50 text-amber-600 ring-amber-100",
    badge: "bg-amber-100 text-amber-800",
    accent: "from-amber-400 via-orange-400 to-yellow-300",
  },
  blue: {
    shell:
      "border-blue-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(239,246,255,0.82))]",
    icon: "bg-blue-50 text-blue-600 ring-blue-100",
    badge: "bg-blue-100 text-blue-800",
    accent: "from-blue-500 via-sky-400 to-cyan-300",
  },
  emerald: {
    shell:
      "border-emerald-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(236,253,245,0.82))]",
    icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    badge: "bg-emerald-100 text-emerald-800",
    accent: "from-emerald-500 via-teal-400 to-cyan-300",
  },
  indigo: {
    shell:
      "border-indigo-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(238,242,255,0.82))]",
    icon: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    badge: "bg-indigo-100 text-indigo-800",
    accent: "from-indigo-500 via-violet-400 to-blue-300",
  },
};

const deriveClassValue = (score?: number) => {
  if (score === undefined || Number.isNaN(score)) return undefined;
  if (score >= 90) return 1;
  if (score >= 75) return 2;
  if (score >= 60) return 3;
  return 4;
};

const deriveOperationalGrade = (score?: number) => {
  if (score === undefined || Number.isNaN(score)) return undefined;
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  return "D";
};

const deriveFinancialEndDate = (selectedValue?: string, startDate?: string) => {
  if (!selectedValue || !startDate) return undefined;

  const years =
    selectedValue === "Good"
      ? 2
      : selectedValue === "To Monitor" || selectedValue === "At Risk"
        ? 1
        : 0;

  if (!years) return undefined;

  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return undefined;

  date.setFullYear(date.getFullYear() + years);
  return date.toISOString().slice(0, 10);
};

const clampScore = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const normalizeScoreInput = (rawValue: string) => {
  if (!rawValue.trim()) return undefined;

  const numericValue = Number(rawValue);
  if (Number.isNaN(numericValue)) return undefined;

  return clampScore(numericValue);
};

const parseStrategicMention = (value?: string) => {
  if (!value || !value.trim()) return ["none"];

  const items = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return items.length > 0 ? items : ["none"];
};

const stringifyStrategicMention = (values: string[]) => {
  const filtered = values.filter(Boolean);
  if (filtered.length === 0) return "none";
  if (filtered.includes("none")) return "none";
  return STRATEGIC_MENTION_OPTIONS.filter((option) =>
    filtered.includes(option.value),
  )
    .map((option) => option.value)
    .join(", ");
};

const getScoreTone = (score?: number) => {
  if (score === undefined) return "slate";
  if (score >= 80) return "emerald";
  if (score >= 60) return "amber";
  return "rose";
};

const ScoreBadge = ({ score }: { score?: number }) => {
  const tone = getScoreTone(score);

  const classes = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  }[tone];

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {score ?? "No score"}
    </span>
  );
};

const ProgressRing = ({
  value,
  label,
  sublabel,
}: {
  value: number;
  label: string;
  sublabel: string;
}) => {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampScore(value) / 100) * circumference;

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90">
        <circle
          cx="55"
          cy="55"
          r={radius}
          strokeWidth="10"
          className="fill-none stroke-slate-100"
        />
        <circle
          cx="55"
          cy="55"
          r={radius}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="fill-none stroke-blue-600 transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-2xl font-bold tracking-[-0.06em] text-slate-950">
            {label}
          </div>
          <div className="text-xs font-semibold text-slate-400">{sublabel}</div>
        </div>
      </div>
    </div>
  );
};

const MetricPanel = ({
  label,
  value,
  tone,
  note,
  icon,
}: {
  label: string;
  value: string;
  tone: "amber" | "blue" | "emerald" | "slate" | "indigo";
  note: string;
  icon: React.ReactNode;
}) => {
  const classes = {
    amber: "border-amber-200 bg-amber-50/80 text-amber-700",
    blue: "border-blue-200 bg-blue-50/80 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
    indigo: "border-indigo-200 bg-indigo-50/80 text-indigo-700",
    slate: "border-slate-200 bg-white text-slate-500",
  }[tone];

  return (
    <div
      className={`group rounded-[24px] border px-5 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)] ${classes}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em]">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-slate-950">
            {value}
          </p>
          <p className="mt-1 text-sm leading-5 text-slate-600">{note}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/80 text-current shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
};

const EvaluationSection: React.FC<EvaluationSectionProps> = ({
  title,
  subtitle,
  tone,
  icon,
  children,
}) => {
  const styles = TONE_STYLES[tone];

  return (
    <section
      className={`relative overflow-hidden rounded-[30px] border p-6 shadow-[0_20px_55px_rgba(15,23,42,0.07)] backdrop-blur-xl ${styles.shell}`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${styles.accent}`}
      />

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          <div
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1 ${styles.icon}`}
          >
            {icon}
          </div>
          <div>
            <h3 className="text-xl font-semibold tracking-[-0.04em] text-slate-950">
              {title}
            </h3>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
              {subtitle}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}
        >
          Live baseline
        </span>
      </div>

      {children}
    </section>
  );
};

export const EvaluationDetailsForm: React.FC<EvaluationDetailsFormProps> = ({
  data,
  errors = {},
  onChange,
  relationId,
  mode = "all",
  showHeader = true,
}) => {
  const [pldOptions, setPldOptions] =
    useState<PldOptionSet>(DEFAULT_PLD_OPTIONS);
  const [uploadingCriterion, setUploadingCriterion] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let active = true;

    const loadOptions = async () => {
      try {
        const response = await supplierAPI.getOnboardingOptions();

        if (!active || !response?.data) return;

        setPldOptions(response.data as PldOptionSet);
      } catch (error) {
        console.error("Failed to load onboarding options:", error);
      }
    };

    loadOptions();

    return () => {
      active = false;
    };
  }, []);

  const derivedImpactScore = calculateImpactScore([
    data.impact_question_1,
    data.impact_question_2,
    data.impact_question_3,
    data.impact_question_4,
    data.impact_question_5,
    data.impact_question_6,
  ]);

  const selectedClassScores = CLASS_CRITERIA.map((criterion) => {
    const value = data[criterion.field];
    return value ? SCORE_BY_VALUE[value] : undefined;
  }).filter((value): value is number => value !== undefined);

  const derivedClassScore =
    selectedClassScores.length > 0
      ? Number(
          (
            selectedClassScores.reduce((total, value) => total + value, 0) /
            selectedClassScores.length
          ).toFixed(2),
        )
      : undefined;

  const derivedClassValue = deriveClassValue(derivedClassScore);
  const selectedOperationalScores = OPERATIONAL_FIELDS.map((field) => {
    const value = data[field.key];
    return typeof value === "number" && !Number.isNaN(value)
      ? value
      : undefined;
  }).filter((value): value is number => value !== undefined);
  const derivedOperationalScore =
    selectedOperationalScores.length > 0
      ? Number(
          (
            selectedOperationalScores.reduce(
              (total, value) => total + value,
              0,
            ) / selectedOperationalScores.length
          ).toFixed(2),
        )
      : undefined;
  const derivedOperationalGrade = deriveOperationalGrade(
    derivedOperationalScore,
  );

  useEffect(() => {
    if (data.impact_score !== derivedImpactScore) {
      onChange("impact_score", derivedImpactScore);
    }
  }, [data.impact_score, derivedImpactScore, onChange]);

  useEffect(() => {
    if (data.class_score !== derivedClassScore) {
      onChange("class_score", derivedClassScore);
    }

    if (data.class_value !== derivedClassValue) {
      onChange("class_value", derivedClassValue);
    }
  }, [
    data.class_score,
    data.class_value,
    derivedClassScore,
    derivedClassValue,
    onChange,
  ]);

  useEffect(() => {
    if (data.operational_score !== derivedOperationalScore) {
      onChange("operational_score", derivedOperationalScore);
    }

    if (data.operational_grade !== derivedOperationalGrade) {
      onChange("operational_grade", derivedOperationalGrade);
    }
  }, [
    data.operational_grade,
    data.operational_score,
    derivedOperationalGrade,
    derivedOperationalScore,
    onChange,
  ]);

  const criteriaDetails = data.class_criteria_details || {};

  const updateCriterionDetail = (
    criterionKey: string,
    field: keyof ClassCriterionDetailFormData,
    value: any,
  ) => {
    const next = {
      ...criteriaDetails,
      [criterionKey]: {
        ...(criteriaDetails[criterionKey] || {}),
        [field]: value,
      },
    };

    onChange("class_criteria_details", next);
  };

  const updateFinancialHealthDates = (startDate?: string) => {
    const selectedValue = data.financial_health;
    const current = criteriaDetails.financial_health || {};
    const nextEndDate = deriveFinancialEndDate(selectedValue, startDate);

    const next = {
      ...criteriaDetails,
      financial_health: {
        ...current,
        validity_start_date: startDate,
        validity_end_date:
          current.auto_validity_end_date === false
            ? current.validity_end_date
            : nextEndDate,
        auto_validity_end_date: current.auto_validity_end_date ?? true,
      },
    };

    onChange("class_criteria_details", next);
  };

  const uploadCriterionDocument = async (
    criterionKey: string,
    criterionLabel: string,
    file?: File | null,
  ) => {
    if (!relationId || !file) return;

    setUploadingCriterion(criterionKey);

    try {
      const response = await supplierAPI.uploadRelationCriterionDocument(
        relationId,
        criterionKey,
        file,
        `Evidence uploaded for ${criterionLabel}.`,
      );

      const uploaded = response.data;

      const next = {
        ...criteriaDetails,
        [criterionKey]: {
          ...(criteriaDetails[criterionKey] || {}),
          document_id: uploaded.document_id,
          document_name: uploaded.original_file_name || uploaded.document_name,
          document_url: uploaded.file_url,
          document_mime_type: uploaded.mime_type,
          document_size:
            uploaded.file_size !== undefined && uploaded.file_size !== null
              ? Number(uploaded.file_size)
              : undefined,
          evidence_file_name:
            uploaded.original_file_name || uploaded.document_name,
        },
      };

      onChange("class_criteria_details", next);
    } catch (error) {
      console.error("Failed to upload criterion document:", error);
    } finally {
      setUploadingCriterion(null);
    }
  };

  const deleteCriterionDocument = async (criterionKey: string) => {
    if (!relationId) return;
    setUploadingCriterion(criterionKey);
    try {
      await supplierAPI.deleteRelationCriterionDocument(
        relationId,
        criterionKey,
      );
      const next = {
        ...criteriaDetails,
        [criterionKey]: {
          ...(criteriaDetails[criterionKey] || {}),
          document_id: undefined,
          document_name: undefined,
          document_url: undefined,
          document_mime_type: undefined,
          document_size: undefined,
          evidence_file_name: undefined,
        },
      };
      onChange("class_criteria_details", next);
    } catch (error) {
      console.error("Failed to delete criterion document:", error);
    } finally {
      setUploadingCriterion(null);
    }
  };

  const completedClassCriteria = CLASS_CRITERIA.filter((criterion) =>
    (data[criterion.field] as string | undefined)?.trim(),
  ).length;

  const completedOperationalCriteria = OPERATIONAL_FIELDS.filter(
    (field) => data[field.key] !== undefined && data[field.key] !== null,
  ).length;

  const completedImpactQuestions = IMPACT_QUESTIONS.filter((field) =>
    (data[field.key] as string | undefined)?.trim(),
  ).length;

  const finalGradePreview =
    derivedOperationalGrade && derivedClassValue
      ? `${derivedOperationalGrade}${derivedClassValue}`
      : "Pending";

  const showClassSection = mode === "all" || mode === "class";
  const showOperationalSection = mode === "all" || mode === "operational";
  const showImpactDecisionSection =
    mode === "all" || mode === "impact-decision";

  const strategicMentionValues = useMemo(
    () => parseStrategicMention(data.strategic_mention),
    [data.strategic_mention],
  );

  const completionScore = useMemo(() => {
    const total =
      CLASS_CRITERIA.length +
      OPERATIONAL_FIELDS.length +
      IMPACT_QUESTIONS.length;

    const completed =
      completedClassCriteria +
      completedOperationalCriteria +
      completedImpactQuestions;

    return Math.round((completed / total) * 100);
  }, [
    completedClassCriteria,
    completedOperationalCriteria,
    completedImpactQuestions,
  ]);

  const toggleStrategicMention = (value: string) => {
    const current = parseStrategicMention(data.strategic_mention);

    if (value === "none") {
      onChange("strategic_mention", "none");
      return;
    }

    const withoutNone = current.filter((item) => item !== "none");
    const next = withoutNone.includes(value)
      ? withoutNone.filter((item) => item !== value)
      : [...withoutNone, value];

    onChange("strategic_mention", stringifyStrategicMention(next));
  };

  return (
    <div className="space-y-8">
      {showHeader && (
        <>
          <section className="relative overflow-hidden rounded-[34px] border border-white/50 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.32),transparent_28%),linear-gradient(135deg,#0b3b75_0%,#0f5ccc_58%,#1685e8_100%)] p-7 text-white shadow-[0_30px_80px_rgba(15,82,186,0.22)]">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 right-0 h-28 w-[420px] opacity-25">
              <div className="absolute bottom-0 right-8 flex items-end gap-3">
                {[36, 52, 76, 92, 118, 140].map((height, index) => (
                  <div
                    key={index}
                    className="w-5 rounded-t-xl bg-white/60"
                    style={{ height }}
                  />
                ))}
              </div>
            </div>

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-5">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/15 shadow-lg backdrop-blur">
                  <ClipboardCheck className="h-7 w-7" />
                </div>

                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-50">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Evaluation workspace
                  </div>

                  <h2 className="mt-4 text-3xl font-semibold tracking-[-0.06em]">
                    Evaluation Baseline
                  </h2>

                  <p className="mt-2 max-w-4xl text-sm leading-6 text-blue-50/85">
                    Capture class evaluation, operational self-assessment,
                    impact, evidence documents, and governance decisions in one
                    guided cockpit.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5 rounded-[28px] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <ProgressRing
                  value={completionScore}
                  label={`${completionScore}%`}
                  sublabel="Complete"
                />

                <div className="space-y-2 text-sm text-blue-50/90">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    Class: {completedClassCriteria}/11
                  </div>
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-blue-200" />
                    Operational: {completedOperationalCriteria}/8
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-emerald-200" />
                    Impact: {completedImpactQuestions}/6
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricPanel
              label="Class Criteria"
              value={`${completedClassCriteria}/11`}
              tone="amber"
              note="Selections completed"
              icon={<Layers3 className="h-5 w-5" />}
            />

            <MetricPanel
              label="Operational"
              value={`${completedOperationalCriteria}/8`}
              tone="blue"
              note="Scores captured"
              icon={<Gauge className="h-5 w-5" />}
            />

            <MetricPanel
              label="Impact"
              value={`${completedImpactQuestions}/6`}
              tone="emerald"
              note="Questions answered"
              icon={<Target className="h-5 w-5" />}
            />

            <MetricPanel
              label="Final Grade"
              value={finalGradePreview}
              tone="indigo"
              note="Operational grade + class"
              icon={<Sparkles className="h-5 w-5" />}
            />
          </div>
        </>
      )}

      {showClassSection && (
        <EvaluationSection
          title="Class Evaluation"
          subtitle="The 11 class criteria are scored automatically. Users provide business facts and evidence while the system computes the class score."
          tone="amber"
          icon={<BarChart3 className="h-6 w-6" />}
        >
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_260px]">
            <div className="rounded-[24px] border border-amber-200 bg-white/80 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                Computed Class Score
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-slate-950">
                {derivedClassScore ?? "-"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Average score from selected criteria.
              </p>
            </div>

            <div className="rounded-[24px] border border-amber-200 bg-white/80 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                Computed Class
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-slate-950">
                {derivedClassValue ?? "-"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Mapping: 90+ = 1, 75+ = 2, 60+ = 3.
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white/80 p-5 shadow-sm">
              <ProgressRing
                value={derivedClassScore ?? 0}
                label={
                  derivedClassScore ? `${Math.round(derivedClassScore)}%` : "-"
                }
                sublabel="Class"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {CLASS_CRITERIA.map((criterion, index) => {
              const detail = criteriaDetails[criterion.detailKey] || {};
              const selectedValue = data[criterion.field] || "";
              const selectedScore = selectedValue
                ? SCORE_BY_VALUE[selectedValue]
                : undefined;

              const financialEndDate =
                criterion.detailKey === "financial_health"
                  ? deriveFinancialEndDate(
                      selectedValue,
                      detail.validity_start_date,
                    )
                  : undefined;

              return (
                <div
                  key={criterion.detailKey}
                  className="group relative overflow-hidden rounded-[28px] border border-amber-200/70 bg-white/90 p-5 shadow-[0_18px_45px_rgba(148,91,17,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(148,91,17,0.14)]"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300" />

                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-sm font-bold text-amber-700 ring-1 ring-amber-100">
                        {index + 1}
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold tracking-wide text-slate-950">
                          {criterion.label}
                        </h4>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Select the business rule and attach evidence when
                          required.
                        </p>
                      </div>
                    </div>

                    <ScoreBadge score={selectedScore} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormSelect
                      label={criterion.label}
                      name={criterion.field}
                      value={selectedValue}
                      onChange={(e) =>
                        onChange(criterion.field, e.target.value)
                      }
                      options={pldOptions[criterion.optionsKey] || []}
                      placeholder={criterion.placeholder}
                      error={errors[criterion.field]}
                    />

                    <FormInput
                      label="Criterion Score"
                      name={`${criterion.detailKey}_score`}
                      type="number"
                      value={selectedScore ?? detail.score ?? ""}
                      onChange={() => undefined}
                      readOnly
                      helperText="Resolved automatically from the selected criterion value."
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {criterion.evidence.file && (
                      <div className="form-group md:col-span-2">
                        <label className="form-label">Evidence Document</label>
                        <div className="rounded-[22px] border border-dashed border-amber-300 bg-amber-50/60 p-4">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="flex gap-3">
                              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-amber-700 shadow-sm">
                                <FileUp className="h-5 w-5" />
                              </div>

                              <div>
                                <div className="text-sm font-semibold text-slate-950">
                                  {detail.document_name ||
                                    "No supporting file uploaded"}
                                </div>

                                <div className="mt-1 text-xs leading-5 text-slate-500">
                                  {relationId
                                    ? "PDF, Word, Excel, or image. Stored in Azure blob storage."
                                    : "Document upload becomes available once the supplier relation exists."}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {detail.document_url && (
                                <a
                                  href={detail.document_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm hover:bg-amber-100"
                                >
                                  Open Uploaded Document
                                </a>
                              )}

                              <label
                                className={`inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm ${
                                  relationId
                                    ? "cursor-pointer hover:bg-amber-100"
                                    : "cursor-not-allowed opacity-70"
                                }`}
                              >
                                {uploadingCriterion === criterion.detailKey
                                  ? "Uploading..."
                                  : detail.document_url
                                    ? "Add Another File"
                                    : "Choose File"}
                                <input
                                  type="file"
                                  className="hidden"
                                  disabled={!relationId}
                                  onChange={(event) =>
                                    uploadCriterionDocument(
                                      criterion.detailKey,
                                      criterion.label,
                                      event.target.files?.[0] || null,
                                    )
                                  }
                                />
                              </label>

                              {detail.document_url && (
                                <button
                                  type="button"
                                  disabled={
                                    uploadingCriterion === criterion.detailKey
                                  }
                                  onClick={() =>
                                    deleteCriterionDocument(criterion.detailKey)
                                  }
                                  className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-60"
                                >
                                  Delete File
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {criterion.evidence.signature && (
                      <FormInput
                        label="Signature Date"
                        name={`${criterion.detailKey}_signature_date`}
                        type="date"
                        value={detail.signature_date || ""}
                        onChange={(e) =>
                          updateCriterionDetail(
                            criterion.detailKey,
                            "signature_date",
                            e.target.value || undefined,
                          )
                        }
                      />
                    )}

                    {criterion.evidence.validity && (
                      <FormInput
                        label="Validity Start Date"
                        name={`${criterion.detailKey}_validity_start_date`}
                        type="date"
                        value={detail.validity_start_date || ""}
                        onChange={(e) => {
                          const nextValue = e.target.value || undefined;

                          if (criterion.detailKey === "financial_health") {
                            updateFinancialHealthDates(nextValue);
                            return;
                          }

                          updateCriterionDetail(
                            criterion.detailKey,
                            "validity_start_date",
                            nextValue,
                          );
                        }}
                      />
                    )}

                    {criterion.evidence.validity && (
                      <FormInput
                        label={
                          criterion.detailKey === "financial_health"
                            ? "Next Supplier Survey Due"
                            : "Validity End Date"
                        }
                        name={`${criterion.detailKey}_validity_end_date`}
                        type="date"
                        value={
                          detail.validity_end_date || financialEndDate || ""
                        }
                        onChange={(e) =>
                          updateCriterionDetail(
                            criterion.detailKey,
                            "validity_end_date",
                            e.target.value || undefined,
                          )
                        }
                        helperText={
                          criterion.detailKey === "financial_health"
                            ? "Good defaults to 2 years; To Monitor and At Risk default to 1 year from the start date. You can still override it."
                            : undefined
                        }
                      />
                    )}

                    {criterion.evidence.update && (
                      <FormInput
                        label="Last Update Date"
                        name={`${criterion.detailKey}_last_update_date`}
                        type="date"
                        value={detail.last_update_date || ""}
                        onChange={(e) =>
                          updateCriterionDetail(
                            criterion.detailKey,
                            "last_update_date",
                            e.target.value || undefined,
                          )
                        }
                      />
                    )}

                    {criterion.evidence.amount && (
                      <FormInput
                        label="Amount Value"
                        name={`${criterion.detailKey}_amount_value`}
                        type="number"
                        value={detail.amount_value ?? ""}
                        onChange={(e) =>
                          updateCriterionDetail(
                            criterion.detailKey,
                            "amount_value",
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                      />
                    )}

                    {criterion.evidence.amount && (
                      <FormInput
                        label="Currency"
                        name={`${criterion.detailKey}_amount_currency`}
                        value={detail.amount_currency || "USD"}
                        onChange={(e) =>
                          updateCriterionDetail(
                            criterion.detailKey,
                            "amount_currency",
                            e.target.value,
                          )
                        }
                        placeholder="USD"
                      />
                    )}
                  </div>

                  <div className="mt-5">
                    <FormTextarea
                      label="Criterion Comment / Reason"
                      name={`${criterion.detailKey}_comments`}
                      value={detail.comments || ""}
                      onChange={(e) =>
                        updateCriterionDetail(
                          criterion.detailKey,
                          "comments",
                          e.target.value,
                        )
                      }
                      placeholder="Capture the supporting reason, scope notes, or validity context."
                      rows={3}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </EvaluationSection>
      )}

      {showOperationalSection && (
        <EvaluationSection
          title="Operational Self-Assessment"
          subtitle="Capture the initial theoretical operational baseline. KPI cycles can later replace this with measured performance."
          tone="blue"
          icon={<Gauge className="h-6 w-6" />}
        >
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-blue-200 bg-white/80 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                Operational Score
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-slate-950">
                {derivedOperationalScore ?? "-"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Average operational baseline.
              </p>
            </div>

            <div className="rounded-[24px] border border-blue-200 bg-white/80 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                Operational Grade
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-slate-950">
                {derivedOperationalGrade || "-"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                A to D grading result.
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white/80 p-5 shadow-sm">
              <ProgressRing
                value={Number(derivedOperationalScore ?? 0)}
                label={
                  derivedOperationalScore ? `${derivedOperationalScore}` : "-"
                }
                sublabel="Ops"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {OPERATIONAL_FIELDS.map((field) => {
              const value = data[field.key] as number | undefined;
              const isBelowRequirement =
                value !== undefined && value < field.minRequirement;

              return (
                <div
                  key={String(field.key)}
                  className={`rounded-[22px] border bg-white/85 p-4 shadow-sm transition ${
                    isBelowRequirement
                      ? "border-rose-200"
                      : "border-slate-200 hover:border-blue-200"
                  }`}
                >
                  <FormInput
                    label={`${field.label} (Min. ${field.minRequirement})`}
                    name={String(field.key)}
                    type="number"
                    value={value ?? ""}
                    onChange={(e) =>
                      onChange(field.key, normalizeScoreInput(e.target.value))
                    }
                    placeholder="0 - 100"
                    error={errors[String(field.key)]}
                    min={0}
                    max={100}
                    step={1}
                    inputMode="numeric"
                    helperText="Enter a score from 0 to 100."
                  />

                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${
                        isBelowRequirement ? "bg-rose-500" : "bg-blue-600"
                      }`}
                      style={{ width: `${clampScore(value)}%` }}
                    />
                  </div>

                  {isBelowRequirement && (
                    <div className="mt-3 flex items-center gap-2 text-xs font-medium text-rose-600">
                      <AlertCircle className="h-4 w-4" />
                      Below minimum requirement
                    </div>
                  )}
                </div>
              );
            })}

            <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                label="Operational Score"
                name="operational_score"
                type="number"
                value={derivedOperationalScore ?? ""}
                onChange={() => undefined}
                placeholder="Average operational score"
                error={errors.operational_score}
                readOnly
                helperText="Calculated automatically from the 8 operational criteria."
              />

              <FormSelect
                label="Operational Grade"
                name="operational_grade"
                value={derivedOperationalGrade || ""}
                onChange={() => undefined}
                options={[
                  { value: "A", label: "A" },
                  { value: "B", label: "B" },
                  { value: "C", label: "C" },
                  { value: "D", label: "D" },
                ]}
                placeholder="Select A-D"
                error={errors.operational_grade}
                disabled
              />
            </div>
          </div>
        </EvaluationSection>
      )}

      {showImpactDecisionSection && (
        <>
          <EvaluationSection
            title="Supplier Impact"
            subtitle="Answer the six impact questions to calculate the supplier impact score used in onboarding governance."
            tone="emerald"
            icon={<Target className="h-6 w-6" />}
          >
            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="rounded-[24px] border border-emerald-200 bg-white/80 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                    <TrendingUp className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Impact score is calculated automatically
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      The score updates whenever an impact question changes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-emerald-200 bg-white/80 p-5 shadow-sm">
                <ProgressRing
                  value={derivedImpactScore}
                  label={`${derivedImpactScore}`}
                  sublabel="Impact"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {IMPACT_QUESTIONS.map((question, index) => (
                <div
                  key={String(question.key)}
                  className="rounded-[22px] border border-emerald-200 bg-white/85 p-4 shadow-sm transition hover:border-emerald-300"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                      Impact question
                    </span>
                  </div>

                  <FormSelect
                    label={question.label}
                    name={String(question.key)}
                    value={(data[question.key] as string) || ""}
                    onChange={(e) => onChange(question.key, e.target.value)}
                    options={IMPACT_RESULT_OPTIONS}
                    placeholder="Select impact result"
                    error={errors[String(question.key)]}
                  />
                </div>
              ))}

              <div className="md:col-span-2">
                <FormInput
                  label="Impact Score"
                  name="impact_score"
                  type="number"
                  value={derivedImpactScore}
                  onChange={() => undefined}
                  readOnly
                />
              </div>
            </div>
          </EvaluationSection>

          <EvaluationSection
            title="Decision & Governance"
            subtitle="Capture the evaluation date, strategic mention, panel status, and reason for the decision."
            tone="indigo"
            icon={<ShieldCheck className="h-6 w-6" />}
          >
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <div className="space-y-5">
                <div className="rounded-[24px] border border-indigo-200 bg-white/88 p-5 shadow-[0_16px_40px_rgba(67,56,202,0.08)]">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
                        Evaluation Metadata
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Record the official timing and governance classification.
                      </p>
                    </div>
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                  </div>

                  <FormInput
                    label="Evaluation Date"
                    name="evaluation_date"
                    type="date"
                    value={data.evaluation_date || ""}
                    onChange={(e) => onChange("evaluation_date", e.target.value)}
                  />

                  <div className="mt-4">
                    <FormSelect
                      label="Evaluation Change Type"
                      name="cycle_type"
                      value={data.cycle_type || "Criteria Change Review"}
                      onChange={(e) => onChange("cycle_type", e.target.value)}
                      options={EVALUATION_CHANGE_TYPE_OPTIONS}
                      placeholder="Select evaluation change type"
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm leading-6 text-indigo-950">
                    When a class criterion changes, save the new evaluation date,
                    choose the change type, and explain the reason below. The
                    backend will recalculate the class score, final grade, next
                    cycle timing, and supplier status automatically.
                  </div>
                </div>

                <div className="rounded-[24px] border border-indigo-200 bg-white/88 p-5 shadow-[0_16px_40px_rgba(67,56,202,0.08)]">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
                        Strategic Mention
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Select one or more strategic qualifiers for this supplier relation.
                      </p>
                    </div>
                    <div className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                      Multi-choice
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {STRATEGIC_MENTION_OPTIONS.map((option) => {
                      const selected = strategicMentionValues.includes(option.value);
                      const helperText =
                        option.value === "none"
                          ? "Use when no strategic flag applies."
                          : `${option.label} classification applies to this relation.`;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggleStrategicMention(option.value)}
                          className={`group rounded-[20px] border p-4 text-left transition-all duration-200 ${
                            selected
                              ? "border-indigo-400 bg-[linear-gradient(180deg,rgba(238,242,255,0.95),rgba(224,231,255,0.92))] shadow-[0_14px_30px_rgba(79,70,229,0.14)]"
                              : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                                selected
                                  ? "border-indigo-500 bg-indigo-600 text-white"
                                  : "border-slate-300 bg-white text-transparent group-hover:border-indigo-300"
                              }`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-950">
                                {option.label}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-slate-500">
                                {helperText}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {errors.strategic_mention && (
                    <p className="mt-3 text-sm font-medium text-rose-600">
                      {errors.strategic_mention}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-[24px] border border-indigo-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(244,244,255,0.92))] p-5 shadow-[0_18px_45px_rgba(67,56,202,0.10)]">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
                        Governance Decision
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Record panel outcome and supporting rationale.
                      </p>
                    </div>
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                  </div>

                  <FormSelect
                    label="Supplier Panel Status"
                    name="panel_decision"
                    value={data.panel_decision || ""}
                    onChange={(e) => onChange("panel_decision", e.target.value)}
                    options={PANEL_DECISION_OPTIONS}
                    placeholder="Select panel decision"
                    error={errors.panel_decision}
                  />

                  <div className="mt-5">
                    <FormTextarea
                      label="Comments / Why"
                      name="comments"
                      value={data.comments || ""}
                      onChange={(e) => onChange("comments", e.target.value)}
                      placeholder="Explain why this evaluation or panel decision is being recorded."
                      rows={5}
                    />
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white/88 p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Selected Governance Tags
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {strategicMentionValues.map((value) => {
                      const matched = STRATEGIC_MENTION_OPTIONS.find(
                        (option) => option.value === value,
                      );
                      return (
                        <span
                          key={value}
                          className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
                        >
                          {matched?.label || value}
                        </span>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Evaluation Snapshot
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500">Final grade preview</p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">
                          {finalGradePreview}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Impact score</p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">
                          {derivedImpactScore}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </EvaluationSection>
        </>
      )}
    </div>
  );
};
