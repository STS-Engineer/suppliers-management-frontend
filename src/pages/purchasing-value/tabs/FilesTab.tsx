import { useRef, useState } from "react";
import { FileText, Paperclip, RefreshCw, Trash2, Upload } from "lucide-react";
import supplierAPI from "../../../services/supplierOnboardingAPI";
import type { Opp } from "../types";
import { PHASE_OPTIONS } from "../constants";
import { fmtDate } from "../utils";

export function FilesTab({
  opp,
  userEmail,
  onRefresh,
}: {
  opp: Opp;
  userEmail: string;
  onRefresh: (o: Opp) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phaseLabel, setPhaseLabel] = useState("General");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const docs = opp.opp_documents ?? [];

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await supplierAPI.uploadOpportunityDocument(
        opp.opportunity_id,
        file,
        phaseLabel,
        notes || undefined,
        userEmail,
      );
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: number) {
    setDeleting(docId);
    setError(null);
    try {
      await supplierAPI.deleteOpportunityDocument(docId);
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  const fmtSize = (b?: number | null) =>
    !b
      ? ""
      : b < 1024
        ? `${b} B`
        : b < 1024 * 1024
          ? `${(b / 1024).toFixed(1)} KB`
          : `${(b / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Upload zone */}
      <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-4">
        <p className="text-xs font-bold text-blue-700 mb-3 flex items-center gap-1.5">
          <Upload size={12} /> Upload a file
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
              Phase / Category
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400"
              value={phaseLabel}
              onChange={(e) => setPhaseLabel(e.target.value)}
            >
              {PHASE_OPTIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
              Notes (optional)
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400"
              placeholder="e.g. Rev 1.1 – signed"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <label
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors ${uploading ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          {uploading ? (
            <>
              <RefreshCw size={14} className="animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <Paperclip size={14} /> Choose file (PDF, Word, Excel, Image)
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            disabled={uploading}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            onChange={handleUpload}
          />
        </label>
      </div>

      {/* File list */}
      {docs.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">
          No files uploaded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.doc_id}
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 hover:border-slate-200"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                <FileText size={14} className="text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {doc.original_file_name || doc.file_name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-slate-500">
                    {doc.phase_label}
                  </span>
                  {doc.file_size && (
                    <span className="text-[10px] text-slate-400">
                      {fmtSize(doc.file_size)}
                    </span>
                  )}
                  {doc.notes && (
                    <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                      {doc.notes}
                    </span>
                  )}
                </div>
                {(doc.uploaded_by || doc.created_at) && (
                  <p className="mt-1 text-[10px] text-slate-400">
                    {doc.uploaded_by
                      ? `Uploaded by ${doc.uploaded_by}`
                      : "Uploaded"}
                    {doc.created_at ? ` | ${fmtDate(doc.created_at)}` : ""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {doc.file_url && (
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    Open
                  </a>
                )}
                <button
                  onClick={() => handleDelete(doc.doc_id)}
                  disabled={deleting === doc.doc_id}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                >
                  {deleting === doc.doc_id ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

