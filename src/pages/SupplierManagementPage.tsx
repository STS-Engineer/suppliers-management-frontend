/**
 * Supplier Management Page
 * Entry point for searching supplier groups and managing unit/site relations.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SupplierManagement } from "../components/onboarding/SupplierManagement";
import { EmptyState, MetricCard, PageIntro, SectionCard } from "../components/UI";
import { supplierAPI } from "../services/supplierOnboardingAPI";
import { SupplierGroupSummary } from "../types/onboarding";

export const SupplierManagementPage = () => {
  const { groupId } = useParams<{ groupId?: string }>();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<SupplierGroupSummary[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<SupplierGroupSummary | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    const loadGroups = async () => {
      setIsLoadingGroups(true);
      setGroupsError(null);

      try {
        const response = await supplierAPI.listSupplierGroups(0, 200);
        if (!cancelled) {
          const items = response.data?.items || [];
          setGroups(items);

          if (groupId) {
            const matched = items.find(
              (group) => group.id_group === Number.parseInt(groupId, 10),
            );

            if (matched) {
              setActiveGroup(matched);
            } else {
              const detail = await supplierAPI.getSupplierGroup(
                Number.parseInt(groupId, 10),
              );
              if (!cancelled) {
                setActiveGroup(detail.data);
              }
            }
          } else {
            setActiveGroup(null);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setGroupsError(
            error instanceof Error ? error.message : "Failed to load groups",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingGroups(false);
        }
      }
    };

    loadGroups();

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const filteredGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return groups;
    }

    return groups.filter((group) =>
      [
        group.nom,
        group.supplier_scope,
        group.supplier_type,
        group.strategic_reason,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [groups, search]);

  const selectGroup = (group: SupplierGroupSummary) => {
    setActiveGroup(group);
    navigate(`/suppliers/${group.id_group}/manage`);
  };

  if (groupId && activeGroup) {
    return (
      <SupplierManagement
        groupId={activeGroup.id_group}
        groupName={activeGroup.nom}
        onClose={() => navigate("/suppliers/manage")}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-6 px-2">
      <PageIntro
        eyebrow="Lifecycle Workspace"
        title="Manage Existing Supplier Groups"
        description="Search an existing supplier group, open its units, add another unit, or assign a unit to an Avocarbon site without needing the group ID in the URL."
        actions={
          <button
            type="button"
            onClick={() => navigate("/suppliers/onboarding")}
            className="inline-flex items-center rounded-2xl border border-white/20 bg-white/12 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/18"
          >
            Create Supplier Master
          </button>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Visible Groups"
            value={filteredGroups.length}
            helper="Filtered results ready for lifecycle actions"
          />
          <MetricCard
            label="Loaded Portfolio"
            value={groups.length}
            helper="Supplier groups available from the backend"
          />
          <MetricCard
            label="Workflow"
            value="Existing Group"
            helper="Use this entrypoint for unit and site assignment"
          />
        </div>
      </PageIntro>

      <SectionCard
        title="Supplier Group Search"
        subtitle="Open a group to add another unit or continue to site assignment."
        action={
          <div className="w-full sm:w-[360px]">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by supplier name, scope, or type..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </div>
        }
      >
        {groupsError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {groupsError}
          </div>
        ) : null}

        {isLoadingGroups ? (
          <EmptyState
            title="Loading supplier groups"
            description="The lifecycle workspace is pulling the latest supplier groups."
          />
        ) : filteredGroups.length === 0 ? (
          <EmptyState
            title="No matching supplier groups"
            description="Try a broader search by supplier name, scope, or type."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredGroups.map((group) => (
              <button
                key={group.id_group}
                type="button"
                onClick={() => selectGroup(group)}
                className="rounded-[24px] border border-slate-200 bg-slate-50/70 px-5 py-5 text-left transition hover:border-sky-300 hover:bg-white hover:shadow-[0_16px_32px_rgba(15,23,42,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {group.nom}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {group.group_code ||
                        `GRP-${String(group.id_group).padStart(6, "0")}`}
                    </p>
                  </div>
                  {group.supplier_scope ? (
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800">
                      {group.supplier_scope}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                  {group.supplier_type ? (
                    <span className="rounded-full bg-slate-200 px-2.5 py-1">
                      {group.supplier_type}
                    </span>
                  ) : null}
                  {group.strategique ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
                      Strategic
                    </span>
                  ) : null}
                  {group.monopolistique ? (
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-800">
                      Monopolistic
                    </span>
                  ) : null}
                  {group.directed ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800">
                      Directed
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 text-sm font-semibold text-[#0b4a74]">
                  Open management
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default SupplierManagementPage;
