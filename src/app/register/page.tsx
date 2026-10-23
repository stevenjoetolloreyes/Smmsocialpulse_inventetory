"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { registerAction } from "@/server/actions";
import { unwrapActionResult } from "@/lib/actionResult";
import { Icon } from "@/components/ui";
import {
  AuthCard,
  AuthError,
  CapsLockWarning,
  EyeToggle,
  FieldIcon,
  SocialButtons,
  authInputCls,
  authInputWithEyeCls,
  authLabelCls,
  authPrimaryBtnCls,
  useCapsLock,
} from "@/components/AuthShell";

export default function RegisterPage() {
  const [storeName, setStoreName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [socialNotice, setSocialNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ emailSent: boolean; verifyUrl: string | null } | null>(null);
  const capsOn = useCapsLock();

  // Notices arriving back from the social sign-in flow.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("social") === "nouser") {
      setSocialNotice(
        "No store account uses that email yet. Create your store account first, then you can sign in with Google/Facebook using the same email.",
      );
    } else if (q.get("social") === "unconfigured") {
      const label = q.get("provider") === "facebook" ? "Facebook" : "Google";
      setSocialNotice(
        `${label} sign-in is not set up yet. The platform owner needs to add the provider keys in Admin → Social Login.`,
      );
    }
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match. Type the same password in both fields.");
      return;
    }
    setBusy(true);
    try {
      const r = unwrapActionResult(await registerAction({ storeName, username, email, password }));
      setDone({ emailSent: r.emailSent, verifyUrl: r.verifyUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
      setBusy(false);
    }
  };

  return (
    <AuthCard
      heading="Inventory Management System"
      subtitle="Create an account to get started"
    >
      {done ? (
        <div className="text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">
            <Icon name="envelope-open-text" />
          </span>
          <h2 className="text-lg font-bold text-stone-800">Check your email to verify</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-stone-500">
            Your store <strong className="text-stone-700">{storeName}</strong> and owner
            account <strong className="text-stone-700">{username}</strong> were created on
            the <strong className="text-stone-700">Free plan</strong>.
            {done.emailSent ? (
              <>
                {" "}We sent a verification link to{" "}
                <strong className="text-stone-700">{email}</strong> — click it within 24
                hours to activate your account, then sign in to finish setting up your store.
              </>
            ) : (
              <> Activate your account with the verification link below.</>
            )}
          </p>
          {!done.emailSent && done.verifyUrl && (
            <div className="mx-auto mt-3 max-w-sm rounded-2xl bg-amber-50 px-4 py-3 text-left ring-1 ring-amber-200">
              <p className="text-xs leading-relaxed text-amber-800">
                Email sending is not configured on this platform yet (setup mode), so
                here is your one-time verification link:
              </p>
              <a href={done.verifyUrl} className="mt-1.5 block break-all text-xs font-semibold text-amber-900 hover:underline">
                {done.verifyUrl}
              </a>
            </div>
          )}
          <Link href="/login" className={`${authPrimaryBtnCls} mt-5`}>
            Back to Sign in
          </Link>
        </div>
      ) : (
        <>
          <div className="-mt-2">
            <SocialButtons divider="or register with email" from="register" />
          </div>

          {socialNotice && (
            <p className="mb-4 mt-4 rounded-2xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
              {socialNotice}
            </p>
          )}

          <form onSubmit={submit} autoComplete="off" className="mt-5">
            <label className={authLabelCls} htmlFor="reg-store">
              Store Name
            </label>
            <div className="relative">
              <FieldIcon name="store" />
              <input
                id="reg-store"
                className={authInputCls}
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Reyes Sari-Sari Store"
                required
                minLength={2}
              />
            </div>

            <label className={`${authLabelCls} mt-4`} htmlFor="reg-username">
              Username
            </label>
            <div className="relative">
              <FieldIcon name="user" />
              <input
                id="reg-username"
                className={authInputCls}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                minLength={3}
              />
            </div>

            <label className={`${authLabelCls} mt-4`} htmlFor="reg-email">
              Email
            </label>
            <div className="relative">
              <FieldIcon name="envelope" />
              <input
                id="reg-email"
                type="email"
                className={authInputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <label className={`${authLabelCls} mt-4`} htmlFor="reg-password">
              Password
            </label>
            <div className="relative">
              <FieldIcon name="lock" />
              <input
                id="reg-password"
                type={showPw ? "text" : "password"}
                className={authInputWithEyeCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password (at least 8 characters)"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <EyeToggle show={showPw} onToggle={() => setShowPw((v) => !v)} />
            </div>

            <label className={`${authLabelCls} mt-4`} htmlFor="reg-confirm">
              Confirm Password
            </label>
            <div className="relative">
              <FieldIcon name="lock" />
              <input
                id="reg-confirm"
                type={showConfirm ? "text" : "password"}
                className={authInputWithEyeCls}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm your password"
                required
                autoComplete="new-password"
              />
              <EyeToggle show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
            </div>
            <CapsLockWarning on={capsOn} />

            <AuthError message={error} />

            <button type="submit" disabled={busy} className={`${authPrimaryBtnCls} mt-5`}>
              {busy ? (
                <>
                  <Icon name="circle-notch" className="animate-spin" /> Creating account…
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-stone-500">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-[#15803d] hover:underline">
              Sign in
            </Link>
          </p>
          <p className="mt-3 text-center text-xs leading-relaxed text-stone-400">
            Registering creates your own store on the Free plan with you as its owner.
            Your account activates when you click the verification link we email you —
            then a short setup wizard walks you through your store profile.
          </p>
        </>
      )}
    </AuthCard>
  );
}
