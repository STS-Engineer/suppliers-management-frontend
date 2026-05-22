import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { EvaluationDetailsForm } from "../components/onboarding/EvaluationDetailsForm";
import { InlineAlert } from "../components/UI";
import { supplierAPI } from "../services/supplierOnboardingAPI";
import {
  AvocarbonSite,
  EvaluationDetailsFormData,
  SupplierSiteRelation,
  SupplierStatusHistoryEntry,
} from "../types/onboarding";

const INITIAL_DATA: EvaluationDetailsFormData = {
  strategic_mention: "none",
  evaluation_date: new Date().toISOString().slice(0, 10),
  cycle_type: "Criteria Change Review",
  class_criteria_details: {},
};

const TABS = [
  { id: "class", label: "Class Criteria" },
  { id: "operational", label: "Operational" },
  { id: "decision", label: "Decision & Log" },
] as const;

type EvaluationTab = (typeof TABS)[number]["id"];

export default function RelationEvaluationPage() {
  const { relationId } = useParams<{ relationId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<EvaluationTab>("class");
  const [form, setForm] = useState<EvaluationDetailsFormData>(INITIAL_DATA);
  const [relation, setRelation] = useState<SupplierSiteRelation | null>(null);
  const [siteName, setSiteName] = useState<string>("");
  const [statusHistory, setStatusHistory] = useState<
    SupplierStatusHistoryEntry[]
  >([]);
  const [computedSupplierStatus, setComputedSupplierStatus] =
    useState<string>("");
  const [effectiveSupplierStatus, setEffectiveSupplierStatus] =
    useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<EvaluationTab | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const relationIdValue = Number(relationId);

  const loadWorkspace = useCallback(async () => {
    if (!relationIdValue) {
      setError("Invalid relation ID.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [workspaceResponse, sitesResponse] = await Promise.all([
        supplierAPI.getRelationEvaluationWorkspace(relationIdValue),
        supplierAPI.listSites(),
      ]);

      const workspace = workspaceResponse.data as EvaluationDetailsFormData & {
        relation: SupplierSiteRelation;
        evaluation_date?: string;
        status_history?: SupplierStatusHistoryEntry[];
        computed_supplier_status?: string | null;
        effective_supplier_status?: string | null;
      };
      const loadedRelation = workspace.relation;
      const sites = (
        Array.isArray(sitesResponse.data) ? sitesResponse.data : []
      ) as AvocarbonSite[];
      const resolvedSite =
        sites.find((site) => site.id_site === loadedRelation.id_site) || null;

      setRelation(loadedRelation);
      setSiteName(
        resolvedSite?.site_name || `Avocarbon Site #${loadedRelation.id_site}`,
      );
      setStatusHistory(workspace.status_history || []);
      setComputedSupplierStatus(workspace.computed_supplier_status || "");
      setEffectiveSupplierStatus(
        workspace.effective_supplier_status ||
          loadedRelation.supplier_status ||
          workspace.computed_supplier_status ||
          "",
      );
      setForm({
        evaluation_date:
          workspace.evaluation_date ||
          loadedRelation.last_evaluation_date ||
          new Date().toISOString().slice(0, 10),
        cycle_type: "Criteria Change Review",
        strategic_mention: workspace.strategic_mention || "none",
        class_value: workspace.class_value ?? undefined,
        class_score:
          workspace.class_score !== undefined && workspace.class_score !== null
            ? Number(workspace.class_score)
            : undefined,
        operational_grade: workspace.operational_grade ?? undefined,
        operational_score:
          workspace.operational_score !== undefined &&
          workspace.operational_score !== null
            ? Number(workspace.operational_score)
            : undefined,
        impact_score: workspace.impact_score ?? undefined,
        panel_decision: workspace.panel_decision ?? undefined,
        comments: workspace.comments ?? "",
        top: workspace.top ?? "",
        lta: workspace.lta ?? "",
        sqma: workspace.sqma ?? "",
        quality_certification: workspace.quality_certification ?? "",
        family_coverage: workspace.family_coverage ?? "",
        competitiveness: workspace.competitiveness ?? "",
        geo_coverage: workspace.geo_coverage ?? "",
        cons_or_wd: workspace.cons_or_wd ?? "",
        financial_health: workspace.financial_health ?? "",
        prod_lia_ins: workspace.prod_lia_ins ?? "",
        prod: workspace.prod ?? "",
        class_criteria_details: workspace.class_criteria_details ?? {},
        management_system:
          workspace.management_system !== undefined &&
          workspace.management_system !== null
            ? Number(workspace.management_system)
            : undefined,
        customer_communication:
          workspace.customer_communication !== undefined &&
          workspace.customer_communication !== null
            ? Number(workspace.customer_communication)
            : undefined,
        development_design:
          workspace.development_design !== undefined &&
          workspace.development_design !== null
            ? Number(workspace.development_design)
            : undefined,
        production_manufacturing:
          workspace.production_manufacturing !== undefined &&
          workspace.production_manufacturing !== null
            ? Number(workspace.production_manufacturing)
            : undefined,
        quality_audits:
          workspace.quality_audits !== undefined &&
          workspace.quality_audits !== null
            ? Number(workspace.quality_audits)
            : undefined,
        suppliers_subcontractors:
          workspace.suppliers_subcontractors !== undefined &&
          workspace.suppliers_subcontractors !== null
            ? Number(workspace.suppliers_subcontractors)
            : undefined,
        deliveries:
          workspace.deliveries !== undefined && workspace.deliveries !== null
            ? Number(workspace.deliveries)
            : undefined,
        environment_ethic_rules:
          workspace.environment_ethic_rules !== undefined &&
          workspace.environment_ethic_rules !== null
            ? Number(workspace.environment_ethic_rules)
            : undefined,
        impact_question_1: workspace.impact_question_1 ?? "",
        impact_question_2: workspace.impact_question_2 ?? "",
        impact_question_3: workspace.impact_question_3 ?? "",
        impact_question_4: workspace.impact_question_4 ?? "",
        impact_question_5: workspace.impact_question_5 ?? "",
        impact_question_6: workspace.impact_question_6 ?? "",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load relation evaluation workspace",
      );
    } finally {
      setIsLoading(false);
    }
  }, [relationIdValue]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const relationStateLabel = useMemo(() => {
    if (!relation) return "";
    if (relation.last_evaluation_date) {
      return `Last evaluated on ${new Date(
        relation.last_evaluation_date,
      ).toLocaleDateString("en-GB")}`;
    }
    return "Initial evaluation pending";
  }, [relation]);

  const setField = (field: keyof EvaluationDetailsFormData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };
  const normalizeStrategicMention = (value?: string) => {
    const allowed = ["directed", "monopolistic", "none", "strategic"];

    if (!value) return "none";

    const firstValue = value
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .find((v) => allowed.includes(v));

    return firstValue || "none";
  };
  const buildClassPayload = () => ({
    evaluation_date: form.evaluation_date || undefined,
    cycle_type: form.cycle_type || "Criteria Change Review",
    top: form.top,
    lta: form.lta,
    quality_certification: form.quality_certification,
    productivity: form.prod,
    prod_lia_ins: form.prod_lia_ins,
    competitiveness: form.competitiveness,
    sqma: form.sqma,
    family_coverage: form.family_coverage,
    geo_coverage: form.geo_coverage,
    cons_or_wd: form.cons_or_wd,
    financial_health: form.financial_health,
    class_criteria_details: form.class_criteria_details,
    class_score: form.class_score,
    class_value: form.class_value,
    impact_score: form.impact_score,
    impact_question_1: form.impact_question_1,
    impact_question_2: form.impact_question_2,
    impact_question_3: form.impact_question_3,
    impact_question_4: form.impact_question_4,
    impact_question_5: form.impact_question_5,
    impact_question_6: form.impact_question_6,
    strategic_mention: normalizeStrategicMention(form.strategic_mention),
    panel_decision: form.panel_decision,
    comments: form.comments,
  });

  const buildOperationalPayload = () => ({
    evaluation_date: form.evaluation_date || undefined,
    management_system: form.management_system,
    customer_communication: form.customer_communication,
    development_design: form.development_design,
    production_manufacturing: form.production_manufacturing,
    quality_audits: form.quality_audits,
    suppliers_subcontractors: form.suppliers_subcontractors,
    deliveries: form.deliveries,
    environment_ethic_rules: form.environment_ethic_rules,
    operational_score: form.operational_score,
    operational_grade: form.operational_grade,
    comments: form.comments,
    source_type: "self_assessment",
  });

  const saveSection = async (section: EvaluationTab) => {
    if (!relation) return;

    setSavingSection(section);
    setError(null);

    try {
      if (!relation.last_evaluation_date) {
        await supplierAPI.createInitialRelationEvaluation(
          relation.id_relation,
          {
            ...form,
            strategic_mention: normalizeStrategicMention(
              form.strategic_mention,
            ),
          },
        );
      } else if (section === "operational") {
        await supplierAPI.updateRelationOperationalEvaluation(
          relation.id_relation,
          buildOperationalPayload(),
        );
      } else {
        await supplierAPI.updateRelationClassEvaluation(
          relation.id_relation,
          buildClassPayload(),
        );
      }

      await loadWorkspace();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save relation evaluation",
      );
    } finally {
      setSavingSection(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Loading relation evaluation workspace...
      </div>
    );
  }

  if (!relation) {
    return (
      <div className="space-y-4 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-xl font-semibold">Relation not found</h1>
        <p className="text-sm">
          The selected supplier relation could not be loaded.
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-100"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.24),transparent_35%),linear-gradient(135deg,#081525,#0f2744_45%,#153b63)] px-6 py-6 text-white shadow-[0_28px_70px_rgba(8,21,37,0.28)]">
        <div className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-44 w-44 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-200">
              Relation Evaluation
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              {relation.relation_code ||
                `REL-${String(relation.id_relation).padStart(6, "0")}`}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
              Update the scorecard for this supplier relation at{" "}
              <span className="font-semibold text-white">{siteName}</span>. You
              can move between tabs and save each section independently.
            </p>
            <div className="mt-4 inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 backdrop-blur-sm">
              Premium evaluation workspace with evidence tracking and
              section-level saves
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Back to Management
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Relation Code"
            value={
              relation.relation_code ||
              `REL-${String(relation.id_relation).padStart(6, "0")}`
            }
          />
          <MetricCard
            label="Unit"
            value={
              relation.unit_code ||
              `UNT-${String(relation.id_supplier_unit).padStart(6, "0")}`
            }
          />
          <MetricCard label="Plant" value={siteName} />
          <MetricCard
            label="Current Grade"
            value={relation.final_grade || "Pending"}
          />
          <MetricCard
            label="Supplier Status"
            value={effectiveSupplierStatus || relationStateLabel}
          />
        </div>
      </div>

      {error && (
        <InlineAlert
          title="Evaluation workspace unavailable"
          message={error}
          action={
            <button
              type="button"
              onClick={loadWorkspace}
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100"
            >
              Retry
            </button>
          }
        />
      )}

      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Document uploads and other evidence-detail updates do not create a new
        evaluation cycle by themselves. A new cycle is created when the scored
        evaluation inputs or decision-driving answers change.
      </div>

      <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50/90 p-2">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-[linear-gradient(135deg,#0f2744,#1d4f7a)] text-white shadow-[0_14px_28px_rgba(15,39,68,0.24)]"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "class" && (
          <div className="space-y-5">
            <EvaluationDetailsForm
              data={form}
              onChange={setField}
              relationId={relation.id_relation}
              errors={{}}
              mode="class"
              showHeader={false}
            />
            <SectionFooter
              text="Save only the class criteria section. This updates the class-side evaluation fields without forcing a step-by-step flow."
              isSaving={savingSection === "class"}
              onCancel={() => navigate(-1)}
              onSave={() => saveSection("class")}
              saveLabel={
                relation.last_evaluation_date
                  ? "Update Class Criteria"
                  : "Save Initial Evaluation"
              }
            />
          </div>
        )}

        {activeTab === "operational" && (
          <div className="space-y-5">
            <EvaluationDetailsForm
              data={form}
              onChange={setField}
              relationId={relation.id_relation}
              errors={{}}
              mode="operational"
              showHeader={false}
            />
            <SectionFooter
              text="Save only the operational section. Use this when the 8 operational criteria change."
              isSaving={savingSection === "operational"}
              onCancel={() => navigate(-1)}
              onSave={() => saveSection("operational")}
              saveLabel={
                relation.last_evaluation_date
                  ? "Update Operational Section"
                  : "Save Initial Evaluation"
              }
            />
          </div>
        )}

        {activeTab === "decision" && (
          <div className="space-y-5">
            <EvaluationDetailsForm
              data={form}
              onChange={setField}
              relationId={relation.id_relation}
              errors={{}}
              mode="impact-decision"
              showHeader={false}
            />

            <div className="grid gap-4 lg:grid-cols-3">
              <StatusCard
                label="Computed Status"
                value={computedSupplierStatus || "Pending"}
                tone={resolveStatusTone(computedSupplierStatus)}
                note="Calculated automatically from the final grade."
              />
              <StatusCard
                label="Current Status"
                value={effectiveSupplierStatus || "Pending"}
                tone={resolveStatusTone(effectiveSupplierStatus)}
                note="Use onboarding management to request a manual override."
              />
              <StatusCard
                label="Final Grade"
                value={relation.final_grade || "Pending"}
                tone="slate"
                note="Combined operational grade and class value."
              />
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc,#f1f5f9)] p-5 shadow-inner">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Supplier Status Log
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Track when the supplier status, class, grade, or panel
                    decision changed and why.
                  </p>
                </div>
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                  {statusHistory.length} change
                  {statusHistory.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {statusHistory.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
                    No status history recorded yet.
                  </div>
                ) : (
                  statusHistory.map((entry) => (
                    <div
                      key={entry.id_history}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm font-semibold text-slate-900">
                          {formatHistoryReason(entry.change_reason) ||
                            "Status update"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatDateTime(entry.changed_at || entry.created_at)}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Changed by: {entry.changed_by || "SYSTEM"}
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                        <HistoryField
                          label="Class"
                          from={entry.old_class}
                          to={entry.new_class}
                        />
                        <HistoryField
                          label="Grade"
                          from={entry.old_grade}
                          to={entry.new_grade}
                        />
                        <HistoryField
                          label="Final Grade"
                          from={entry.old_final_grade}
                          to={entry.new_final_grade}
                        />
                        <HistoryField
                          label="Panel Decision"
                          from={entry.old_panel_decision}
                          to={entry.new_panel_decision}
                        />
                        <HistoryField
                          label="Strategic Mention"
                          from={entry.old_strategic_mention}
                          to={entry.new_strategic_mention}
                        />
                        <HistoryField
                          label="Status"
                          from={entry.old_status}
                          to={entry.new_status}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <SectionFooter
              text="Save impact, decision, date, and comments together. The reason you enter is also used in the supplier status history log."
              isSaving={savingSection === "decision"}
              onCancel={() => navigate(-1)}
              onSave={() => saveSection("decision")}
              saveLabel={
                relation.last_evaluation_date
                  ? "Update Decision Section"
                  : "Save Initial Evaluation"
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

const MetricCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur-sm">
    <span className="text-[11px] uppercase tracking-[0.14em] text-slate-300">
      {label}
    </span>
    <span className="mt-2 block text-lg font-semibold text-white">{value}</span>
  </div>
);

const StatusCard = ({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "green" | "orange" | "red" | "slate";
}) => {
  const toneClasses = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    orange: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-rose-200 bg-rose-50 text-rose-900",
    slate: "border-slate-200 bg-white text-slate-900",
  }[tone];

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClasses}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
      <div className="mt-1 text-sm opacity-80">{note}</div>
    </div>
  );
};

const SectionFooter = ({
  text,
  isSaving,
  onCancel,
  onSave,
  saveLabel,
}: {
  text: string;
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
}) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm text-slate-500">{text}</p>
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={isSaving}
        onClick={onSave}
        className="rounded-xl bg-[#0f2744] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(15,39,68,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? "Saving..." : saveLabel}
      </button>
    </div>
  </div>
);

const HistoryField = ({
  label,
  from,
  to,
}: {
  label: string;
  from: unknown;
  to: unknown;
}) => (
  <div className="rounded-lg bg-slate-50 px-3 py-2">
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
      {label}
    </div>
    <div className="mt-1 text-sm text-slate-700">
      {String(from ?? "-")} to {String(to ?? "-")}
    </div>
  </div>
);

const formatDateTime = (value?: string | null) => {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const resolveStatusTone = (
  status?: string | null,
): "green" | "orange" | "red" | "slate" => {
  if (status === "Can Quote and Be Awarded") return "green";
  if (status === "Can Quote but Not be Awarded") return "orange";
  if (status === "New business on Hold") return "red";
  return "slate";
};

const formatHistoryReason = (value?: string | null) => {
  if (!value) return value;
  return value.replace("[STATUS_OVERRIDE] ", "");
};
