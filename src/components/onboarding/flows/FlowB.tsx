/**
 * Flow B — Assign a unit to an Avocarbon plant
 *
 * Steps: Group → Unit → Plant → Responsible Contact → Owner → Review
 */

import React, { useEffect, useState } from "react";
import {
  AvocarbonSite,
  SupplierUnitResponse,
  ContactResponse,
} from "../../../types/onboarding";
import { supplierAPI } from "../../../services/supplierOnboardingAPI";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlowBProps {
  groupId: number;
  groupName: string;
  units: SupplierUnitResponse[];
  availableSites: AvocarbonSite[];
  selectedUnit?: SupplierUnitResponse | null;
  groupScope?: string | null;
  groupOwner?: string | null;
  onSuccess: (unitId: number) => void;
  onCancel: () => void;
}

interface ContactOption {
  id_contact: number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role_label: string | null;
  is_primary_contact: boolean | null;
  source: "group" | "unit";
  source_label?: string;
}

interface NewContact {
  full_name: string;
  email: string;
  phone: string;
  role_label: string;
}

const toContactOption = (
  contact: ContactResponse,
  source: "group" | "unit",
  sourceLabel?: string,
): ContactOption => ({
  id_contact: contact.id_contact,
  full_name: contact.full_name ?? null,
  email: contact.email ?? null,
  phone: contact.phone ?? null,
  role_label: contact.role_label ?? null,
  is_primary_contact: contact.is_primary_contact ?? null,
  source,
  source_label: sourceLabel,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = ["Group", "Unit", "Plant", "Contact", "Owner", "Review"];

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none shadow-sm transition focus:border-[#0f2744]/40 focus:ring-4 focus:ring-[#0f2744]/8";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FlowB: React.FC<FlowBProps> = ({
  groupId,
  groupName,
  units,
  availableSites,
  selectedUnit,
  groupScope,
  groupOwner,
  onSuccess,
  onCancel,
}) => {
  const [step, setStep] = useState(selectedUnit ? 2 : 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitSearch, setUnitSearch] = useState("");
  const [siteSearch, setSiteSearch] = useState("");

  const [unitId, setUnitId] = useState<number | null>(
    selectedUnit?.id_supplier_unit ?? null,
  );
  const [siteId, setSiteId] = useState<number | null>(null);
  const [supplierOwner, setSupplierOwner] = useState(
    groupScope === "global" ? (groupOwner ?? "") : "",
  );
  const [supplierScope] = useState(groupScope ?? "local");


  // Contact step
  const [allContacts, setAllContacts] = useState<ContactOption[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [addNew, setAddNew] = useState(false);
  const [newContact, setNewContact] = useState<NewContact>({
    full_name: "",
    email: "",
    phone: "",
    role_label: "",
  });

  // Load contacts when reaching step 3
  useEffect(() => {
    if (step !== 3) return;
    let active = true;
    setContactsLoading(true);

    const load = async () => {
      try {
        const [gRes, uRes] = await Promise.all([
          supplierAPI.listContactsForGroup(groupId),
          supplierAPI.listUnitsForGroup(groupId),
        ]);
        if (!active) return;

        const gc: ContactOption[] = (gRes.data?.items ?? []).map(
          (c: ContactResponse) => toContactOption(c, "group"),
        );

        const ul: Array<{ id_supplier_unit: number; supplier_code: string }> =
          uRes.data?.units ?? [];

        const chunks = await Promise.all(
          ul.map(async (u) => {
            try {
              const r = await supplierAPI.listContactsForUnit(u.id_supplier_unit);
              return (r.data?.items ?? []).map((c: ContactResponse) =>
                toContactOption(
                  c,
                  "unit",
                  u.supplier_code || `Unit ${u.id_supplier_unit}`,
                ),
              );
            } catch {
              return [];
            }
          }),
        );

        if (!active) return;
        const seen = new Set<number>();
        const merged: ContactOption[] = [];
        for (const c of [...gc, ...chunks.flat()]) {
          if (!seen.has(c.id_contact)) {
            seen.add(c.id_contact);
            merged.push(c);
          }
        }
        setAllContacts(merged);
      } catch {
        // keep empty
      } finally {
        if (active) setContactsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [step, groupId]);

  useEffect(() => {
    if (supplierScope === "global" && groupOwner) setSupplierOwner(groupOwner);
  }, [supplierScope, groupOwner]);

  const resolvedUnit =
    units.find((u) => u.id_supplier_unit === unitId) ?? selectedUnit;
  const resolvedSite = availableSites.find((s) => s.id_site === siteId);

  const filteredUnits = unitSearch
    ? units.filter(
        (u) =>
          u.supplier_code?.toLowerCase().includes(unitSearch.toLowerCase()) ||
          u.city?.toLowerCase().includes(unitSearch.toLowerCase()),
      )
    : units;

  const filteredSites = siteSearch
    ? availableSites.filter(
        (s) =>
          s.site_name?.toLowerCase().includes(siteSearch.toLowerCase()) ||
          s.city?.toLowerCase().includes(siteSearch.toLowerCase()),
      )
    : availableSites;

  const canNext = (): boolean => {
    if (step === 1) return unitId !== null;
    if (step === 2) return siteId !== null;
    if (step === 3) {
      if (addNew) return newContact.full_name.trim().length > 0 && newContact.email.trim().length > 0;
      return selectedContactId !== null;
    }
    if (step === 4) return supplierOwner.trim().length > 0;
    return true;
  };

  const handleSubmit = async () => {
    if (!unitId || !siteId) return;
    setSubmitting(true);
    setError(null);
    try {
      const relRes = await supplierAPI.linkUnitToSite(unitId, siteId, {
        supplier_owner: supplierOwner,
        supplier_scope: supplierScope,
      });

      const relationId: number | undefined =
        relRes?.data?.id_relation ??
        relRes?.relation_id ??
        relRes?.data?.relation_id;

      if (relationId) {
        if (!addNew && selectedContactId !== null) {
          await supplierAPI.addContactToRelation(relationId, {
            contact_id: selectedContactId,
          });
        } else if (addNew && newContact.full_name.trim()) {
          await supplierAPI.addContactToRelation(relationId, {
            full_name: newContact.full_name,
            email: newContact.email,
            phone: newContact.phone || undefined,
            role_label: newContact.role_label || undefined,
            id_supplier_unit: unitId,
          });
        }
      }

      onSuccess(unitId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create relation",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-md">

      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-amber-100 bg-gradient-to-r from-amber-50 to-white px-6 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
            Assign Unit to Plant
          </p>
          <h3 className="mt-0.5 text-base font-bold text-slate-900">{groupName}</h3>
        </div>
        <button
          onClick={onCancel}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Step bar ── */}
      <div className="flex border-b border-slate-100 px-6 pt-4 pb-0">
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center gap-1.5 pb-3">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    done
                      ? "bg-[#0f2744] text-white"
                      : active
                      ? "bg-amber-400 text-slate-900 shadow-sm"
                      : "border-2 border-slate-200 bg-white text-slate-300"
                  }`}
                >
                  {done ? (
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-[10px] font-semibold ${
                    active ? "text-amber-600" : done ? "text-slate-500" : "text-slate-300"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-1 mb-6 mt-3.5 h-0.5 flex-1 self-start rounded-full transition-all ${
                    i < step ? "bg-[#0f2744]" : "bg-slate-100"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Body ── */}
      <div className="px-6 py-6">
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Step 0 — Confirm group */}
        {step === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Supplier Group
            </p>
            <h4 className="mt-2 text-2xl font-bold text-slate-900">{groupName}</h4>
            <p className="mt-2 text-sm text-slate-500">
              {units.length} unit{units.length !== 1 ? "s" : ""} registered · Confirm to continue to unit selection.
            </p>
          </div>
        )}

        {/* Step 1 — Choose unit */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Select the unit to assign to a plant.</p>
            <SearchInput
              value={unitSearch}
              onChange={setUnitSearch}
              placeholder="Search by name, city…"
            />
            <PickList>
              {filteredUnits.length === 0 ? (
                <EmptyState message="No units match your search." />
              ) : (
                filteredUnits.map((u) => (
                  <PickItem
                    key={u.id_supplier_unit}
                    selected={unitId === u.id_supplier_unit}
                    onClick={() => {
                      setUnitId(u.id_supplier_unit);
                      if (siteId) setSiteId(null);
                    }}
                  >
                    <span className="font-semibold text-slate-900">{u.supplier_code}</span>
                    <span className="text-xs text-slate-400">
                      {[u.city, u.country].filter(Boolean).join(", ")}
                      {u.product_type ? ` · ${u.product_type}` : ""}
                    </span>
                  </PickItem>
                ))
              )}
            </PickList>
          </div>
        )}

        {/* Step 2 — Choose plant */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Select the Avocarbon plant for{" "}
              <span className="font-semibold text-slate-800">{resolvedUnit?.supplier_code}</span>.
            </p>
            <SearchInput
              value={siteSearch}
              onChange={setSiteSearch}
              placeholder="Search by plant name, city…"
            />
            <PickList>
              {filteredSites.length === 0 ? (
                <EmptyState message="No plants match your search." />
              ) : (
                filteredSites.map((s) => (
                  <PickItem
                    key={s.id_site}
                    selected={siteId === s.id_site}
                    onClick={() => setSiteId(s.id_site)}
                  >
                    <span className="font-semibold text-slate-900">{s.site_name}</span>
                    <span className="text-xs text-slate-400">
                      {[s.city, s.country].filter(Boolean).join(", ")}
                      {!s.active ? " · Inactive" : ""}
                    </span>
                  </PickItem>
                ))
              )}
            </PickList>
          </div>
        )}

        {/* Step 3 — Responsible contact */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Who is responsible for this relation at{" "}
                <span className="text-[#0f2744]">{groupName}</span>?
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                This person will be linked to the{" "}
                <span className="font-semibold text-slate-700">
                  {resolvedUnit?.supplier_code} → {resolvedSite?.site_name}
                </span>{" "}
                relation as the external contact.{" "}
                <span className="font-semibold text-red-600">Required.</span>
              </p>
            </div>

            {contactsLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
                Loading contacts…
              </div>
            ) : (
              <>
                {allContacts.length > 0 ? (
                  <div className="space-y-2">
                    {allContacts.map((c) => {
                      const sel = selectedContactId === c.id_contact && !addNew;
                      return (
                        <button
                          key={c.id_contact}
                          type="button"
                          onClick={() => {
                            setSelectedContactId(sel ? null : c.id_contact);
                            setAddNew(false);
                          }}
                          className={`w-full flex items-center gap-4 rounded-xl border px-4 py-3 text-left text-sm transition ${
                            sel
                              ? "border-[#0f2744] bg-[#0f2744]/5 ring-1 ring-[#0f2744]/20"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {/* Initial avatar */}
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                              sel ? "bg-[#0f2744] text-white" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {sel ? (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              c.full_name?.[0]?.toUpperCase() ?? "?"
                            )}
                          </div>

                          {/* Name + role + email */}
                          <div className="min-w-0 flex-1">
                            <div className={`truncate font-semibold ${sel ? "text-[#0f2744]" : "text-slate-900"}`}>
                              {c.full_name}
                            </div>
                            {c.role_label && (
                              <div className="truncate text-xs text-slate-500">{c.role_label}</div>
                            )}
                            {c.email && (
                              <div className={`truncate text-xs ${sel ? "text-[#0f2744]/60" : "text-slate-400"}`}>
                                {c.email}
                              </div>
                            )}
                          </div>

                          {/* Source pill */}
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                              c.source === "group"
                                ? "bg-slate-100 text-slate-500"
                                : "bg-indigo-50 text-indigo-600"
                            }`}
                          >
                            {c.source === "group" ? "Group" : c.source_label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                    No contacts registered in this group yet.
                  </div>
                )}

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-[11px] font-medium text-slate-400">or add a new contact</span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>

                {/* New contact toggle button */}
                <button
                  type="button"
                  onClick={() => {
                    setAddNew((p) => !p);
                    setSelectedContactId(null);
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                    addNew
                      ? "border-slate-300 bg-slate-50"
                      : "border-dashed border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold transition ${
                      addNew ? "border-[#0f2744] bg-[#0f2744] text-white" : "border-slate-300 text-slate-300"
                    }`}>
                      {addNew ? (
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : "+"}
                    </div>
                    <span className={addNew ? "font-semibold text-slate-800" : ""}>
                      New contact not in the list
                    </span>
                  </div>
                </button>

                {addNew && (
                  <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                    <FieldWrap label="Full Name *" span={2}>
                      <input
                        className={inputCls}
                        placeholder="Marie Dupont"
                        value={newContact.full_name}
                        onChange={(e) => setNewContact((p) => ({ ...p, full_name: e.target.value }))}
                      />
                    </FieldWrap>
                    <FieldWrap label="Email *">
                      <input
                        type="email"
                        className={inputCls}
                        placeholder="marie@avocarbon.com"
                        value={newContact.email}
                        onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))}
                      />
                    </FieldWrap>
                    <FieldWrap label="Phone">
                      <input
                        className={inputCls}
                        placeholder="+33 1 23 45 67 89"
                        value={newContact.phone}
                        onChange={(e) => setNewContact((p) => ({ ...p, phone: e.target.value }))}
                      />
                    </FieldWrap>
                    <FieldWrap label="Role / Function" span={2}>
                      <input
                        className={inputCls}
                        placeholder="e.g. Commodity Buyer, Quality Engineer"
                        value={newContact.role_label}
                        onChange={(e) => setNewContact((p) => ({ ...p, role_label: e.target.value }))}
                      />
                    </FieldWrap>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 4 — Owner */}
        {step === 4 && (
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Supplier Owner Assignment</h4>
              <p className="mt-1 text-xs text-slate-500">
                The Avocarbon buyer or commodity leader responsible for this relation.
              </p>
            </div>

            <FieldWrap label="Owner email *">
              <input
                type="email"
                className={inputCls}
                placeholder="name@avocarbon.com"
                value={supplierOwner}
                onChange={(e) => setSupplierOwner(e.target.value)}
              />
            </FieldWrap>

            {/* Notice: using group default */}
            {supplierScope === "global" && groupOwner && supplierOwner === groupOwner && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Using the global owner configured on the supplier group. Edit to override for this relation only.
              </div>
            )}

            {/* Notice: overriding group default */}
            {supplierScope === "global" && groupOwner && supplierOwner !== groupOwner && supplierOwner.trim() !== "" && (
              <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <div className="flex items-center gap-2">
                  <svg className="h-3.5 w-3.5 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Overriding group default for this relation.
                </div>
                <button
                  type="button"
                  className="ml-3 font-semibold text-amber-700 underline hover:text-amber-900"
                  onClick={() => setSupplierOwner(groupOwner)}
                >
                  Reset
                </button>
              </div>
            )}

          </div>
        )}

        {/* Step 5 — Review */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SummaryTile
                label="Supplier Unit"
                primary={resolvedUnit?.supplier_code ?? "—"}
                secondary={[resolvedUnit?.city, resolvedUnit?.country].filter(Boolean).join(", ")}
              />
              <SummaryTile
                label="Plant"
                primary={resolvedSite?.site_name ?? "—"}
                secondary={[resolvedSite?.city, resolvedSite?.country].filter(Boolean).join(", ")}
              />
            </div>

            {/* Contact summary */}
            {(selectedContactId !== null || (addNew && newContact.full_name)) && (() => {
              const c = addNew ? null : allContacts.find((x) => x.id_contact === selectedContactId);
              const name = addNew ? newContact.full_name : c?.full_name ?? "";
              const role = addNew ? newContact.role_label : c?.role_label ?? "";
              const email = addNew ? newContact.email : c?.email ?? "";
              const tag = addNew ? "New contact" : c?.source === "group" ? "Group" : c?.source_label ?? "";
              return (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    External Contact — {groupName}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0f2744] text-sm font-bold text-white">
                      {name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{name}</div>
                      {role && <div className="text-xs text-slate-500">{role}</div>}
                      {email && <div className="text-xs text-slate-400">{email}</div>}
                    </div>
                    <span className="ml-auto rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                      {tag}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <ReviewRow label="Owner" value={supplierOwner || "—"} />
              <ReviewRow label="Scope" value={supplierScope || "—"} last />
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
          <div>
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}
          </div>

          <div>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
                className={`flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                  canNext()
                    ? "bg-amber-400 text-slate-900 hover:bg-amber-500 shadow-sm"
                    : "cursor-not-allowed bg-slate-100 text-slate-400"
                }`}
              >
                Continue
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create Relation"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SearchInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}> = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <svg
      className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3.5 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-[#0f2744]/40 focus:bg-white focus:ring-4 focus:ring-[#0f2744]/8"
    />
  </div>
);

const PickList: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
    {children}
  </div>
);

const PickItem: React.FC<{
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ selected, onClick, children }) => (
  <button
    onClick={onClick}
    className={`flex w-full flex-col gap-0.5 border-b border-slate-50 px-4 py-3 text-left transition last:border-b-0 ${
      selected
        ? "bg-[#0f2744]/5 border-l-2 border-l-[#0f2744]"
        : "bg-white hover:bg-slate-50 border-l-2 border-l-transparent"
    }`}
  >
    {children}
  </button>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="px-4 py-10 text-center text-sm text-slate-400">{message}</div>
);

const SummaryTile: React.FC<{
  label: string;
  primary: string;
  secondary: string;
}> = ({ label, primary, secondary }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className="mt-1.5 text-base font-bold text-slate-900">{primary}</p>
    {secondary && <p className="mt-0.5 text-xs text-slate-500">{secondary}</p>}
  </div>
);

const ReviewRow: React.FC<{
  label: string;
  value: string;
  last?: boolean;
}> = ({ label, value, last }) => (
  <div
    className={`flex items-center justify-between px-4 py-3 text-sm ${
      last ? "" : "border-b border-slate-100"
    }`}
  >
    <span className="text-slate-500">{label}</span>
    <span className="font-semibold text-slate-900">{value}</span>
  </div>
);

const FieldWrap: React.FC<{
  label: string;
  span?: 1 | 2;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, span, hint, children }) => (
  <div className={span === 2 ? "sm:col-span-2" : ""}>
    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
      {label}
    </label>
    {children}
    {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
  </div>
);
