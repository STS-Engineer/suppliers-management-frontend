import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { Pagination } from "../components/common/Pagination";
import {
  ClassBadge,
  ProgressBar,
  SectionCard,
  StatusBadge,
} from "../components/UI";
import {
  actionPlans,
  evaluationCenter,
  evaluationRows,
  reviewPlaybook,
  suppliers,
} from "../data/mockData";

const PAGE_SIZE = 4;

export function EvaluationsPage() {
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [page, setPage] = useState(1);

  const supplierGroupMap = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier.panel])),
    [],
  );

  const groups = useMemo(
    () => [
      "all",
      ...Array.from(
        new Set(
          evaluationCenter.map(
            (supplier) => supplierGroupMap.get(supplier.supplierId) ?? "Unassigned",
          ),
        ),
      ),
    ],
    [supplierGroupMap],
  );

  const filteredCenter = useMemo(() => {
    return evaluationCenter.filter((supplier) => {
      const group = supplierGroupMap.get(supplier.supplierId) ?? "Unassigned";
      return selectedGroup === "all" ? true : group === selectedGroup;
    });
  }, [selectedGroup, supplierGroupMap]);

  const totalPages = Math.max(1, Math.ceil(filteredCenter.length / PAGE_SIZE));
  const paginatedCenter = filteredCenter.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const selectedSupplier = filteredCenter[0] ?? evaluationCenter[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.95fr)]">
        <SectionCard
          title="Evaluation center"
          subtitle="Cycle trigger rules: strategic every 3/6 months, local annually"
          action={
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-slate-900/70">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={selectedGroup}
                onChange={(event) => {
                  setSelectedGroup(event.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-sm font-medium text-slate-600 outline-none dark:text-slate-200"
              >
                {groups.map((group) => (
                  <option key={group} value={group}>
                    {group === "all" ? "All groups" : group}
                  </option>
                ))}
              </select>
            </div>
          }
          contentClassName="space-y-4"
        >
          <div className="overflow-hidden rounded-[24px] border border-slate-200/80 dark:border-white/10">
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full divide-y divide-slate-200/80 text-sm dark:divide-white/10">
                <thead className="bg-slate-50/90 dark:bg-slate-900/70">
                  <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    <th className="px-5 py-4 font-semibold">Supplier</th>
                    <th className="px-5 py-4 font-semibold">Group</th>
                    <th className="px-5 py-4 font-semibold">Cadence</th>
                    <th className="px-5 py-4 font-semibold">Next review</th>
                    <th className="px-5 py-4 font-semibold">Class / Tier</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 bg-white/90 dark:divide-white/10 dark:bg-slate-950/40">
                  {paginatedCenter.map((supplier) => {
                    const group =
                      supplierGroupMap.get(supplier.supplierId) ?? "Unassigned";

                    return (
                      <tr
                        key={supplier.supplierId}
                        className="transition hover:bg-sky-50/50 dark:hover:bg-white/5"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-[#10233f] dark:text-white">
                            {supplier.supplierName}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {supplier.type} • {supplier.owner}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
                            {group}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                          {supplier.cadenceMonths} months
                        </td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                          {supplier.nextReviewDate}
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-2">
                            <ClassBadge value={supplier.supplierClass} />
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Tier {supplier.tier}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={supplier.status} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex min-w-[140px] items-center gap-3">
                            <ProgressBar value={100 - supplier.risk} />
                            <span className="text-sm text-slate-500 dark:text-slate-300">
                              {supplier.risk}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={filteredCenter.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </SectionCard>

        <SectionCard
          title="Selected supplier evaluation"
          subtitle={`${selectedSupplier.supplierName} - weighted scorecard and status logic`}
          contentClassName="space-y-5"
        >
          <div className="grid gap-4">
            {evaluationRows.map((row) => {
              const value =
                row.area === "Quality"
                  ? selectedSupplier.quality
                  : row.area === "Logistics"
                    ? selectedSupplier.logistics
                    : row.area === "Service"
                      ? selectedSupplier.service
                      : selectedSupplier.compliance;

              return (
                <div
                  key={row.area}
                  className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.75),rgba(10,18,30,0.82))]"
                >
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold text-[#10233f] dark:text-white">
                      {row.area} ({row.weight}%)
                    </span>
                    <strong className="text-lg text-[#0f2744] dark:text-white">
                      {value}
                    </strong>
                  </div>
                  <ProgressBar value={value} />
                </div>
              );
            })}
          </div>

          <div className="rounded-[24px] border border-sky-100 bg-sky-50/70 p-4 dark:border-sky-900/50 dark:bg-sky-950/30">
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
              Calculated outcome
            </label>
            <strong className="mt-2 block text-lg text-[#0f2744] dark:text-white">
              Score {selectedSupplier.score} - Class {selectedSupplier.supplierClass} -
              Tier {selectedSupplier.tier}
            </strong>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-[#0f2744] dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100">
              Approve evaluation cycle
            </button>
            <button className="inline-flex h-11 items-center rounded-2xl bg-[#0f2744] px-5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(15,39,68,0.24)] transition hover:-translate-y-0.5">
              Request status override
            </button>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Development and action plans"
        subtitle="C/D classes trigger development plan; unresolved cycles trigger action plan and possible VP hold"
      >
        <div className="overflow-hidden rounded-[24px] border border-slate-200/80 dark:border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200/80 text-sm dark:divide-white/10">
              <thead className="bg-slate-50/90 dark:bg-slate-900/70">
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-4 font-semibold">Supplier</th>
                  <th className="px-5 py-4 font-semibold">Issue</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Due date</th>
                  <th className="px-5 py-4 font-semibold">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 bg-white/90 dark:divide-white/10 dark:bg-slate-950/40">
                {actionPlans.map((plan) => (
                  <tr key={plan.supplier}>
                    <td className="px-5 py-4 font-semibold text-[#10233f] dark:text-white">
                      {plan.supplier}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {plan.issue}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {plan.status}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {plan.dueDate}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {plan.owner}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Annual formal review"
        subtitle="PM + VP Conversion & Productivity + VP Operations governance cycle"
      >
        <div className="grid gap-3">
          {[reviewPlaybook.annualReview, reviewPlaybook.devPlanRule, reviewPlaybook.overrideRule].map(
            (item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-4 py-3 text-sm text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(10,18,30,0.82))] dark:text-slate-300"
              >
                {item}
              </div>
            ),
          )}
        </div>
      </SectionCard>
    </div>
  );
}
