"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuthBranding, loginAction, type LoginMode } from "@/server/actions";
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

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<LoginMode>("owner");

  // Owner / Main tab
  const [identifier, setIdentifier] = useState("");
  const [ownerPw, setOwnerPw] = useState("");
  const [showOwnerPw, setShowOwnerPw] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // Branch Staff tab
  const [storeCode, setStoreCode] = useState("");
  const [staffUsername, setStaffUsername] = useState("");
  const [staffPw, setStaffPw] = useState("");
  const [showStaffPw, setShowStaffPw] = useState(false);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const capsOn = useCapsLock();

  const [branding, setBranding] = useState<{
    storeName: string;
    googleEnabled: boolean;
    facebookEnabled: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAuthBranding()
      .then((b) => {
        if (!cancelled) setBranding(b);
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
    setShowForgot(false);
  };

  const submitOwner = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await loginAction(identifier, ownerPw, "owner");
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
    setBusy(true);
    try {
      await loginAction(staffUsername, staffPw, "staff", storeCode);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setBusy(false);
    }
  };

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

          <AuthError message={error} />

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
            <button
              type="button"
              className="text-sm font-semibold text-[#15803d] hover:underline"
              onClick={() => setShowForgot((v) => !v)}
            >
              Forgot password?
            </button>
          </div>
          {showForgot && (
            <p className="mt-2 rounded-2xl bg-stone-100 px-4 py-2.5 text-center text-xs leading-relaxed text-stone-500">
              Passwords are reset by the store owner — ask them to set a new one for
              your account in Settings → User Management.
            </p>
          )}
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
              placeholder="e.g. STR-A1B2 or Branch Code"
            />
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-stone-400">
            Leave this blank if your store has not given you a store code — you can
            still sign in with your staff username below.
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

          <AuthError message={error} />

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
