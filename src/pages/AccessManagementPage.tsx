import { useEffect, useMemo, useState } from "react";
import {
  AccessIdentityRecord,
  supplierAPI,
} from "../services/supplierOnboardingAPI";
import {
  EmptyState,
  InlineAlert,
  MetricCard,
  PageIntro,
  SectionCard,
} from "../components/UI";

const PROFILE_OPTIONS = [
  { value: "purchasing_manager", label: "Purchasing Manager" },
  { value: "supplier_owner", label: "Supplier Owner" },
];

const emptyCreateForm = {
  email: "",
  full_name: "",
  access_profile: "purchasing_manager",
  password: "",
  is_active: true,
};

export default function AccessManagementPage() {
  const [items, setItems] = useState<AccessIdentityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [isCreating, setIsCreating] = useState(false);
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>(
    {},
  );
  const [savingRows, setSavingRows] = useState<Record<number, boolean>>({});
  const [drafts, setDrafts] = useState<
    Record<number, Partial<AccessIdentityRecord>>
  >({});

  const loadItems = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await supplierAPI.listAccessIdentities();
      setItems(response.data.items || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load access identities.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const activeCount = useMemo(
    () => items.filter((item) => item.is_active).length,
    [items],
  );

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      const response = await supplierAPI.createAccessIdentity(createForm);
      setItems((current) => [response.data, ...current]);
      setCreateForm(emptyCreateForm);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create access identity.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const updateDraft = (
    identityId: number,
    patch: Partial<AccessIdentityRecord>,
  ) => {
    setDrafts((current) => ({
      ...current,
      [identityId]: {
        ...(current[identityId] || {}),
        ...patch,
      },
    }));
  };

  const saveRow = async (item: AccessIdentityRecord) => {
    const draft = drafts[item.id_identity];
    if (!draft) return;

    setSavingRows((current) => ({ ...current, [item.id_identity]: true }));
    setError(null);

    try {
      const response = await supplierAPI.updateAccessIdentity(
        item.id_identity,
        {
          full_name: draft.full_name,
          access_profile: draft.access_profile,
          is_active: draft.is_active,
        },
      );
      setItems((current) =>
        current.map((entry) =>
          entry.id_identity === item.id_identity ? response.data : entry,
        ),
      );
      setDrafts((current) => {
        const next = { ...current };
        delete next[item.id_identity];
        return next;
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update access identity.",
      );
    } finally {
      setSavingRows((current) => ({ ...current, [item.id_identity]: false }));
    }
  };

  const resetPassword = async (item: AccessIdentityRecord) => {
    const newPassword = resetPasswords[item.id_identity]?.trim();
    if (!newPassword) {
      setError("Enter a new password before resetting.");
      return;
    }

    setResettingId(item.id_identity);
    setError(null);

    try {
      await supplierAPI.resetAccessIdentityPassword(item.id_identity, {
        new_password: newPassword,
      });
      setResetPasswords((current) => ({ ...current, [item.id_identity]: "" }));
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Failed to reset password.",
      );
    } finally {
      setResettingId(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-6 px-2">
      <PageIntro
        eyebrow="Security"
        title="Access Management"
        description="Create application identities, maintain account status, and reset passwords from one controlled workspace."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Identities"
            value={items.length}
            helper="Provisioned application accounts"
          />
          <MetricCard
            label="Active Accounts"
            value={activeCount}
            helper="Accounts that can currently sign in"
          />
        </div>
      </PageIntro>

      {error ? (
        <InlineAlert
          title="Access management needs attention"
          message={error}
          action={
            <button
              type="button"
              onClick={loadItems}
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100"
            >
              Retry
            </button>
          }
        />
      ) : null}

      <SectionCard
        title="Create Identity"
        subtitle="Provision a new account for the supplier management application."
      >
        <form onSubmit={handleCreate} className="grid gap-4 lg:grid-cols-2">
          <input
            value={createForm.full_name}
            onChange={(event) =>
              setCreateForm((current) => ({
                ...current,
                full_name: event.target.value,
              }))
            }
            placeholder="Full name"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
            required
          />
          <input
            value={createForm.email}
            onChange={(event) =>
              setCreateForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            placeholder="Email address"
            type="email"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
            required
          />
          <select
            value={createForm.access_profile}
            onChange={(event) =>
              setCreateForm((current) => ({
                ...current,
                access_profile: event.target.value,
              }))
            }
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
          >
            {PROFILE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={createForm.password}
            onChange={(event) =>
              setCreateForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            placeholder="Temporary password"
            type="password"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
            required
          />
          <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={createForm.is_active}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  is_active: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            Allow this account to sign in immediately
          </label>
          <div className="lg:col-span-2">
            <button
              type="submit"
              disabled={isCreating}
              className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f2744,#1b5d92)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(15,39,68,0.20)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isCreating ? "Creating..." : "Create identity"}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Provisioned Accounts"
        subtitle="Update profile labels, activate or disable access, and reset passwords."
      >
        {isLoading ? (
          <EmptyState
            title="Loading identities"
            description="The access workspace is retrieving the current application accounts."
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No access identities"
            description="Create the first account to enable sign-in for this application."
          />
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const draft = drafts[item.id_identity] || {};
              return (
                <div
                  key={item.id_identity}
                  className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr_auto]">
                    <div className="space-y-3">
                      <input
                        value={draft.full_name ?? item.full_name}
                        onChange={(event) =>
                          updateDraft(item.id_identity, {
                            full_name: event.target.value,
                          })
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                      />
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                        {item.email}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <select
                        value={draft.access_profile ?? item.access_profile}
                        onChange={(event) =>
                          updateDraft(item.id_identity, {
                            access_profile: event.target.value,
                          })
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                      >
                        {PROFILE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={draft.is_active ?? item.is_active}
                          onChange={(event) =>
                            updateDraft(item.id_identity, {
                              is_active: event.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        Active account
                      </label>
                    </div>

                    <div className="space-y-3">
                      <input
                        type="password"
                        value={resetPasswords[item.id_identity] || ""}
                        onChange={(event) =>
                          setResetPasswords((current) => ({
                            ...current,
                            [item.id_identity]: event.target.value,
                          }))
                        }
                        placeholder="New password"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                      />
                      <button
                        type="button"
                        onClick={() => resetPassword(item)}
                        disabled={resettingId === item.id_identity}
                        className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {resettingId === item.id_identity
                          ? "Resetting..."
                          : "Reset password"}
                      </button>
                    </div>

                    <div className="flex items-start lg:justify-end">
                      <button
                        type="button"
                        onClick={() => saveRow(item)}
                        disabled={savingRows[item.id_identity]}
                        className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {savingRows[item.id_identity] ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
