"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getAuthBranding,
  loginAction,
  resendVerificationAction,
  type LoginMode,
} from "@/server/actions";
import { Icon } from "@/components/ui";
import { unwrapActionResult } from "@/lib/actionResult";
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

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<LoginMode>("owner");

  // Owner / Main tab
  const [identifier, setIdentifier] = useState("");
  const [ownerPw, setOwnerPw] = useState("");
  const [showOwnerPw, setShowOwnerPw] = useState(false);

  // Branch Staff tab
  const [storeCode, setStoreCode] = useState("");
  const [staffUsername, setStaffUsername] = useState("");
  const [staffPw, setStaffPw] = useState("");
  const [showStaffPw, setShowStaffPw] = useState(false);

  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resend, setResend] = useState<{ emailSent: boolean; verifyUrl: string | null } | null>(null);
  const [resending, setResending] = useState(false);
  const [busy, setBusy] = useState(false);
  const capsOn = useCapsLock();

  // One-time notices arriving from the verify / reset flows.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("verified") === "1") {
      setNotice("Email verified — your store account is now active. You can sign in.");
    } else if (q.get("reset") === "1") {
      setNotice("Password updated. Sign in with your new password.");
    } else if (q.get("verify_error") === "1") {
      setError("That verification link is invalid or has expired. Use the resend option below after a sign-in attempt.");
    }
  }, []);

  const [branding, setBranding] = useState<{
    storeName: string;
    googleEnabled: boolean;
    facebookEnabled: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAuthBranding()
      .then((b) => {
        if (!cancelled) setBranding(unwrapActionResult(b));
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const switchTab = (next: LoginMode) => {
    setTab(next);
    setError("");
    setResend(null);
  };

  const submitOwner = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setResend(null);
    setBusy(true);
    try {
      unwrapActionResult(await loginAction(identifier, ownerPw, "owner", "", rememberMe));
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setBusy(false);
    }
  };

  const submitStaff = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setResend(null);
    setBusy(true);
    try {
      unwrapActionResult(await loginAction(staffUsername, staffPw, "staff", storeCode, rememberMe));
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setBusy(false);
    }
  };

  const needsVerify = error.startsWith("Please verify your email address");
  const doResend = async () => {
    setResending(true);
    try {
      const r = unwrapActionResult(await resendVerificationAction(identifier || staffUsername));
      setResend(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the verification email.");
    } finally {
      setResending(false);
    }
  };

  const rememberRow = (
    <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-600">
      <input
        type="checkbox"
        className="h-4 w-4 rounded accent-[#15803d]"
        checked={rememberMe}
        onChange={(e) => setRememberMe(e.target.checked)}
      />
      Remember me for 30 days
    </label>
  );

  const resendBlock = needsVerify && (
    <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
      {resend ? (
        resend.emailSent ? (
          <p>
            A new verification email is on its way. Check your inbox and click the link
            to activate your account.
          </p>
        ) : (
          <>
            <p>
              Email sending is not configured on this platform yet (setup mode), so use
              this verification link instead:
            </p>
            <a href={resend.verifyUrl ?? "#"} className="mt-2 block break-all text-xs font-semibold hover:underline">
              {resend.verifyUrl}
            </a>
          </>
        )
      ) : (
        <button
          type="button"
          onClick={() => void doResend()}
          disabled={resending}
          className="font-bold text-[#15803d] hover:underline disabled:opacity-60"
        >
          {resending ? "Sending…" : "Resend verification email"}
        </button>
      )}
    </div>
  );

  const noticeBlock = notice && (
    <p className="mb-4 rounded-2xl bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700">
      {notice}
    </p>
  );

  const heading =
    branding && branding.storeName && branding.storeName !== "My Store"
      ? branding.storeName
      : "Inventory Management System";

  const tabBtn = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-sm font-bold transition ${
      active
        ? "bg-white text-[#14532d] shadow"
        : "text-stone-500 hover:text-stone-700"
    }`;

  return (
    <AuthCard heading={heading} subtitle="Smart POS & Inventory for Sari-Sari Stores">
      {/* Pill tabs */}
      <div className="mb-5 flex rounded-full bg-stone-200/70 p-1" role="tablist" aria-label="Sign-in type">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "owner"}
          className={tabBtn(tab === "owner")}
          onClick={() => switchTab("owner")}
        >
          <Icon name="house" /> Owner / Main
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "staff"}
          className={tabBtn(tab === "staff")}
          onClick={() => switchTab("staff")}
        >
          <Icon name="users" /> Branch Staff
        </button>
      </div>

      {noticeBlock}

      {tab === "owner" ? (
        <form onSubmit={submitOwner} autoComplete="off">
          <label className={authLabelCls} htmlFor="identifier">
            Email or Username
          </label>
          <div className="relative">
            <FieldIcon name="user" />
            <input
              id="identifier"
              className={authInputCls}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter your email or username"
              required
            />
          </div>

          <label className={`${authLabelCls} mt-4`} htmlFor="owner-password">
            Password
          </label>
          <div className="relative">
            <FieldIcon name="lock" />
            <input
              id="owner-password"
              type={showOwnerPw ? "text" : "password"}
              className={authInputWithEyeCls}
              value={ownerPw}
              onChange={(e) => setOwnerPw(e.target.value)}
              placeholder="Enter your password"
              required
            />
            <EyeToggle show={showOwnerPw} onToggle={() => setShowOwnerPw((v) => !v)} />
          </div>
          <CapsLockWarning on={capsOn} />
          {rememberRow}

          <AuthError message={error} />
          {resendBlock}

          <button type="submit" disabled={busy} className={`${authPrimaryBtnCls} mt-5`}>
            {busy ? (
              <>
                <Icon name="circle-notch" className="animate-spin" /> Signing in…
              </>
            ) : (
              "Log in as Owner"
            )}
          </button>

          <SocialButtons
            google={Boolean(branding?.googleEnabled)}
            facebook={Boolean(branding?.facebookEnabled)}
          />

          <div className="mt-4 text-right">
            <Link href="/forgot-password" className="text-sm font-semibold text-[#15803d] hover:underline">
              Forgot password?
            </Link>
          </div>
          <p className="mt-2 text-center text-xs leading-relaxed text-stone-400">
            Store staff without an email on their account can instead ask their store
            owner to set a new password in Settings → User Management.
          </p>
        </form>
      ) : (
        <form onSubmit={submitStaff} autoComplete="off">
          <label className={authLabelCls} htmlFor="store-code">
            Store Code
          </label>
          <div className="relative">
            <FieldIcon name="store" />
            <input
              id="store-code"
              className={authInputCls}
              value={storeCode}
              onChange={(e) => setStoreCode(e.target.value)}
              placeholder="e.g. STR-A1B2C3"
              required
            />
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-stone-400">
            Your Store Code is required. It identifies your store — ask your store
            owner if you don&apos;t know it.
          </p>

          <label className={`${authLabelCls} mt-4`} htmlFor="staff-username">
            Staff Username
          </label>
          <div className="relative">
            <FieldIcon name="user" />
            <input
              id="staff-username"
              className={authInputCls}
              value={staffUsername}
              onChange={(e) => setStaffUsername(e.target.value)}
              placeholder="e.g. cashier1"
              required
            />
          </div>

          <label className={`${authLabelCls} mt-4`} htmlFor="staff-password">
            Password
          </label>
          <div className="relative">
            <FieldIcon name="lock" />
            <input
              id="staff-password"
              type={showStaffPw ? "text" : "password"}
              className={authInputWithEyeCls}
              value={staffPw}
              onChange={(e) => setStaffPw(e.target.value)}
              placeholder="Enter your staff password"
              required
            />
            <EyeToggle show={showStaffPw} onToggle={() => setShowStaffPw((v) => !v)} />
          </div>
          <CapsLockWarning on={capsOn} />
          {rememberRow}

          <AuthError message={error} />
          {resendBlock}

          <button type="submit" disabled={busy} className={`${authPrimaryBtnCls} mt-5`}>
            {busy ? (
              <>
                <Icon name="circle-notch" className="animate-spin" /> Signing in…
              </>
            ) : (
              "Log in as Staff"
            )}
          </button>

          <SocialButtons
            google={Boolean(branding?.googleEnabled)}
            facebook={Boolean(branding?.facebookEnabled)}
          />
        </form>
      )}

      <p className="mt-5 text-center text-sm text-stone-500">
        Don&apos;t have an account yet?{" "}
        <Link href="/register" className="font-bold text-[#15803d] hover:underline">
          Register now
        </Link>
      </p>
    </AuthCard>
  );
}
