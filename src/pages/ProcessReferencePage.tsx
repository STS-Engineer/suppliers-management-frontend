/**
 * Process & Business-Rule Reference (Volume 2) — VP Conversion only.
 * In-app viewer for the process/audit reference PDF (served from /public).
 * NOTE: drop the PDF at suppliers-management-frontend/public/process-reference.pdf
 */

import { Download, ExternalLink } from "lucide-react";
import { PageIntro } from "../components/UI";

// Served statically from the frontend `public/` folder → available at the site root.
const DOC_URL = "/process-reference.pdf";

export default function ProcessReferencePage() {
  return (
    <div className="flex flex-col gap-5">
      <PageIntro
        eyebrow="Help & Resources · Volume 2 · Restricted"
        title="Process & Business-Rule Reference"
        description="How the application implements the supplier & purchasing process — calculations, status mappings, approval workflows and controls. For process governance and IATF audit."
        actions={
          <>
            <a
              href={DOC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <ExternalLink className="h-4 w-4" /> Open in new tab
            </a>
            <a
              href={DOC_URL}
              download="SMS-Process-Reference-Vol2.pdf"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <Download className="h-4 w-4" /> Download PDF
            </a>
          </>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <iframe
          title="Process & Business-Rule Reference — Volume 2"
          src={`${DOC_URL}#view=FitH`}
          className="h-[calc(100vh-220px)] min-h-[520px] w-full"
        />
      </div>

      {/* Fallback for browsers that block inline PDF rendering, or before the file is uploaded */}
      <p className="text-center text-xs text-slate-400">
        If the document does not appear above, use{" "}
        <a
          href={DOC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-blue-600 hover:underline"
        >
          Open in new tab
        </a>
        .
      </p>
    </div>
  );
}
