/**
 * SupplierManagement - Phase 2 workspace for unit and site assignment
 */

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AvocarbonSite,
  DevelopmentPlanRegisterRow,
  RelationEvaluationWorkspace,
  SupplierDevelopmentPlan,
  SupplierSiteRelation,
  SupplierStatusOverride,
  UnitEvaluationSummary,
  SupplierUnitResponse,
} from "../../types/onboarding";
import { supplierAPI } from "../../services/supplierOnboardingAPI";
import {
  SharedMarkReceivedModal,
  SharedRequestRevisionModal,
  SharedReviewDecisionModal,
  SharedSendRequestModal,
  SharedSubmitForReviewModal,
  SharedViewDetailsModal,
} from "../development-plans/SendRequestModal";
import { RelationDetailsModal } from "./RelationDetailsModal";
import { FlowB } from "./flows/FlowB";
import { FlowC } from "./flows/FlowC";
import { UnitSiteRelationsPanel } from "./UnitSiteRelationsPanel";
import { MetricCard, PageIntro, SectionCard } from "../UI";

export type ActiveFlow = "assign" | "createUnit" | null;

export interface SupplierManagementProps {
  groupId: number;
  groupName: string;
  initialGroupScope?: string | null;
  initialGroupOwner?: string | null;
  onClose?: () => void;
}

interface SharedState {
  groupScope: string | null;
  groupOwner: string | null;
  units: SupplierUnitResponse[];
  evaluationSummaryByUnit: Record<number, UnitEvaluationSummary>;
  availableSites: AvocarbonSite[];
  selectedUnit: SupplierUnitResponse | null;
  siteRelations: SupplierSiteRelation[];
  isLoadingUnits: boolean;
  isLoadingSites: boolean;
  isLoadingRelations: boolean;
  error: string | null;
}

type DevelopmentPlanFormState = {
  plan_title: string;
  plan_status: string;
  issue_date: string;
  due_date: string;
  submission_date: string;
  review_date: string;
  decision_date: string;
  reviewed_by: string;
  approved_by: string;
  rejected_by: string;
  business_hold_active: string;
  escalated: boolean;
  escalation_date: string;
  file_name: string;
  file_url: string;
  file_notes: string;
  supplier_comments: string;
  internal_comments: string;
  sync_relation_hold_status: boolean;
};

const createEmptyDevelopmentPlanForm = (): DevelopmentPlanFormState => ({
  plan_title: "",
  plan_status: "Requested",
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: "",
  submission_date: "",
  review_date: "",
  decision_date: "",
  reviewed_by: "",
  approved_by: "",
  rejected_by: "",
  business_hold_active: "true",
  escalated: false,
  escalation_date: "",
  file_name: "",
  file_url: "",
  file_notes: "",
  supplier_comments: "",
  internal_comments: "",
  sync_relation_hold_status: true,
});

const mapDevelopmentPlanToForm = (
  plan: SupplierDevelopmentPlan,
): DevelopmentPlanFormState => ({
  plan_title: plan.plan_title || "",
  plan_status: plan.plan_status || "",
  issue_date: plan.issue_date || "",
  due_date: plan.due_date || "",
  submission_date: plan.submission_date || "",
  review_date: plan.review_date || "",
  decision_date: plan.decision_date || "",
  reviewed_by: plan.reviewed_by || "",
  approved_by: plan.approved_by || "",
  rejected_by: plan.rejected_by || "",
  business_hold_active:
    plan.business_hold_active === null || plan.business_hold_active === undefined
      ? ""
      : String(plan.business_hold_active),
  escalated: Boolean(plan.escalated),
  escalation_date: plan.escalation_date || "",
  file_name: plan.file_name || "",
  file_url: plan.file_url || "",
  file_notes: plan.file_notes || "",
  supplier_comments: plan.supplier_comments || "",
  internal_comments: plan.internal_comments || "",
  sync_relation_hold_status: true,
});

const toNullableString = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toNullableDate = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const parseEmails = (raw: string) =>
  raw
    .split(/[,;\s]+/)
    .map((email) => email.trim())
    .filter(Boolean);
const validateEmails = (list: string[]) => list.every((email) => EMAIL_RE.test(email));

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

const getAutoPlanTitle = (relation: SupplierSiteRelation) => {
  const relationCode =
    relation.relation_code || `REL-${String(relation.id_relation).padStart(6, "0")}`;
  return `Development plan required - ${relationCode}`;
};

const isClosedPlanStatus = (status?: string | null) => {
  const normalized = (status || "").trim().toLowerCase();
  return ["approved", "closed", "cancelled", "rejected"].includes(normalized);
};

export const SupplierManagement: React.FC<SupplierManagementProps> = ({
  groupId,
  groupName,
  initialGroupScope,
  initialGroupOwner,
  onClose,
}) => {
  const navigate = useNavigate();
  const [activeFlow, setActiveFlow] = useState<ActiveFlow>(null);
  const [overrideModalRelation, setOverrideModalRelation] =
    useState<SupplierSiteRelation | null>(null);
  const [overrideWorkspace, setOverrideWorkspace] =
    useState<RelationEvaluationWorkspace | null>(null);
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideDate, setOverrideDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [isLoadingOverride, setIsLoadingOverride] = useState(false);
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const [planModalRelation, setPlanModalRelation] =
    useState<SupplierSiteRelation | null>(null);
  const [developmentPlans, setDevelopmentPlans] = useState<
    SupplierDevelopmentPlan[]
  >([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [developmentPlanForm, setDevelopmentPlanForm] =
    useState<DevelopmentPlanFormState>(createEmptyDevelopmentPlanForm());
  const [isLoadingDevelopmentPlans, setIsLoadingDevelopmentPlans] =
    useState(false);
  const [isSavingDevelopmentPlan, setIsSavingDevelopmentPlan] = useState(false);
  const [developmentPlanFile, setDevelopmentPlanFile] = useState<File | null>(
    null,
  );
  const [isUploadingDevelopmentPlanFile, setIsUploadingDevelopmentPlanFile] =
    useState(false);
  const [autoPlanRelationId, setAutoPlanRelationId] = useState<number | null>(
    null,
  );
  const [activeDetailsRelationId, setActiveDetailsRelationId] = useState<
    number | null
  >(null);
  const [detailsModalRelation, setDetailsModalRelation] =
    useState<SupplierSiteRelation | null>(null);
  const [detailsWorkspace, setDetailsWorkspace] =
    useState<RelationEvaluationWorkspace | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [sendPlanItem, setSendPlanItem] =
    useState<DevelopmentPlanRegisterRow | null>(null);
  const [planWorkflowStep, setPlanWorkflowStep] = useState<
    "send" | "received" | "review" | "decision" | "revision" | "details"
  >("send");
  const [developmentPlanRequestError, setDevelopmentPlanRequestError] =
    useState<string | null>(null);
  const [developmentPlanRequestTo, setDevelopmentPlanRequestTo] = useState("");
  const [developmentPlanRequestCc, setDevelopmentPlanRequestCc] = useState("");
  const [developmentPlanRequestMessage, setDevelopmentPlanRequestMessage] =
    useState("");
  const [developmentPlanOverrideRecipients, setDevelopmentPlanOverrideRecipients] =
    useState(false);
  const [isSendingDevelopmentPlanRequest, setIsSendingDevelopmentPlanRequest] =
    useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [shared, setShared] = useState<SharedState>({
    groupScope: initialGroupScope ?? null,
    groupOwner: initialGroupOwner ?? null,
    units: [],
    evaluationSummaryByUnit: {},
    availableSites: [],
    selectedUnit: null,
    siteRelations: [],
    isLoadingUnits: false,
    isLoadingSites: false,
    isLoadingRelations: false,
    error: null,
  });

  const setError = (error: string | null) =>
    setShared((prev) => ({ ...prev, error }));

  const resetDevelopmentPlanRequestFields = useCallback(
    (relation?: SupplierSiteRelation | null) => {
      setDevelopmentPlanRequestError(null);
      setDevelopmentPlanRequestTo("");
      setDevelopmentPlanRequestCc(relation?.supplier_owner || "");
      setDevelopmentPlanRequestMessage("");
      setDevelopmentPlanOverrideRecipients(false);
    },
    [],
  );

  const loadUnits = useCallback(async () => {
    setShared((prev) => ({ ...prev, isLoadingUnits: true, error: null }));
    try {
      const response = await supplierAPI.listUnitsForGroup(groupId);
      setShared((prev) => ({
        ...prev,
        units: response.data?.units || [],
        isLoadingUnits: false,
      }));
      const loadedUnits: SupplierUnitResponse[] = response.data?.units || [];
      const summaries = await Promise.all(
        loadedUnits.map(async (unit) => {
          try {
            const summaryResponse = await supplierAPI.getUnitEvaluationSummary(
              unit.id_supplier_unit
            );
            return [unit.id_supplier_unit, summaryResponse.data] as const;
          } catch {
            return [
              unit.id_supplier_unit,
              {
                unit_id: unit.id_supplier_unit,
                site_relations_count: 0,
              } as UnitEvaluationSummary,
            ] as const;
          }
        })
      );
      setShared((prev) => ({
        ...prev,
        evaluationSummaryByUnit: Object.fromEntries(summaries),
      }));
    } catch (error) {
      setShared((prev) => ({
        ...prev,
        isLoadingUnits: false,
        error: error instanceof Error ? error.message : "Failed to load units",
      }));
    }
  }, [groupId]);

  const loadGroupContext = useCallback(async () => {
    try {
      const response = await supplierAPI.getSupplierGroup(groupId);
      setShared((prev) => ({
        ...prev,
        groupScope: response.data?.supplier_scope || prev.groupScope || null,
        groupOwner: response.data?.supplier_owner || prev.groupOwner || null,
      }));
    } catch {
      setShared((prev) => ({
        ...prev,
        groupScope: prev.groupScope || null,
        groupOwner: prev.groupOwner || null,
      }));
    }
  }, [groupId]);

  const loadSites = useCallback(async () => {
    setShared((prev) => ({ ...prev, isLoadingSites: true }));
    try {
      const response = await supplierAPI.listSites();
      const availableSites = Array.isArray(response.data) ? response.data : [];
      setShared((prev) => ({
        ...prev,
        availableSites,
        isLoadingSites: false,
      }));
    } catch {
      setShared((prev) => ({
        ...prev,
        availableSites: [],
        isLoadingSites: false,
      }));
    }
  }, []);

  const loadRelationsForUnit = useCallback(async (unitId: number) => {
    setShared((prev) => ({ ...prev, isLoadingRelations: true }));
    try {
      const response = await supplierAPI.listSitesForUnit(unitId);
      setShared((prev) => ({
        ...prev,
        siteRelations: response.data?.relations || [],
        isLoadingRelations: false,
      }));
    } catch {
      setShared((prev) => ({
        ...prev,
        siteRelations: [],
        isLoadingRelations: false,
      }));
    }
  }, []);

  const selectUnit = useCallback(
    (unit: SupplierUnitResponse) => {
      setShared((prev) => ({ ...prev, selectedUnit: unit }));
      loadRelationsForUnit(unit.id_supplier_unit);
    },
    [loadRelationsForUnit],
  );

  const handleRelationUnlink = async (relation: SupplierSiteRelation) => {
    if (!window.confirm("Remove this site relation?")) {
      return;
    }

    try {
      await supplierAPI.unlinkUnitFromSite(
        relation.id_supplier_unit,
        relation.id_site,
      );
      if (shared.selectedUnit) {
        await loadRelationsForUnit(shared.selectedUnit.id_supplier_unit);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to unlink");
    }
  };

  const openOverrideModal = useCallback(async (relation: SupplierSiteRelation) => {
    setOverrideModalRelation(relation);
    setIsLoadingOverride(true);
    setOverrideWorkspace(null);
    setOverrideReason("");
    setOverrideDate(new Date().toISOString().slice(0, 10));
    try {
      const response = await supplierAPI.getRelationEvaluationWorkspace(
        relation.id_relation,
      );
      const workspace = response.data as RelationEvaluationWorkspace;
      setOverrideWorkspace(workspace);
      setOverrideStatus(
        workspace.effective_supplier_status ||
          relation.supplier_status ||
          workspace.computed_supplier_status ||
          "",
      );
      setOverrideReason(workspace.status_override?.reason || "");
      setOverrideDate(
        workspace.status_override?.changed_at
          ? new Date(workspace.status_override.changed_at)
              .toISOString()
              .slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load supplier status override data",
      );
    } finally {
      setIsLoadingOverride(false);
    }
  }, []);

  const closeOverrideModal = () => {
    setOverrideModalRelation(null);
    setOverrideWorkspace(null);
    setOverrideReason("");
  };

  const openRelationDetailsModal = useCallback(
    async (relation: SupplierSiteRelation) => {
      setActiveDetailsRelationId(relation.id_relation);
      setDetailsModalRelation(relation);
      setDetailsWorkspace(null);
      setIsLoadingDetails(true);
      setError(null);
      try {
        const response = await supplierAPI.getRelationEvaluationWorkspace(
          relation.id_relation,
        );
        setDetailsWorkspace(response.data as RelationEvaluationWorkspace);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load relation details.",
        );
        setDetailsModalRelation(null);
      } finally {
        setIsLoadingDetails(false);
        setActiveDetailsRelationId(null);
      }
    },
    [],
  );

  const closeRelationDetailsModal = useCallback(() => {
    setDetailsModalRelation(null);
    setDetailsWorkspace(null);
    setIsLoadingDetails(false);
  }, []);

  const openDevelopmentPlanModal = useCallback(
    async (relation: SupplierSiteRelation, createDraftIfMissing = false) => {
      setPlanModalRelation(relation);
      setIsLoadingDevelopmentPlans(true);
      setSelectedPlanId(null);
      setDevelopmentPlanForm(createEmptyDevelopmentPlanForm());
      resetDevelopmentPlanRequestFields(relation);
      try {
        const today = new Date();
        const defaultIssueDate = toDateInputValue(today);
        const defaultDueDate = toDateInputValue(addDays(today, 30));
        const defaultPlanTitle = getAutoPlanTitle(relation);

        const response = await supplierAPI.listRelationDevelopmentPlans(relation.id_relation);
        let items = (response.data?.items || []) as SupplierDevelopmentPlan[];
        let selectedPlan =
          items.find((plan) => !isClosedPlanStatus(plan.plan_status)) || items[0] || null;

        if (!selectedPlan && createDraftIfMissing) {
          const createdResponse = await supplierAPI.createRelationDevelopmentPlan(
            relation.id_relation,
            {
              plan_title: defaultPlanTitle,
              plan_status: "Must be send",
              issue_date: defaultIssueDate,
              due_date: defaultDueDate,
              business_hold_active: true,
              internal_comments: "Auto-created from the supplier relation workspace.",
              sync_relation_hold_status: true,
              changed_by: "UI",
            },
          );
          selectedPlan = createdResponse.data as SupplierDevelopmentPlan;
          items = [selectedPlan, ...items];
        }

        setDevelopmentPlans(items);
        if (selectedPlan) {
          setSelectedPlanId(selectedPlan.id_development_plan);
          setDevelopmentPlanForm({
            ...mapDevelopmentPlanToForm(selectedPlan),
            plan_title: selectedPlan.plan_title || defaultPlanTitle,
            plan_status: selectedPlan.plan_status || "Must be send",
            issue_date: selectedPlan.issue_date || defaultIssueDate,
            due_date: selectedPlan.due_date || defaultDueDate,
          });
        }
        return selectedPlan;
      } catch (error) {
        setDevelopmentPlans([]);
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load supplier development plans",
        );
      } finally {
        setIsLoadingDevelopmentPlans(false);
      }
    },
    [resetDevelopmentPlanRequestFields],
  );

  const closeDevelopmentPlanModal = () => {
    setPlanModalRelation(null);
    setDevelopmentPlans([]);
    setSelectedPlanId(null);
    setDevelopmentPlanForm(createEmptyDevelopmentPlanForm());
    setDevelopmentPlanFile(null);
    resetDevelopmentPlanRequestFields(null);
  };

  const prepareDevelopmentPlanModal = useCallback(
    async (relation: SupplierSiteRelation) => {
      setAutoPlanRelationId(relation.id_relation);
      setError(null);
      setSuccessMessage(null);
      try {
        const today = new Date();
        const defaultIssueDate = toDateInputValue(today);
        const defaultDueDate = toDateInputValue(addDays(today, 30));
        const defaultPlanTitle = getAutoPlanTitle(relation);
        const response = await supplierAPI.listRelationDevelopmentPlans(
          relation.id_relation,
        );
        const plans = (response.data?.items || []) as SupplierDevelopmentPlan[];
        const selectedPlan =
          plans.find((plan) => !isClosedPlanStatus(plan.plan_status)) || null;
        const site = shared.availableSites.find(
          (item) => item.id_site === relation.id_site,
        );
        setSendPlanItem({
          relation,
          development_plan:
            selectedPlan || {
              id_development_plan: 0,
              id_relation: relation.id_relation,
              plan_title: defaultPlanTitle,
              plan_status: "Must be send",
              issue_date: defaultIssueDate,
              due_date: defaultDueDate,
            },
          site_name: site?.site_name ?? null,
          site_city: site?.city ?? null,
          site_country: site?.country ?? null,
          unit_supplier_code: shared.selectedUnit?.supplier_code ?? null,
          unit_code: shared.selectedUnit?.unit_code ?? null,
          group_id: groupId,
          group_name: groupName,
          group_code: null,
        });
        setPlanWorkflowStep(
          ((status: string) => {
            if (status === "request sent") return "received";
            if (status === "received") return "review";
            if (status === "under review") return "decision";
            if (status === "rejected") return "revision";
            if (status && status !== "must be send") return "details";
            return "send";
          })((selectedPlan?.plan_status || "").toLowerCase()),
        );
      } catch {
        setError("Failed to open the development plan workflow.");
      } finally {
        setAutoPlanRelationId(null);
      }
    },
    [groupId, groupName, shared.availableSites, shared.selectedUnit],
  );

  const refreshDevelopmentPlans = useCallback(
    async (relationId: number, preferredPlanId?: number | null) => {
      const response = await supplierAPI.listRelationDevelopmentPlans(relationId);
      const items = (response.data?.items || []) as SupplierDevelopmentPlan[];
      setDevelopmentPlans(items);
      const selected =
        items.find((item) => item.id_development_plan === preferredPlanId) ||
        items[0] ||
        null;
      if (selected) {
        setSelectedPlanId(selected.id_development_plan);
        setDevelopmentPlanForm(mapDevelopmentPlanToForm(selected));
      } else {
        setSelectedPlanId(null);
        setDevelopmentPlanForm(createEmptyDevelopmentPlanForm());
      }
      return items;
    },
    [],
  );

  const upsertDevelopmentPlan = useCallback(async () => {
    if (!planModalRelation) return null;
    const payload = {
      plan_title: toNullableString(developmentPlanForm.plan_title),
      plan_status: toNullableString(developmentPlanForm.plan_status),
      issue_date: toNullableDate(developmentPlanForm.issue_date),
      due_date: toNullableDate(developmentPlanForm.due_date),
      submission_date: toNullableDate(developmentPlanForm.submission_date),
      review_date: toNullableDate(developmentPlanForm.review_date),
      decision_date: toNullableDate(developmentPlanForm.decision_date),
      reviewed_by: toNullableString(developmentPlanForm.reviewed_by),
      approved_by: toNullableString(developmentPlanForm.approved_by),
      rejected_by: toNullableString(developmentPlanForm.rejected_by),
      business_hold_active:
        developmentPlanForm.business_hold_active === ""
          ? null
          : developmentPlanForm.business_hold_active === "true",
      escalated: developmentPlanForm.escalated,
      escalation_date: toNullableDate(developmentPlanForm.escalation_date),
      file_name: toNullableString(developmentPlanForm.file_name),
      file_url: toNullableString(developmentPlanForm.file_url),
      file_notes: toNullableString(developmentPlanForm.file_notes),
      supplier_comments: toNullableString(developmentPlanForm.supplier_comments),
      internal_comments: toNullableString(developmentPlanForm.internal_comments),
      sync_relation_hold_status: developmentPlanForm.sync_relation_hold_status,
      changed_by: "UI",
    };

    const result = selectedPlanId
      ? await supplierAPI.updateRelationDevelopmentPlan(
          planModalRelation.id_relation,
          selectedPlanId,
          payload,
        )
      : await supplierAPI.createRelationDevelopmentPlan(
          planModalRelation.id_relation,
          payload,
        );

    const savedPlan = result.data as SupplierDevelopmentPlan;
    await refreshDevelopmentPlans(
      planModalRelation.id_relation,
      savedPlan.id_development_plan,
    );
    return savedPlan;
  }, [
    developmentPlanForm,
    planModalRelation,
    refreshDevelopmentPlans,
    selectedPlanId,
  ]);

  const saveDevelopmentPlan = async () => {
    if (!planModalRelation) return;
    setIsSavingDevelopmentPlan(true);
    try {
      setDevelopmentPlanRequestError(null);
      await upsertDevelopmentPlan();
      if (shared.selectedUnit) {
        await loadRelationsForUnit(shared.selectedUnit.id_supplier_unit);
        await loadUnits();
      }
      setDevelopmentPlanFile(null);
    } catch (error) {
      setDevelopmentPlanRequestError(
        error instanceof Error
          ? error.message
          : "Failed to save supplier development plan",
      );
    } finally {
      setIsSavingDevelopmentPlan(false);
    }
  };

  const sendDevelopmentPlanRequest = async () => {
    if (!planModalRelation) return;
    if (!developmentPlanForm.due_date.trim()) {
      setDevelopmentPlanRequestError(
        "A due date is required before sending the request email.",
      );
      return;
    }

    const toEmails = parseEmails(developmentPlanRequestTo);
    if (developmentPlanOverrideRecipients && !toEmails.length) {
      setDevelopmentPlanRequestError("Enter at least one recipient email.");
      return;
    }
    if (toEmails.length && !validateEmails(toEmails)) {
      setDevelopmentPlanRequestError(
        "One or more recipient email addresses are invalid.",
      );
      return;
    }

    const ccEmails = parseEmails(developmentPlanRequestCc);
    if (ccEmails.length && !validateEmails(ccEmails)) {
      setDevelopmentPlanRequestError(
        "One or more CC email addresses are invalid.",
      );
      return;
    }

    setIsSendingDevelopmentPlanRequest(true);
    setDevelopmentPlanRequestError(null);
    try {
      const savedPlan = await upsertDevelopmentPlan();
      if (!savedPlan) return;

      await supplierAPI.sendRelationDevelopmentPlanRequest(
        planModalRelation.id_relation,
        savedPlan.id_development_plan,
        {
          custom_message: developmentPlanRequestMessage.trim() || undefined,
          to_emails:
            developmentPlanOverrideRecipients && toEmails.length
              ? toEmails
              : undefined,
          extra_cc_emails: ccEmails.length ? ccEmails : undefined,
          changed_by: "UI",
        },
      );

      await refreshDevelopmentPlans(
        planModalRelation.id_relation,
        savedPlan.id_development_plan,
      );
      if (shared.selectedUnit) {
        await loadRelationsForUnit(shared.selectedUnit.id_supplier_unit);
        await loadUnits();
      }

      setSuccessMessage("Development plan email sent to the supplier.");
      closeDevelopmentPlanModal();
    } catch (error) {
      setDevelopmentPlanRequestError(
        error instanceof Error
          ? error.message
          : "Failed to send the development plan request email.",
      );
    } finally {
      setIsSendingDevelopmentPlanRequest(false);
    }
  };

  const uploadDevelopmentPlanFile = async () => {
    if (!planModalRelation || !selectedPlanId || !developmentPlanFile) {
      setError("Create or select a development plan before uploading a file.");
      return;
    }
    setIsUploadingDevelopmentPlanFile(true);
    try {
      await supplierAPI.uploadRelationDevelopmentPlanDocument(
        planModalRelation.id_relation,
        selectedPlanId,
        developmentPlanFile,
        developmentPlanForm.file_notes || undefined,
      );
      const response = await supplierAPI.listRelationDevelopmentPlans(
        planModalRelation.id_relation,
      );
      const items = (response.data?.items || []) as SupplierDevelopmentPlan[];
      setDevelopmentPlans(items);
      const updatedPlan = items.find(
        (item) => item.id_development_plan === selectedPlanId,
      );
      if (updatedPlan) {
        setDevelopmentPlanForm(mapDevelopmentPlanToForm(updatedPlan));
      }
      setDevelopmentPlanFile(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to upload development plan file",
      );
    } finally {
      setIsUploadingDevelopmentPlanFile(false);
    }
  };

  const saveOverride = async () => {
    if (!overrideModalRelation) return;
    if (!overrideStatus.trim() || !overrideReason.trim()) {
      setError("Override status and reason are required.");
      return;
    }

    setIsSavingOverride(true);
    try {
      await supplierAPI.overrideRelationSupplierStatus(
        overrideModalRelation.id_relation,
        {
          supplier_status: overrideStatus,
          reason: overrideReason,
          override_date: overrideDate ? `${overrideDate}T00:00:00` : undefined,
        },
      );
      if (shared.selectedUnit) {
        await loadRelationsForUnit(shared.selectedUnit.id_supplier_unit);
        await loadUnits();
      }
      closeOverrideModal();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to override supplier status",
      );
    } finally {
      setIsSavingOverride(false);
    }
  };

  useEffect(() => {
    loadGroupContext();
    loadUnits();
    loadSites();
  }, [loadGroupContext, loadSites, loadUnits]);

  const selectedSummary = shared.selectedUnit
    ? shared.evaluationSummaryByUnit[shared.selectedUnit.id_supplier_unit] ?? null
    : null;

  return (
    <div className="flex w-full flex-col gap-5 pb-8">

      <PageIntro
        eyebrow="Unit & Site Workspace"
        title={groupName}
        description="Manage units, assign to Avocarbon plants and configure owner & scope."
        actions={
          <div className="flex items-center gap-3">
            <div className="flex gap-3">
              {[
                { label: "Units", value: shared.units.length },
                { label: "Relations", value: shared.siteRelations.length },
                { label: "Grade", value: selectedSummary?.final_grade ?? "—" },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-center">
                  <div className="text-base font-bold text-white">{m.value}</div>
                  <div className="text-[10px] font-medium text-blue-200/80">{m.label}</div>
                </div>
              ))}
            </div>
            {onClose && (
              <button onClick={onClose}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20">
                ← Back
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-4 px-4 sm:px-6">

      {/* ── Error banner ── */}
      {shared.error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{shared.error}</span>
          <button onClick={() => setError(null)}
            className="ml-4 flex h-6 w-6 items-center justify-center rounded-full text-red-400 transition hover:bg-red-100">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-4 flex h-6 w-6 items-center justify-center rounded-full text-emerald-500 transition hover:bg-emerald-100"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Two-column workspace ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">

        {/* ════════════════════════════════════════
            LEFT — Units panel
            ════════════════════════════════════════ */}
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Panel header + Add Unit button */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Supplier Units</h2>
                <p className="text-xs text-slate-400">
                  {shared.units.length} unit{shared.units.length !== 1 ? "s" : ""} · select one to view its plant relations
                </p>
              </div>
              <div className="flex items-center gap-2">
                {shared.isLoadingUnits && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-[#062B49]" />
                )}
                <button
                  onClick={() => setActiveFlow(activeFlow === "createUnit" ? null : "createUnit")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeFlow === "createUnit"
                      ? "bg-[#062B49] text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-[#062B49]/30 hover:text-[#062B49]"
                  }`}
                >
                  {activeFlow === "createUnit" ? (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Unit
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="border-b border-slate-100 px-4 py-3">
              <UnitSearchBox units={shared.units} onSelect={selectUnit}
                selectedUnitId={shared.selectedUnit?.id_supplier_unit ?? null} />
            </div>

            {/* Unit list */}
            <div className="overflow-y-auto" style={{ maxHeight: 460 }}>
              {shared.units.length === 0 && !shared.isLoadingUnits ? (
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600">No units yet</p>
                    <p className="mt-0.5 text-xs text-slate-400">Click "Add Unit" to create the first one.</p>
                  </div>
                </div>
              ) : (
                shared.units.map((unit) => (
                  <UnitCard key={unit.id_supplier_unit} unit={unit}
                    summary={shared.evaluationSummaryByUnit[unit.id_supplier_unit]}
                    isSelected={shared.selectedUnit?.id_supplier_unit === unit.id_supplier_unit}
                    onClick={() => selectUnit(unit)} />
                ))
              )}
            </div>
          </div>

          {/* FlowC — inline below the unit list */}
          {activeFlow === "createUnit" && (
            <FlowC groupId={groupId}
              onSuccess={async () => { await loadUnits(); setActiveFlow(null); }}
              onCancel={() => setActiveFlow(null)}
            />
          )}
        </div>

        {/* ════════════════════════════════════════
            RIGHT — Relations panel
            ════════════════════════════════════════ */}
        <div className="flex flex-col gap-4">
          {/* FlowB — inline above the relations panel */}
          {activeFlow === "assign" && (
            <FlowB
              groupId={groupId} groupName={groupName}
              units={shared.units} availableSites={shared.availableSites}
              selectedUnit={shared.selectedUnit}
              groupScope={shared.groupScope} groupOwner={shared.groupOwner}
              onSuccess={async (unitId) => { await loadUnits(); await loadRelationsForUnit(unitId); setActiveFlow(null); }}
              onCancel={() => setActiveFlow(null)}
            />
          )}

          <UnitSiteRelationsPanel
            selectedUnit={shared.selectedUnit}
            siteRelations={shared.siteRelations}
            summary={selectedSummary}
            availableSites={shared.availableSites}
            isLoading={shared.isLoadingRelations}
            onAssignToPlant={
              shared.selectedUnit
                ? () => setActiveFlow(activeFlow === "assign" ? null : "assign")
                : undefined
            }
            assignActive={activeFlow === "assign"}
            onEvaluate={(relation) => navigate(`/supplier-relations/${relation.id_relation}/evaluation`)}
            onManageDevelopmentPlan={prepareDevelopmentPlanModal}
            onViewRelationDetails={openRelationDetailsModal}
            onOverrideStatus={openOverrideModal}
            onUnlink={handleRelationUnlink}
            onRelinkSuccess={() => shared.selectedUnit && loadRelationsForUnit(shared.selectedUnit.id_supplier_unit)}
            activeDevelopmentPlanRelationId={autoPlanRelationId}
            activeDetailsRelationId={activeDetailsRelationId}
          />
        </div>
      </div>

      {overrideModalRelation && (
        <StatusOverrideModal
          relation={overrideModalRelation}
          workspace={overrideWorkspace}
          status={overrideStatus}
          reason={overrideReason}
          overrideDate={overrideDate}
          isLoading={isLoadingOverride}
          isSaving={isSavingOverride}
          onClose={closeOverrideModal}
          onStatusChange={setOverrideStatus}
          onReasonChange={setOverrideReason}
          onDateChange={setOverrideDate}
          onSubmit={saveOverride}
        />
      )}

      {detailsModalRelation && (
        <RelationDetailsModal
          workspace={detailsWorkspace}
          site={
            shared.availableSites.find(
              (item) => item.id_site === detailsModalRelation.id_site,
            ) ?? null
          }
          unit={shared.selectedUnit}
          groupName={groupName}
          isLoading={isLoadingDetails}
          onClose={closeRelationDetailsModal}
        />
      )}

      {sendPlanItem && (
        <>
          {planWorkflowStep === "send" ? (
            <SharedSendRequestModal
              item={sendPlanItem}
              onClose={() => {
                setSendPlanItem(null);
                closeDevelopmentPlanModal();
              }}
              onEnsurePlan={async ({ planTitle, dueDate }) => {
                const createdResponse = await supplierAPI.createRelationDevelopmentPlan(
                  sendPlanItem.relation.id_relation,
                  {
                    plan_title: planTitle || getAutoPlanTitle(sendPlanItem.relation),
                    plan_status: "Must be send",
                    issue_date: toDateInputValue(new Date()),
                    due_date: dueDate,
                    business_hold_active: true,
                    internal_comments:
                      "Created from the supplier relation workspace send-request modal.",
                    sync_relation_hold_status: true,
                    changed_by: "UI",
                  },
                );
                return {
                  ...sendPlanItem,
                  development_plan: createdResponse.data as SupplierDevelopmentPlan,
                };
              }}
              onSuccess={async () => {
                setSendPlanItem(null);
                setSuccessMessage("Development plan request email sent.");
                if (shared.selectedUnit) {
                  await loadRelationsForUnit(shared.selectedUnit.id_supplier_unit);
                  await loadUnits();
                }
                closeDevelopmentPlanModal();
              }}
            />
          ) : planWorkflowStep === "received" ? (
            <SharedMarkReceivedModal
              item={sendPlanItem}
              onClose={() => {
                setSendPlanItem(null);
                closeDevelopmentPlanModal();
              }}
              onSuccess={async () => {
                setSendPlanItem(null);
                setSuccessMessage("Plan marked as received.");
                if (shared.selectedUnit) {
                  await loadRelationsForUnit(shared.selectedUnit.id_supplier_unit);
                  await loadUnits();
                }
                closeDevelopmentPlanModal();
              }}
            />
          ) : planWorkflowStep === "review" ? (
            <SharedSubmitForReviewModal
              item={sendPlanItem}
              onClose={() => {
                setSendPlanItem(null);
                closeDevelopmentPlanModal();
              }}
              onSuccess={async () => {
                setSendPlanItem(null);
                setSuccessMessage("Plan submitted for review. Notification email sent to committee.");
                if (shared.selectedUnit) {
                  await loadRelationsForUnit(shared.selectedUnit.id_supplier_unit);
                  await loadUnits();
                }
                closeDevelopmentPlanModal();
              }}
            />
          ) : planWorkflowStep === "decision" ? (
            <SharedReviewDecisionModal
              item={sendPlanItem}
              onClose={() => {
                setSendPlanItem(null);
                closeDevelopmentPlanModal();
              }}
              onSuccess={async (result) => {
                setSendPlanItem(null);
                setSuccessMessage(
                  result === "approved"
                    ? "Plan approved."
                    : "Plan rejected. You can request a revision from the supplier.",
                );
                if (shared.selectedUnit) {
                  await loadRelationsForUnit(shared.selectedUnit.id_supplier_unit);
                  await loadUnits();
                }
                closeDevelopmentPlanModal();
              }}
            />
          ) : planWorkflowStep === "revision" ? (
            <SharedRequestRevisionModal
              item={sendPlanItem}
              onClose={() => {
                setSendPlanItem(null);
                closeDevelopmentPlanModal();
              }}
              onSuccess={async () => {
                setSendPlanItem(null);
                setSuccessMessage("Revision requested. Email sent to supplier.");
                if (shared.selectedUnit) {
                  await loadRelationsForUnit(shared.selectedUnit.id_supplier_unit);
                  await loadUnits();
                }
                closeDevelopmentPlanModal();
              }}
            />
          ) : (
            <SharedViewDetailsModal
              item={sendPlanItem}
              onClose={() => {
                setSendPlanItem(null);
                closeDevelopmentPlanModal();
              }}
              onSuccess={async () => {
                setSendPlanItem(null);
                setSuccessMessage("Plan updated.");
                if (shared.selectedUnit) {
                  await loadRelationsForUnit(shared.selectedUnit.id_supplier_unit);
                  await loadUnits();
                }
                closeDevelopmentPlanModal();
              }}
            />
          )}
        </>
      )}

      {false && planModalRelation && (
        <DevelopmentPlanModal
          relation={planModalRelation!}
          plans={developmentPlans}
          selectedPlanId={selectedPlanId}
          form={developmentPlanForm}
          isLoading={isLoadingDevelopmentPlans}
          isSaving={isSavingDevelopmentPlan}
          requestError={developmentPlanRequestError}
          requestTo={developmentPlanRequestTo}
          requestCc={developmentPlanRequestCc}
          requestMessage={developmentPlanRequestMessage}
          overrideRecipients={developmentPlanOverrideRecipients}
          uploadFile={developmentPlanFile}
          isUploadingFile={isUploadingDevelopmentPlanFile}
          isSendingRequest={isSendingDevelopmentPlanRequest}
          onClose={closeDevelopmentPlanModal}
          onSelectPlan={(plan) => {
            setSelectedPlanId(plan.id_development_plan);
            setDevelopmentPlanForm(mapDevelopmentPlanToForm(plan));
            setDevelopmentPlanRequestError(null);
          }}
          onCreateNew={() => {
            setSelectedPlanId(null);
            setDevelopmentPlanForm({
              ...createEmptyDevelopmentPlanForm(),
              plan_title: getAutoPlanTitle(planModalRelation!),
              plan_status: "Must be send",
              due_date: toDateInputValue(addDays(new Date(), 30)),
            });
            setDevelopmentPlanRequestError(null);
          }}
          onFormChange={(field, value) =>
            setDevelopmentPlanForm((prev) => ({ ...prev, [field]: value }))
          }
          onRequestToChange={setDevelopmentPlanRequestTo}
          onRequestCcChange={setDevelopmentPlanRequestCc}
          onRequestMessageChange={setDevelopmentPlanRequestMessage}
          onOverrideRecipientsChange={setDevelopmentPlanOverrideRecipients}
          onFileChange={setDevelopmentPlanFile}
          onUploadFile={uploadDevelopmentPlanFile}
          onSubmit={saveDevelopmentPlan}
          onSendRequest={sendDevelopmentPlanRequest}
        />
      )}

      </div>{/* end padded wrapper */}
    </div>
  );
};

const DevelopmentPlanModal: React.FC<{
  relation: SupplierSiteRelation;
  plans: SupplierDevelopmentPlan[];
  selectedPlanId: number | null;
  form: DevelopmentPlanFormState;
  isLoading: boolean;
  isSaving: boolean;
  requestError: string | null;
  requestTo: string;
  requestCc: string;
  requestMessage: string;
  overrideRecipients: boolean;
  uploadFile: File | null;
  isUploadingFile: boolean;
  isSendingRequest: boolean;
  onClose: () => void;
  onSelectPlan: (plan: SupplierDevelopmentPlan) => void;
  onCreateNew: () => void;
  onFormChange: (field: keyof DevelopmentPlanFormState, value: any) => void;
  onRequestToChange: (value: string) => void;
  onRequestCcChange: (value: string) => void;
  onRequestMessageChange: (value: string) => void;
  onOverrideRecipientsChange: (value: boolean) => void;
  onFileChange: (file: File | null) => void;
  onUploadFile: () => void;
  onSubmit: () => void;
  onSendRequest: () => void;
}> = ({
  relation,
  plans,
  selectedPlanId,
  form,
  isLoading,
  isSaving,
  requestError,
  requestTo,
  requestCc,
  requestMessage,
  overrideRecipients,
  uploadFile,
  isUploadingFile,
  isSendingRequest,
  onClose,
  onSelectPlan,
  onCreateNew,
  onFormChange,
  onRequestToChange,
  onRequestCcChange,
  onRequestMessageChange,
  onOverrideRecipientsChange,
  onFileChange,
  onUploadFile,
  onSubmit,
  onSendRequest,
}) => {
  const formatDate = (value?: string | null) => {
    if (!value) return "No date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Supplier Development Plan
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              {relation.relation_code ||
                `REL-${String(relation.id_relation).padStart(6, "0")}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-r border-slate-100 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">History</h3>
              <button
                type="button"
                onClick={onCreateNew}
                className="rounded-lg bg-[#062B49] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0C5381]"
              >
                New Plan
              </button>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-sm text-slate-400">
                Loading plans...
              </div>
            ) : plans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                No development plans yet for this relation.
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <button
                    key={plan.id_development_plan}
                    type="button"
                    onClick={() => onSelectPlan(plan)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      selectedPlanId === plan.id_development_plan
                        ? "border-[#062B49] bg-[#062B49] text-white"
                        : "border-slate-200 bg-white hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-sm font-semibold">
                      {plan.plan_title || `Plan #${plan.id_development_plan}`}
                    </div>
                    <div className="mt-1 text-xs opacity-80">
                      {plan.plan_status || "No status"}
                    </div>
                    <div className="mt-2 text-[11px] opacity-70">
                      Due {formatDate(plan.due_date)}
                    </div>
                    {plan.is_overdue && (
                      <div className="mt-2 text-[11px] font-semibold text-rose-500">
                        Overdue
                        {plan.days_past_due ? ` by ${plan.days_past_due} day(s)` : ""}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="overflow-y-auto p-6">
            {requestError && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {requestError}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <FieldInput
                label="Plan Title"
                value={form.plan_title}
                onChange={(value) => onFormChange("plan_title", value)}
              />
              <FieldInput
                label="Plan Status"
                value={form.plan_status}
                onChange={(value) => onFormChange("plan_status", value)}
              />
              <DateInput
                label="Issue Date"
                value={form.issue_date}
                onChange={(value) => onFormChange("issue_date", value)}
              />
              <DateInput
                label="Due Date"
                value={form.due_date}
                onChange={(value) => onFormChange("due_date", value)}
              />
              <DateInput
                label="Submission Date"
                value={form.submission_date}
                onChange={(value) => onFormChange("submission_date", value)}
              />
              <DateInput
                label="Review Date"
                value={form.review_date}
                onChange={(value) => onFormChange("review_date", value)}
              />
              <DateInput
                label="Decision Date"
                value={form.decision_date}
                onChange={(value) => onFormChange("decision_date", value)}
              />
              <DateInput
                label="Escalation Date"
                value={form.escalation_date}
                onChange={(value) => onFormChange("escalation_date", value)}
              />
              <FieldInput
                label="Reviewed By"
                value={form.reviewed_by}
                onChange={(value) => onFormChange("reviewed_by", value)}
              />
              <FieldInput
                label="Approved By"
                value={form.approved_by}
                onChange={(value) => onFormChange("approved_by", value)}
              />
              <FieldInput
                label="Rejected By"
                value={form.rejected_by}
                onChange={(value) => onFormChange("rejected_by", value)}
              />
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Business Hold
                </label>
                <select
                  value={form.business_hold_active}
                  onChange={(event) =>
                    onFormChange("business_hold_active", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#062B49]"
                >
                  <option value="">No change</option>
                  <option value="true">On hold</option>
                  <option value="false">Released</option>
                </select>
              </div>
              <FieldInput
                label="File Name"
                value={form.file_name}
                onChange={(value) => onFormChange("file_name", value)}
              />
              <FieldInput
                label="File URL"
                value={form.file_url}
                onChange={(value) => onFormChange("file_url", value)}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Upload Development Plan File
                  </label>
                  <input
                    type="file"
                    onChange={(event) =>
                      onFileChange(event.target.files?.[0] || null)
                    }
                    className="block w-full text-sm text-slate-700"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedPlanId
                      ? "Upload a real file for the selected development plan."
                      : "Create the development plan first, then upload its file."}
                  </p>
                  {uploadFile && (
                    <p className="mt-2 text-xs font-medium text-slate-700">
                      Selected: {uploadFile.name}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!selectedPlanId || !uploadFile || isUploadingFile}
                  onClick={onUploadFile}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUploadingFile ? "Uploading..." : "Upload file"}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextAreaInput
                label="File Notes"
                value={form.file_notes}
                onChange={(value) => onFormChange("file_notes", value)}
              />
              <TextAreaInput
                label="Supplier Comments"
                value={form.supplier_comments}
                onChange={(value) => onFormChange("supplier_comments", value)}
              />
              <TextAreaInput
                label="Internal Comments"
                value={form.internal_comments}
                onChange={(value) => onFormChange("internal_comments", value)}
              />
            </div>

            <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Request Email
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Review the plan fields first, then send the supplier email.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onOverrideRecipientsChange(!overrideRecipients);
                    if (overrideRecipients) onRequestToChange("");
                  }}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                >
                  {overrideRecipients ? "Use default contacts" : "Override recipients"}
                </button>
              </div>

              {!overrideRecipients ? (
                <p className="text-xs text-slate-500">
                  Email will be sent to the registered contacts for this supplier
                  unit.
                </p>
              ) : (
                <FieldInput
                  label="Send To"
                  value={requestTo}
                  onChange={onRequestToChange}
                  placeholder="email1@example.com, email2@example.com"
                />
              )}

              <FieldInput
                label="CC - Supplier Owner / Additional"
                value={requestCc}
                onChange={onRequestCcChange}
                placeholder="owner@company.com"
              />

              {relation.supplier_owner && (
                <p className="text-xs text-slate-400">
                  Pre-filled with supplier owner:{" "}
                  <span className="font-medium text-slate-600">
                    {relation.supplier_owner}
                  </span>
                </p>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Custom Message{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={requestMessage}
                  onChange={(event) => onRequestMessageChange(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#062B49] resize-none"
                  placeholder="Additional context to include in the email..."
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-5">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.escalated}
                  onChange={(event) =>
                    onFormChange("escalated", event.target.checked)
                  }
                />
                Escalated
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.sync_relation_hold_status}
                  onChange={(event) =>
                    onFormChange(
                      "sync_relation_hold_status",
                      event.target.checked,
                    )
                  }
                />
                Sync relation status from business hold
              </label>
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isLoading || isSaving}
            onClick={onSubmit}
            className="rounded-xl bg-[#062B49] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0C5381] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : selectedPlanId ? "Update Plan" : "Create Plan"}
          </button>
          <button
            type="button"
            disabled={isLoading || isSaving || isSendingRequest}
            onClick={onSendRequest}
            className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSendingRequest ? "Sending..." : "Save & Send Email"}
          </button>
        </div>
      </div>
    </div>
  );
};

const FieldInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="mb-2 block text-sm font-semibold text-slate-700">
      {label}
    </label>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#062B49]"
    />
  </div>
);

const DateInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
  <div>
    <label className="mb-2 block text-sm font-semibold text-slate-700">
      {label}
    </label>
    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#062B49]"
    />
  </div>
);

const TextAreaInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}> = ({ label, value, onChange, placeholder, rows = 4 }) => (
  <div>
    <label className="mb-2 block text-sm font-semibold text-slate-700">
      {label}
    </label>
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#062B49]"
    />
  </div>
);

const StatusOverrideModal: React.FC<{
  relation: SupplierSiteRelation;
  workspace: RelationEvaluationWorkspace | null;
  status: string;
  reason: string;
  overrideDate: string;
  isLoading: boolean;
  isSaving: boolean;
  onClose: () => void;
  onStatusChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onSubmit: () => void;
}> = ({
  relation,
  workspace,
  status,
  reason,
  overrideDate,
  isLoading,
  isSaving,
  onClose,
  onStatusChange,
  onReasonChange,
  onDateChange,
  onSubmit,
}) => {
  const activeOverride = workspace?.status_override as SupplierStatusOverride | null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Supplier Status Override
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              {relation.relation_code ||
                `REL-${String(relation.id_relation).padStart(6, "0")}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          {isLoading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Loading override data...
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <StatusInfoCard
                  label="Computed Status"
                  value={workspace?.computed_supplier_status || "Pending"}
                />
                <StatusInfoCard
                  label="Current Status"
                  value={workspace?.effective_supplier_status || relation.supplier_status || "Pending"}
                />
              </div>

              {activeOverride?.active && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Active override: {activeOverride.status || "N/A"} on{" "}
                  {formatDateTime(activeOverride.changed_at)}.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Override Status
                  </label>
                  <select
                    value={status}
                    onChange={(event) => onStatusChange(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#062B49]"
                  >
                    <option value="">Select status</option>
                    <option value="Can Quote and Be Awarded">
                      Can Quote and Be Awarded
                    </option>
                    <option value="Can Quote but Not be Awarded">
                      Can Quote but Not be Awarded
                    </option>
                    <option value="New business on Hold">
                      New business on Hold
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Override Date
                  </label>
                  <input
                    type="date"
                    value={overrideDate}
                    onChange={(event) => onDateChange(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#062B49]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Override Reason
                </label>
                <textarea
                  value={reason}
                  onChange={(event) => onReasonChange(event.target.value)}
                  rows={4}
                  placeholder="Explain why the supplier status must be overridden."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#062B49]"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isLoading || isSaving}
            onClick={onSubmit}
            className="rounded-xl bg-[#062B49] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0C5381] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Override Supplier Status"}
          </button>
        </div>
      </div>
    </div>
  );
};

const StatusInfoCard: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
      {label}
    </div>
    <div className="mt-2 text-base font-semibold text-slate-900">{value}</div>
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

const UnitSearchBox: React.FC<{
  units: SupplierUnitResponse[];
  onSelect: (unit: SupplierUnitResponse) => void;
  selectedUnitId: number | null;
}> = ({ units, onSelect, selectedUnitId }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered =
    query.length > 0
      ? units.filter(
          (unit) =>
            unit.supplier_code?.toLowerCase().includes(query.toLowerCase()) ||
            unit.city?.toLowerCase().includes(query.toLowerCase()) ||
            unit.country?.toLowerCase().includes(query.toLowerCase()) ||
            unit.product_type?.toLowerCase().includes(query.toLowerCase()),
        )
      : [];

  return (
    <div className="relative">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search units…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {filtered.map((unit) => (
            <button key={unit.id_supplier_unit}
              onMouseDown={() => { onSelect(unit); setQuery(""); setOpen(false); }}
              className={`w-full border-b border-slate-50 px-4 py-3 text-left transition last:border-b-0 ${
                selectedUnitId === unit.id_supplier_unit ? "bg-blue-50" : "bg-white hover:bg-slate-50"
              }`}>
              <div className="text-sm font-semibold text-slate-900">{unit.supplier_code}</div>
              <div className="mt-0.5 text-xs text-slate-400">
                {[unit.city, unit.country].filter(Boolean).join(", ")}
                {unit.product_type ? ` · ${unit.product_type}` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const UnitCard: React.FC<{
  unit: SupplierUnitResponse;
  summary?: UnitEvaluationSummary;
  isSelected: boolean;
  onClick: () => void;
}> = ({ unit, summary, isSelected, onClick }) => (
  <button onClick={onClick}
    className={`w-full border-b border-slate-100 px-5 py-4 text-left transition ${
      isSelected
        ? "border-l-[3px] border-l-[#062B49] bg-[#062B49]/5"
        : "border-l-[3px] border-l-transparent bg-white hover:bg-slate-50"
    }`}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        {/* Primary: unit name */}
        <div className={`truncate text-sm font-bold ${isSelected ? "text-[#062B49]" : "text-slate-900"}`}>
          {unit.supplier_code}
        </div>
        {/* Location */}
        {(unit.city || unit.country) && (
          <div className="mt-0.5 text-[11px] text-slate-500">
            {[unit.city, unit.country].filter(Boolean).join(", ")}
          </div>
        )}
        {/* Product */}
        {unit.product_type && (
          <div className="mt-0.5 text-[11px] text-slate-400">{unit.product_type}</div>
        )}
        {/* Grade chips */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {summary?.final_grade ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
              Grade {summary.final_grade}
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
              Pending evaluation
            </span>
          )}
          {(summary?.site_relations_count ?? 0) > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {summary!.site_relations_count} plant{summary!.site_relations_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {isSelected && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#062B49] text-white text-[10px] font-bold">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
        </div>
      )}
    </div>
  </button>
);
