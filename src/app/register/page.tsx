"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getAuthBranding, registerAction } from "@/server/actions";
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
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const capsOn = useCapsLock();

  const [branding, setBranding] = useState<{
    googleEnabled: boolean;
    facebookEnabled: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAuthBranding()
      .then((b) => {
        if (!cancelled) {
          setBranding({
            googleEnabled: b.googleEnabled,
            facebookEnabled: b.facebookEnabled,
          });
        }
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
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
      await registerAction({ username, email, password });
      setDone(true);
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
            <Icon name="check" />
          </span>
          <h2 className="text-lg font-bold text-stone-800">Account created</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-stone-500">
            Your account <strong className="text-stone-700">{username}</strong> was
            created and is now <strong className="text-stone-700">waiting for the
            store owner&apos;s activation</strong>. Once the owner activates it in
            Settings → User Management, you can sign in from the Branch Staff tab.
          </p>
          <Link href="/login" className={`${authPrimaryBtnCls} mt-5`}>
            Back to Sign in
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={submit} autoComplete="off">
            <label className={authLabelCls} htmlFor="reg-username">
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

          <SocialButtons
            google={Boolean(branding?.googleEnabled)}
            facebook={Boolean(branding?.facebookEnabled)}
          />

          <p className="mt-5 text-center text-sm text-stone-500">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-[#15803d] hover:underline">
              Sign in
            </Link>
          </p>
          <p className="mt-3 text-center text-xs leading-relaxed text-stone-400">
            New accounts start inactive. The store owner reviews each registration
            and activates it before it can be used — registering never creates an
            owner account.
          </p>
        </>
      )}
    </AuthCard>
  );
}
