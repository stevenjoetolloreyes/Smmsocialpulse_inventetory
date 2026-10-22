"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/server/actions";
import { unwrapActionResult } from "@/lib/actionResult";
import { Icon } from "./ui";
import {
  AuthError,
  FieldIcon,
  authInputCls,
  authLabelCls,
  authPrimaryBtnCls,
} from "./AuthShell";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ emailSent: boolean; resetUrl: string | null } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = unwrapActionResult(await requestPasswordResetAction(email));
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">
          <Icon name="envelope-open-text" />
        </span>
        <h2 className="text-lg font-bold text-stone-800">Check your email</h2>
        {result.emailSent ? (
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-stone-500">
            A password reset link was sent to <strong className="text-stone-700">{email}</strong>.
            It expires in 1 hour and can be used once.
          </p>
        ) : (
          <div className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stone-500">
            <p>
              Email sending is not configured on this platform yet (setup mode), so use
              this one-time reset link instead — it expires in 1 hour:
            </p>
            <a
              href={result.resetUrl ?? "#"}
              className="mt-3 block break-all rounded-2xl bg-amber-50 px-4 py-3 text-left text-xs font-semibold text-amber-800 ring-1 ring-amber-200 hover:underline"
            >
              {result.resetUrl}
            </a>
          </div>
        )}
        <Link href="/login" className={`${authPrimaryBtnCls} mt-5`}>
          Back to Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} autoComplete="off">
      <label className={authLabelCls} htmlFor="fp-email">
        Email address
      </label>
      <div className="relative">
        <FieldIcon name="envelope" />
        <input
          id="fp-email"
          type="email"
          className={authInputCls}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter the email on your account"
          required
        />
      </div>
      <AuthError message={error} />
      <button type="submit" disabled={busy} className={`${authPrimaryBtnCls} mt-5`}>
        {busy ? (
          <>
            <Icon name="circle-notch" className="animate-spin" /> Sending…
          </>
        ) : (
          "Send reset link"
        )}
      </button>
      <p className="mt-4 text-center text-sm text-stone-500">
        Remembered it?{" "}
        <Link href="/login" className="font-bold text-[#15803d] hover:underline">
          Back to Sign in
        </Link>
      </p>
      <p className="mt-3 text-center text-xs leading-relaxed text-stone-400">
        Store staff without an email on their account can ask their store owner to set a
        new password in Settings → User Management.
      </p>
    </form>
  );
}
