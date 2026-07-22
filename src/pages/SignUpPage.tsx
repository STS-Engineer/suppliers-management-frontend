import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle, ClipboardList, UserPlus } from "lucide-react";
import supplierAPI, { SupplierApiError } from "../services/supplierOnboardingAPI";

// Roles a new user can request. Mirrors the real access_profile values enforced
// by the backend. The elevated admin roles (VP Conversion, Purchasing Director)
// are not self-requestable — an approver assigns them from the Users tab.
const AVAILABLE_ROLES = [
  { value: "purchasing_manager", label: "Purchasing Manager" },
  { value: "supplier_owner", label: "Supplier Owner" },
  { value: "global_purchaser", label: "Global Purchaser" },
  { value: "local_purchaser", label: "Local Purchaser" },
  { value: "viewer", label: "Viewer (Read-only)" },
];

type FormState = {
  email: string;
  full_name: string;
  requested_role: string;
};

export default function SignUpPage() {
  const [form, setForm] = useState<FormState>({
    email: "",
    full_name: "",
    requested_role: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await supplierAPI.signUp({
        email: form.email.trim().toLowerCase(),
        full_name: form.full_name.trim(),
        requested_role: form.requested_role,
      });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof SupplierApiError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f7fbff_0,#e8f0f8_40%,#dbe7f3_100%)] px-4 py-8 text-slate-900">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left panel */}
        <section className="relative overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#08203a,#0c3158_46%,#155489)] px-6 py-8 text-white shadow-[0_30px_90px_rgba(8,31,58,0.24)] sm:px-8 lg:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.20),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.14),transparent_28%)]" />
          <div className="relative flex h-full flex-col justify-between gap-10">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.34em] text-sky-100/75">
                Request Access
              </p>
              <h1 className="mt-4 max-w-xl text-4xl font-bold tracking-[-0.05em] sm:text-5xl">
                Join the supplier management workspace.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200/92 sm:text-base">
                Submit your account request and a Purchasing Manager will review
                it. Once approved, you'll receive an activation email to set your
                password and access the platform.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/12 bg-white/10 p-4 backdrop-blur">
                <UserPlus className="h-5 w-5 text-sky-200" />
                <p className="mt-3 text-sm font-semibold">Submit request</p>
                <p className="mt-1 text-xs leading-6 text-slate-200/80">
                  Fill in your details and choose the role that fits your
                  responsibilities.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/10 p-4 backdrop-blur">
                <ClipboardList className="h-5 w-5 text-amber-200" />
                <p className="mt-3 text-sm font-semibold">Pending review</p>
                <p className="mt-1 text-xs leading-6 text-slate-200/80">
                  A Purchasing Manager reviews and approves or rejects the
                  request.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/10 p-4 backdrop-blur">
                <CheckCircle className="h-5 w-5 text-emerald-200" />
                <p className="mt-3 text-sm font-semibold">Activate account</p>
                <p className="mt-1 text-xs leading-6 text-slate-200/80">
                  Click the link in your approval email to set your password and
                  sign in.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Right panel */}
        <section className="flex items-center">
          <div className="w-full rounded-[30px] border border-slate-200/80 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-8">
            {submitted ? (
              <SuccessState email={form.email} />
            ) : (
              <>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#6d89a4]">
                    New Account
                  </p>
                  <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[#10233f]">
                    Request Access
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Work Email
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                      placeholder="name@avocarbon.com"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={form.full_name}
                      onChange={(e) => set("full_name", e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                      placeholder="Your full name"
                      autoComplete="name"
                      required
                      minLength={2}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Requested Role
                    </label>
                    <select
                      value={form.requested_role}
                      onChange={(e) => set("requested_role", e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                      required
                    >
                      <option value="" disabled>
                        Select a role…
                      </option>
                      {AVAILABLE_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0f2744,#1b5d92)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(15,39,68,0.24)] transition hover:translate-y-[-1px] hover:shadow-[0_22px_40px_rgba(15,39,68,0.28)] disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {isSubmitting ? "Submitting…" : "Submit request"}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-500">
                  Already have an account?{" "}
                  <Link
                    to="/signin"
                    className="font-semibold text-[#1b5d92] hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SuccessState({ email }: { email: string }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle className="h-8 w-8 text-emerald-600" />
      </div>
      <h2 className="mt-5 text-2xl font-bold tracking-[-0.04em] text-[#10233f]">
        Request submitted
      </h2>
      <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">
        Your account request for{" "}
        <span className="font-semibold text-slate-700">{email}</span> has been
        received. You will be notified by email once a Purchasing Manager has
        reviewed it.
      </p>
      <Link
        to="/signin"
        className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#1b5d92] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>
    </div>
  );
}
