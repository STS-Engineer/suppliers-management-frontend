import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle, KeyRound, Mail, ShieldCheck } from "lucide-react";
import supplierAPI, { SupplierApiError } from "../services/supplierOnboardingAPI";

type Step = "email" | "otp" | "password" | "success";

const INPUT_CLS =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100";

const BTN_CLS =
  "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0f2744,#1b5d92)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(15,39,68,0.24)] transition hover:translate-y-[-1px] hover:shadow-[0_22px_40px_rgba(15,39,68,0.28)] disabled:cursor-not-allowed disabled:opacity-65";

const LABEL_CLS =
  "mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Step 1 — send OTP
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await supplierAPI.forgotPassword(email.trim().toLowerCase());
      setStep("otp");
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

  // Step 2 — verify OTP
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const otpValue = otp.join("");
    if (otpValue.length < 6) {
      setError("Please enter all 6 digits.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await supplierAPI.verifyOtp({ email, otp: otpValue });
      setResetToken(res.data.reset_token);
      setStep("password");
    } catch (err) {
      setError(
        err instanceof SupplierApiError
          ? err.message
          : "OTP verification failed. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3 — set new password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      await supplierAPI.resetPasswordWithToken({
        reset_token: resetToken,
        new_password: newPassword,
      });
      setStep("success");
    } catch (err) {
      setError(
        err instanceof SupplierApiError
          ? err.message
          : "Failed to update password. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // OTP digit handlers
  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(""));
      otpRefs.current[5]?.focus();
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f7fbff_0,#e8f0f8_40%,#dbe7f3_100%)] px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center">
        <div className="w-full rounded-[30px] border border-slate-200/80 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-8">
          {step === "email" && (
            <EmailStep
              email={email}
              setEmail={setEmail}
              error={error}
              isSubmitting={isSubmitting}
              onSubmit={handleEmailSubmit}
            />
          )}

          {step === "otp" && (
            <OtpStep
              email={email}
              otp={otp}
              otpRefs={otpRefs}
              error={error}
              isSubmitting={isSubmitting}
              onSubmit={handleOtpSubmit}
              onChange={handleOtpChange}
              onKeyDown={handleOtpKeyDown}
              onPaste={handleOtpPaste}
              onBack={() => { setOtp(["", "", "", "", "", ""]); setStep("email"); }}
            />
          )}

          {step === "password" && (
            <PasswordStep
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              setNewPassword={setNewPassword}
              setConfirmPassword={setConfirmPassword}
              error={error}
              isSubmitting={isSubmitting}
              onSubmit={handlePasswordSubmit}
            />
          )}

          {step === "success" && <SuccessStep />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmailStep({
  email,
  setEmail,
  error,
  isSubmitting,
  onSubmit,
}: {
  email: string;
  setEmail: (v: string) => void;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <>
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100">
          <Mail className="h-6 w-6 text-sky-600" />
        </div>
        <p className="mt-4 text-[11px] font-black uppercase tracking-[0.3em] text-[#6d89a4]">
          Password Reset
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#10233f]">
          Forgot your password?
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enter your work email address and we'll send you a one-time code.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
          <label className={LABEL_CLS}>Work Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT_CLS}
            placeholder="name@avocarbon.com"
            autoComplete="email"
            required
          />
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className={BTN_CLS}>
          {isSubmitting ? "Sending code…" : "Send reset code"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link
          to="/signin"
          className="inline-flex items-center gap-1 font-semibold text-[#1b5d92] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </p>
    </>
  );
}

function OtpStep({
  email,
  otp,
  otpRefs,
  error,
  isSubmitting,
  onSubmit,
  onChange,
  onKeyDown,
  onPaste,
  onBack,
}: {
  email: string;
  otp: string[];
  otpRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (index: number, value: string) => void;
  onKeyDown: (index: number, e: React.KeyboardEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onBack: () => void;
}) {
  return (
    <>
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <ShieldCheck className="h-6 w-6 text-amber-600" />
        </div>
        <p className="mt-4 text-[11px] font-black uppercase tracking-[0.3em] text-[#6d89a4]">
          Verify Code
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#10233f]">
          Enter the 6-digit code
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          We sent a code to{" "}
          <span className="font-semibold text-slate-700">{email}</span>. It
          expires in 15 minutes.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8">
        <div
          className="flex justify-center gap-2"
          onPaste={onPaste}
        >
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { otpRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => onChange(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              className="h-14 w-12 rounded-2xl border border-slate-200 bg-slate-50 text-center text-xl font-bold text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          ))}
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || otp.join("").length < 6}
          className={`mt-6 ${BTN_CLS}`}
        >
          {isSubmitting ? "Verifying…" : "Verify code"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 font-semibold text-[#1b5d92] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Change email
        </button>
      </p>
    </>
  );
}

function PasswordStep({
  newPassword,
  confirmPassword,
  setNewPassword,
  setConfirmPassword,
  error,
  isSubmitting,
  onSubmit,
}: {
  newPassword: string;
  confirmPassword: string;
  setNewPassword: (v: string) => void;
  setConfirmPassword: (v: string) => void;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <>
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <KeyRound className="h-6 w-6 text-emerald-600" />
        </div>
        <p className="mt-4 text-[11px] font-black uppercase tracking-[0.3em] text-[#6d89a4]">
          New Password
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#10233f]">
          Set a new password
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Choose a strong password of at least 8 characters.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
          <label className={LABEL_CLS}>New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={INPUT_CLS}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={INPUT_CLS}
            placeholder="Repeat password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className={BTN_CLS}>
          {isSubmitting ? "Saving…" : "Update password"}
        </button>
      </form>
    </>
  );
}

function SuccessStep() {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle className="h-8 w-8 text-emerald-600" />
      </div>
      <h2 className="mt-5 text-2xl font-bold tracking-[-0.04em] text-[#10233f]">
        Password updated
      </h2>
      <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">
        Your password has been changed successfully. You can now sign in with
        your new password.
      </p>
      <Link
        to="/signin"
        className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0f2744,#1b5d92)] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(15,39,68,0.24)] transition hover:translate-y-[-1px]"
      >
        Sign in
      </Link>
    </div>
  );
}
