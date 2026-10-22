"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminLoginAction } from "@/server/actions";
import { Icon } from "@/components/ui";
import {
  AuthCard,
  AuthError,
  CapsLockWarning,
  EyeToggle,
  FieldIcon,
  authInputCls,
  authInputWithEyeCls,
  authLabelCls,
  authPrimaryBtnCls,
  useCapsLock,
} from "@/components/AuthShell";

/**
 * Dedicated sign-in for the platform admin area (/admin). Only platform
 * admin accounts are accepted here; store owners and staff are told to
 * use the regular store sign-in instead.
 */
export function AdminLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const capsOn = useCapsLock();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await adminLoginAction(username, password);
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setBusy(false);
    }
  };

  return (
    <AuthCard
      heading="Platform Admin"
      subtitle="Platform owner sign-in — stores, plans and feedback"
    >
      <p className="mb-5 rounded-2xl bg-stone-100 px-4 py-3 text-[13px] leading-relaxed text-stone-500 ring-1 ring-stone-200">
        This door is for the <strong className="text-stone-700">platform owner</strong>{" "}
        only. Store owners and staff cannot sign in here.
      </p>

      <form onSubmit={submit} autoComplete="off">
        <label className={authLabelCls} htmlFor="admin-username">
          Username
        </label>
        <div className="relative">
          <FieldIcon name="user" />
          <input
            id="admin-username"
            className={authInputCls}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter the admin username"
            required
          />
        </div>

        <label className={`${authLabelCls} mt-4`} htmlFor="admin-password">
          Password
        </label>
        <div className="relative">
          <FieldIcon name="lock" />
          <input
            id="admin-password"
            type={showPw ? "text" : "password"}
            className={authInputWithEyeCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter the admin password"
            required
          />
          <EyeToggle show={showPw} onToggle={() => setShowPw((v) => !v)} />
        </div>
        <CapsLockWarning on={capsOn} />

        <AuthError message={error} />

        <button type="submit" disabled={busy} className={`${authPrimaryBtnCls} mt-5`}>
          {busy ? (
            <>
              <Icon name="circle-notch" className="animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in to Admin"
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-stone-500">
        Looking for your store?{" "}
        <Link href="/login" className="font-bold text-[#15803d] hover:underline">
          Go to store sign-in
        </Link>
      </p>
    </AuthCard>
  );
}
