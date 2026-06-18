import React, { useMemo, useState } from "react";
import type {
  AvocarbonSite,
  RelationEvaluationWorkspace,
  SupplierUnitResponse,
} from "../../types/onboarding";

type TabKey = "overview" | "criteria" | "history" | "plans";

interface RelationDetailsModalProps {
  workspace: RelationEvaluationWorkspace | null;
  site?: AvocarbonSite | null;
  unit?: SupplierUnitResponse | null;
  groupName?: string | null;
  isLoading: boolean;
  onClose: () => void;
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "criteria", label: "Criteria" },
  { key: "history", label: "History" },
  { key: "plans", label: "Development Plans" },
];

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return String(value);
};

const formatMoney = (value?: number | null, currency?: string | null) => {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toLocaleString()} ${currency ?? ""}`.trim();
};

const labelize = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const panelCls = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const tableHeaderCls =
  "px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500";
const tableCellCls = "px-3 py-2 align-top text-sm text-slate-700";

const MetricCard = ({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "blue" | "emerald" | "amber";
}) => {
  const toneMap = {
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  } as const;

  return (
    <div className={`rounded-2xl border p-4 ${toneMap[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold">{value || "—"}</p>
    </div>
  );
};

const DetailGrid = ({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) => (
  <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
    {items.map((item) => (
      <div key={item.label}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {item.label}
        </p>
        <div className="mt-1 text-sm font-semibold text-slate-700">
          {item.value || "—"}
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = ({ label }: { label: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
    {label}
  </div>
);

export const RelationDetailsModal: React.FC<RelationDetailsModalProps> = ({
  workspace,
  site,
  unit,
  groupName,
  isLoading,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  React.useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    const scrollY = window.scrollY;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      body.style.overflow = previousOverflow;
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      window.scrollTo({ top: scrollY, behavior: "auto" });
    };
  }, []);

  const criteriaDecisionRows = useMemo(
    () =>
      workspace
        ? [
            ["Top", workspace.top],
            ["LTA", workspace.lta],
            ["SQMA", workspace.sqma],
            ["Quality Certification", workspace.quality_certification],
            ["Family Coverage", workspace.family_coverage],
            ["Competitiveness", workspace.competitiveness],
            ["Geo Coverage", workspace.geo_coverage],
            ["Cons / WD", workspace.cons_or_wd],
            ["Financial Health", workspace.financial_health],
            ["Prod LIA / INS", workspace.prod_lia_ins],
            ["Prod", workspace.prod],
          ].filter(([, value]) => value)
        : [],
    [workspace],
  );

  const criteriaScoreRows = useMemo(
    () =>
      workspace
        ? [
            ["Management System", workspace.management_system],
            ["Customer Communication", workspace.customer_communication],
            ["Development Design", workspace.development_design],
            ["Production Manufacturing", workspace.production_manufacturing],
            ["Quality Audits", workspace.quality_audits],
            ["Suppliers Subcontractors", workspace.suppliers_subcontractors],
            ["Deliveries", workspace.deliveries],
            ["Environment Ethic Rules", workspace.environment_ethic_rules],
          ].filter(([, value]) => value !== null && value !== undefined)
        : [],
    [workspace],
  );

  const criteriaEvidenceRows = useMemo(
    () =>
      Object.entries(workspace?.class_criteria_details || {}).map(
        ([key, detail]) => ({
          key,
          label: labelize(key),
          score: detail.score,
          documentName:
            detail.document_name || detail.evidence_file_name || "—",
          documentUrl: detail.document_url,
          dates: [
            detail.validity_start_date
              ? `Start: ${formatDate(detail.validity_start_date)}`
              : null,
            detail.validity_end_date
              ? `End: ${formatDate(detail.validity_end_date)}`
              : null,
            detail.signature_date
              ? `Signed: ${formatDate(detail.signature_date)}`
              : null,
            detail.last_update_date
              ? `Updated: ${formatDate(detail.last_update_date)}`
              : null,
          ]
            .filter(Boolean)
            .join(" · "),
          notes: detail.comments || "—",
        }),
      ),
    [workspace],
  );

  const activePlans = (workspace?.development_plans || []).filter(
    (plan) => !["approved", "closed", "cancelled"].includes((plan.plan_status || "").toLowerCase()),
  );

  const relation = workspace?.relation;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#062B49]/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-[0_32px_90px_rgba(6,43,73,0.24)]">
        <div className="border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                Relation Details
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {groupName || "Supplier Relation"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {(site?.site_name || "Unknown site") +
                  " · " +
                  (unit?.supplier_code || relation?.unit_code || "Unknown unit")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? "bg-[#062B49] text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isLoading || !workspace ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-600 shadow-sm">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#062B49]" />
                Loading relation details...
              </div>
            </div>
          ) : activeTab === "overview" ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Effective Status"
                  value={
                    workspace.effective_supplier_status ||
                    relation?.supplier_status ||
                    "—"
                  }
                  tone="blue"
                />
                <MetricCard
                  label="Operational Grade"
                  value={workspace.operational_grade || relation?.operational_grade || "—"}
                  tone="emerald"
                />
                <MetricCard
                  label="Class"
                  value={
                    workspace.class_value !== null &&
                    workspace.class_value !== undefined
                      ? String(workspace.class_value)
                      : relation?.class_value
                        ? String(relation.class_value)
                        : "—"
                  }
                  tone="amber"
                />
                <MetricCard
                  label="Open Plans"
                  value={String(activePlans.length)}
                />
              </div>

              <section className={panelCls}>
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Relation Information
                  </h3>
                </div>
                <div className="px-5 py-5">
                  <DetailGrid
                    items={[
                      { label: "Relation Code", value: relation?.relation_code || "—" },
                      { label: "SB1 Item", value: relation?.sb1_item_name || "—" },
                      { label: "Group", value: groupName || "—" },
                      { label: "Site", value: site?.site_name || "—" },
                      { label: "Unit", value: unit?.supplier_code || relation?.unit_code || "—" },
                      { label: "Scope", value: relation?.supplier_scope || "—" },
                      { label: "Owner", value: relation?.supplier_owner || "—" },
                      {
                        label: "Annual Spend",
                        value: formatMoney(
                          relation?.annual_spend_value ?? null,
                          relation?.annual_spend_currency ?? null,
                        ),
                      },
                      {
                        label: "Frequency",
                        value: relation?.evaluation_frequency || "—",
                      },
                      {
                        label: "Linked",
                        value: formatDate(relation?.created_at),
                      },
                      {
                        label: "Last Evaluation",
                        value: formatDate(relation?.last_evaluation_date),
                      },
                      {
                        label: "Next Evaluation",
                        value: formatDate(relation?.next_evaluation_date),
                      },
                      {
                        label: "Last Status Change",
                        value: formatDate(relation?.last_status_change),
                      },
                    ]}
                  />
                </div>
              </section>

              <section className={panelCls}>
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Logistics &amp; SB1 Data
                  </h3>
                </div>
                <div className="px-5 py-5">
                  <DetailGrid
                    items={[
                      { label: "Transport Mode", value: relation?.transport_mode || "—" },
                      { label: "Transit Days", value: relation?.transit_days != null ? String(relation.transit_days) : "—" },
                      { label: "Incoterm / Place", value: relation?.incoterm_place || "—" },
                      { label: "Real AP Days", value: relation?.real_ap_days != null ? String(relation.real_ap_days) : "—" },
                      { label: "Validated AP Days", value: relation?.real_ap_days_validated != null ? String(relation.real_ap_days_validated) : "—" },
                      { label: "Req. AP Date", value: formatDate(relation?.req_ap_date) },
                      { label: "Consignment", value: relation?.consignment === true ? "Yes" : relation?.consignment === false ? "No" : "—" },
                      { label: "Preferred Dev Supplier", value: relation?.preferred_dev_supplier === true ? "Yes" : relation?.preferred_dev_supplier === false ? "No" : "—" },
                      { label: "Delivery Status", value: relation?.delivery_status || "—" },
                      { label: "Data Validity", value: relation?.data_validity || "—" },
                      { label: "Quality Cert Required", value: relation?.quality_cert_required || "—" },
                      { label: "Last Eval Score", value: relation?.last_eval_score != null ? String(relation.last_eval_score) : "—" },
                    ]}
                  />
                </div>
              </section>

              <section className={panelCls}>
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Evaluation Snapshot
                  </h3>
                </div>
                <div className="px-5 py-5">
                  <DetailGrid
                    items={[
                      {
                        label: "Computed Status",
                        value: workspace.computed_supplier_status || "—",
                      },
                      {
                        label: "Final Status",
                        value: workspace.effective_supplier_status || "—",
                      },
                      {
                        label: "Impact Score",
                        value: formatNumber(workspace.impact_score),
                      },
                      {
                        label: "Class Score",
                        value: formatNumber(workspace.class_score),
                      },
                      {
                        label: "Operational Score",
                        value: formatNumber(workspace.operational_score),
                      },
                      {
                        label: "Strategic Mention",
                        value:
                          workspace.strategic_mention ||
                          relation?.strategic_mention ||
                          "—",
                      },
                      {
                        label: "Panel Decision",
                        value:
                          workspace.panel_decision ||
                          relation?.panel_decision ||
                          "—",
                      },
                      {
                        label: "Override Status",
                        value: workspace.status_override?.status || "—",
                      },
                      {
                        label: "Override By",
                        value: workspace.status_override?.changed_by || "—",
                      },
                      {
                        label: "Override Date",
                        value: formatDate(workspace.status_override?.changed_at),
                      },
                    ]}
                  />
                </div>
              </section>

              <div className="grid gap-6 xl:grid-cols-2">
                <section className={panelCls}>
                  <div className="border-b border-slate-100 px-5 py-4">
                    <h3 className="text-sm font-bold text-slate-900">Comments</h3>
                  </div>
                  <div className="space-y-4 px-5 py-5">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      {workspace.comments || relation?.evaluation_comments || "No evaluation comments yet."}
                    </div>
                    {workspace.status_override?.reason && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <p className="font-semibold">Override reason</p>
                        <p className="mt-1">{workspace.status_override.reason}</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className={panelCls}>
                  <div className="border-b border-slate-100 px-5 py-4">
                    <h3 className="text-sm font-bold text-slate-900">
                      Development Plan Summary
                    </h3>
                  </div>
                  <div className="space-y-3 px-5 py-5">
                    {workspace.development_plans?.length ? (
                      workspace.development_plans.slice(0, 3).map((plan) => (
                        <div
                          key={plan.id_development_plan}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-slate-800">
                              {plan.plan_title || `Plan #${plan.id_development_plan}`}
                            </p>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                              {plan.plan_status || "—"}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            Due {formatDate(plan.due_date)} · Submitted {formatDate(plan.submission_date)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <EmptyState label="No development plans linked to this relation yet." />
                    )}
                  </div>
                </section>
              </div>
            </div>
          ) : activeTab === "criteria" ? (
            <div className="space-y-6">
              <section className={panelCls}>
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Decision Criteria
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  {criteriaDecisionRows.length ? (
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className={tableHeaderCls}>Criterion</th>
                          <th className={tableHeaderCls}>Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {criteriaDecisionRows.map(([label, value]) => (
                          <tr key={label}>
                            <td className={`${tableCellCls} font-semibold`}>{label}</td>
                            <td className={tableCellCls}>{value || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="px-5 py-5">
                      <EmptyState label="No decision criteria were recorded yet." />
                    </div>
                  )}
                </div>
              </section>

              <section className={panelCls}>
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Scoring Criteria
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  {criteriaScoreRows.length ? (
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className={tableHeaderCls}>Criterion</th>
                          <th className={tableHeaderCls}>Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {criteriaScoreRows.map(([label, value]) => (
                          <tr key={label}>
                            <td className={`${tableCellCls} font-semibold`}>{label}</td>
                            <td className={tableCellCls}>{formatNumber(value as number)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="px-5 py-5">
                      <EmptyState label="No scoring criteria were recorded yet." />
                    </div>
                  )}
                </div>
              </section>

              <section className={panelCls}>
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Evidence Details
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  {criteriaEvidenceRows.length ? (
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className={tableHeaderCls}>Criterion</th>
                          <th className={tableHeaderCls}>Score</th>
                          <th className={tableHeaderCls}>Document</th>
                          <th className={tableHeaderCls}>Dates</th>
                          <th className={tableHeaderCls}>Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {criteriaEvidenceRows.map((row) => (
                          <tr key={row.key}>
                            <td className={`${tableCellCls} font-semibold`}>{row.label}</td>
                            <td className={tableCellCls}>{formatNumber(row.score ?? null)}</td>
                            <td className={tableCellCls}>
                              {row.documentUrl ? (
                                <a
                                  href={row.documentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-semibold text-[#062B49] hover:underline"
                                >
                                  {row.documentName}
                                </a>
                              ) : (
                                row.documentName
                              )}
                            </td>
                            <td className={tableCellCls}>{row.dates || "—"}</td>
                            <td className={tableCellCls}>{row.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="px-5 py-5">
                      <EmptyState label="No evidence details were attached yet." />
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : activeTab === "history" ? (
            <section className={panelCls}>
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Status History
                </h3>
              </div>
              <div className="overflow-x-auto">
                {workspace.status_history.length ? (
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className={tableHeaderCls}>Changed</th>
                        <th className={tableHeaderCls}>By</th>
                        <th className={tableHeaderCls}>Status</th>
                        <th className={tableHeaderCls}>Class</th>
                        <th className={tableHeaderCls}>Grade</th>
                        <th className={tableHeaderCls}>Panel</th>
                        <th className={tableHeaderCls}>Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {workspace.status_history.map((entry) => (
                        <tr key={entry.id_history}>
                          <td className={tableCellCls}>
                            {formatDate(entry.changed_at || entry.created_at)}
                          </td>
                          <td className={tableCellCls}>{entry.changed_by || "—"}</td>
                          <td className={tableCellCls}>
                            {(entry.old_status || "—") + " → " + (entry.new_status || "—")}
                          </td>
                          <td className={tableCellCls}>
                            {(entry.old_class ?? "—") + " → " + (entry.new_class ?? "—")}
                          </td>
                          <td className={tableCellCls}>
                            {(entry.old_grade || "—") + " → " + (entry.new_grade || "—")}
                          </td>
                          <td className={tableCellCls}>
                            {(entry.old_panel_decision || "—") +
                              " → " +
                              (entry.new_panel_decision || "—")}
                          </td>
                          <td className={tableCellCls}>{entry.change_reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-5 py-5">
                    <EmptyState label="No status history is available yet." />
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className={panelCls}>
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Development Plans
                </h3>
              </div>
              <div className="overflow-x-auto">
                {workspace.development_plans?.length ? (
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className={tableHeaderCls}>Title</th>
                        <th className={tableHeaderCls}>Status</th>
                        <th className={tableHeaderCls}>Issue</th>
                        <th className={tableHeaderCls}>Due</th>
                        <th className={tableHeaderCls}>Submission</th>
                        <th className={tableHeaderCls}>Decision</th>
                        <th className={tableHeaderCls}>Internal Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {workspace.development_plans.map((plan) => (
                        <tr key={plan.id_development_plan}>
                          <td className={`${tableCellCls} font-semibold`}>
                            {plan.plan_title || `Plan #${plan.id_development_plan}`}
                          </td>
                          <td className={tableCellCls}>{plan.plan_status || "—"}</td>
                          <td className={tableCellCls}>{formatDate(plan.issue_date)}</td>
                          <td className={tableCellCls}>
                            <div className="space-y-1">
                              <div>{formatDate(plan.due_date)}</div>
                              {plan.is_overdue && (
                                <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                                  {plan.days_past_due
                                    ? `${plan.days_past_due} day(s) overdue`
                                    : "Overdue"}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={tableCellCls}>{formatDate(plan.submission_date)}</td>
                          <td className={tableCellCls}>{formatDate(plan.decision_date)}</td>
                          <td className={tableCellCls}>{plan.internal_comments || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-5 py-5">
                    <EmptyState label="No development plans exist for this relation yet." />
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
