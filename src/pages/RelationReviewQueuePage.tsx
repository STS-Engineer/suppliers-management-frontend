import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Clock, Building2, MapPin, User, ChevronDown, ChevronUp } from "lucide-react";
import { supplierAPI } from "../services/supplierOnboardingAPI";
import { useAuth } from "../context/AuthContext";

type RelationRecord = {
  relation_id: number;
  unit_id: number;
  unit_code: string;
  group_id?: number;
  group_name?: string;
  unit_country?: string;
  supplier_owner?: string;
  site_id?: number;
  site_name?: string;
  validation_status: string;
};

type ActionState = "idle" | "approving" | "rejecting";

function RelationCard({ item, onDone, canApprove }: { item: RelationRecord; onDone: () => void; canApprove: boolean }) {
  const navigate = useNavigate();
  const [action, setAction] = useState<ActionState>("idle");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      await supplierAPI.approveRelationReview(item.relation_id, comment || undefined);
      onDone();
    } catch (e: any) {
      setError(e.message ?? "Failed to approve.");
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) {
      setError("A rejection reason is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await supplierAPI.rejectRelationReview(item.relation_id, comment.trim());
      onDone();
    } catch (e: any) {
      setError(e.message ?? "Failed to reject.");
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
              {item.group_name ?? item.unit_code}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {item.unit_code} · REL-{String(item.relation_id).padStart(6, "0")}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-700">
            <Clock className="h-3.5 w-3.5" />
            Pending Review
          </span>
          <button
            type="button"
            onClick={() => navigate(`/supplier-relations/${item.relation_id}/evaluation`)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            View Evaluation
          </button>
          {item.group_id && (
            <button
              type="button"
              onClick={() => navigate(`/suppliers/${item.group_id}/manage`)}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-700/40 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
            >
              Manage Supplier
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-slate-100 px-5 py-3 sm:grid-cols-3 dark:border-slate-700">
        <Detail icon={<MapPin className="h-3.5 w-3.5" />} label="Country" value={item.unit_country} />
        <Detail icon={<Building2 className="h-3.5 w-3.5" />} label="Plant" value={item.site_name ?? (item.site_id ? `Site #${item.site_id}` : undefined)} />
        <Detail icon={<User className="h-3.5 w-3.5" />} label="Owner" value={item.supplier_owner} />
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-700">
          {action === "idle" && canApprove && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setAction("approving"); setError(null); }}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </button>
              <button
                type="button"
                onClick={() => { setAction("rejecting"); setError(null); }}
                className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50 dark:border-red-700 dark:bg-slate-800 dark:text-red-400"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
            </div>
          )}

          {(action === "approving" || action === "rejecting") && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {action === "approving" ? "Comment (optional)" : "Reason (optional)"}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder={action === "approving" ? "Add an optional comment…" : "Rejection reason (required)…"}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>

              {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex gap-2">
                {action === "approving" ? (
                  <button type="button" onClick={handleApprove} disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                    <CheckCircle className="h-4 w-4" />
                    {loading ? "Approving…" : "Confirm Approval"}
                  </button>
                ) : (
                  <button type="button" onClick={handleReject} disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                    <XCircle className="h-4 w-4" />
                    {loading ? "Rejecting…" : "Confirm Rejection"}
                  </button>
                )}
                <button type="button" onClick={() => { setAction("idle"); setComment(""); setError(null); }} disabled={loading}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-400">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{value ?? "—"}</p>
      </div>
    </div>
  );
}

export default function RelationReviewQueuePage() {
  const { user } = useAuth();
  const isVpConversion = user?.access_profile === "vp_conversion";
  const [items, setItems] = useState<RelationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.listPendingRelationReviews();
      setItems(res.data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load review queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="px-4 py-6 xl:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Relation Review Queue</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isVpConversion
            ? "Supplier relations submitted for your approval before joining the panel."
            : "Supplier relations pending VP Conversion approval."}
        </p>
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-sm text-slate-500">Loading…</div>}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-600">
          <CheckCircle className="mb-3 h-10 w-10 text-emerald-400" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">All caught up!</p>
          <p className="mt-1 text-xs text-slate-500">No relations pending review.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <RelationCard key={item.relation_id} item={item} onDone={load} canApprove={isVpConversion} />
          ))}
        </div>
      )}
    </div>
  );
}
