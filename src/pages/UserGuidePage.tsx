/**
 * User Guide Page
 * In-app viewer for the Supplier Management System user guide (PDF served from /public).
 */

import { Download, ExternalLink } from "lucide-react";
import { PageIntro } from "../components/UI";

// Served statically from the frontend `public/` folder → available at the site root.
const GUIDE_URL = "/user-guide.pdf";

export default function UserGuidePage() {
  return (
    <div className="flex flex-col gap-5">
      <PageIntro
        eyebrow="Help & Resources"
        title="User Guide"
        description="Step-by-step guide to the Supplier Management System. Read it here, open it in a new tab, or download a copy."
        actions={
          <>
            <a
              href={GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <ExternalLink className="h-4 w-4" /> Open in new tab
            </a>
            <a
              href={GUIDE_URL}
              download="Supplier-Management-User-Guide.pdf"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <Download className="h-4 w-4" /> Download PDF
            </a>
          </>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <iframe
          title="Supplier Management System — User Guide"
          src={`${GUIDE_URL}#view=FitH`}
          className="h-[calc(100vh-220px)] min-h-[520px] w-full"
        />
      </div>

      {/* Fallback for browsers that block inline PDF rendering */}
      <p className="text-center text-xs text-slate-400">
        If the guide does not appear above, use{" "}
        <a
          href={GUIDE_URL}
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
