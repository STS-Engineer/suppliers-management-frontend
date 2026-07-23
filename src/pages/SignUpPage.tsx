import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CheckCircle,
  ClipboardList,
  Mail,
  User,
  UserPlus,
} from "lucide-react";
import supplierAPI, { SupplierApiError } from "../services/supplierOnboardingAPI";
import AuthShell, {
  AuthField,
  authButtonClass,
  authSelectClass,
} from "../components/auth/AuthShell";

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

const HIGHLIGHTS = [
  {
    icon: <UserPlus className="h-5 w-5" />,
    title: "Submit your request",
    text: "Fill in your details and pick the role that fits your responsibilities.",
  },
  {
    icon: <ClipboardList className="h-5 w-5" />,
    title: "Manager review",
    text: "A Purchasing Manager reviews and approves or rejects the request.",
  },
  {
    icon: <CheckCircle className="h-5 w-5" />,
    title: "Activate & sign in",
    text: "Follow the link in your approval email to set a password and get started.",
  },
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
    <AuthShell
      eyebrow="Supplier Management Application"
      title="Join the supplier management workspace."
      subtitle="Submit your account request and a Purchasing Manager will review it. Once approved, you'll receive an activation email to set your password."
      highlights={HIGHLIGHTS}
      cardHeading="Request access"
      cardSubtitle="Create a new account request — approval takes just a review."
    >
      {submitted ? (
        <SuccessState email={form.email} />
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <AuthField
              label="Work email"
              icon={<Mail className="h-4 w-4" />}
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="name@avocarbon.com"
              autoComplete="email"
              required
            />

            <AuthField
              label="Full name"
              icon={<User className="h-4 w-4" />}
              type="text"
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              required
              minLength={2}
            />

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Requested role
              </span>
              <div className="group relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-sky-500">
                  <Briefcase className="h-4 w-4" />
                </span>
                <select
                  value={form.requested_role}
                  onChange={(e) => set("requested_role", e.target.value)}
                  className={authSelectClass}
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
            </label>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className={authButtonClass}
            >
              {isSubmitting ? (
                "Submitting…"
              ) : (
                <>
                  Submit request
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              to="/signin"
              className="font-semibold text-sky-700 transition hover:underline"
            >
              Sign in
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}

function SuccessState({ email }: { email: string }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle className="h-8 w-8" />
      </div>
      <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
        Request submitted
      </h2>
      <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">
        Your account request for{" "}
        <span className="font-semibold text-slate-700">{email}</span> has been
        received. You'll be notified by email once a Purchasing Manager has
        reviewed it.
      </p>
      <Link
        to="/signin"
        className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>
    </div>
  );
}
