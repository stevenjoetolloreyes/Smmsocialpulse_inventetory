"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resetPasswordAction } from "@/server/actions";
import { unwrapActionResult } from "@/lib/actionResult";
import { Icon } from "./ui";
import {
  AuthError,
  CapsLockWarning,
  EyeToggle,
  FieldIcon,
  authInputWithEyeCls,
  authLabelCls,
  authPrimaryBtnCls,
  useCapsLock,
} from "./AuthShell";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const capsOn = useCapsLock();

  if (!token) {
    return (
      <div className="text-center">
        <AuthError message="This reset link is missing its token. Request a new link from the Forgot password page." />
        <Link href="/forgot-password" className={`${authPrimaryBtnCls} mt-4`}>
          Request a new link
        </Link>
      </div>
    );
  }

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
      unwrapActionResult(await resetPasswordAction(token, password));
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} autoComplete="off">
      <label className={authLabelCls} htmlFor="rp-password">
        New password
      </label>
      <div className="relative">
        <FieldIcon name="lock" />
        <input
          id="rp-password"
          type={showPw ? "text" : "password"}
          className={authInputWithEyeCls}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <EyeToggle show={showPw} onToggle={() => setShowPw((v) => !v)} />
      </div>

      <label className={`${authLabelCls} mt-4`} htmlFor="rp-confirm">
        Confirm new password
      </label>
      <div className="relative">
        <FieldIcon name="lock" />
        <input
          id="rp-confirm"
          type={showPw ? "text" : "password"}
          className={authInputWithEyeCls}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type it again"
          required
          autoComplete="new-password"
        />
      </div>
      <CapsLockWarning on={capsOn} />
      <AuthError message={error} />
      <button type="submit" disabled={busy} className={`${authPrimaryBtnCls} mt-5`}>
        {busy ? (
          <>
            <Icon name="circle-notch" className="animate-spin" /> Saving…
          </>
        ) : (
          "Set new password"
        )}
      </button>
      <p className="mt-4 text-center text-sm text-stone-500">
        <Link href="/login" className="font-bold text-[#15803d] hover:underline">
          Back to Sign in
        </Link>
      </p>
    </form>
  );
}
