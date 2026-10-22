"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "./ui";

/* ------------------------------------------------------------------ */
/*  Background: soft mint-to-cream gradient with an original,        */
/*  softly blurred store-shelf illustration drawn in inline SVG.     */
/* ------------------------------------------------------------------ */

function ShelfIllustration() {
  // Original artwork: simple shelves holding jars, bottles and boxes in
  // muted pastel tones. Decorative only.
  const jar = (x: number, y: number, body: string, lid: string) => (
    <g key={`jar-${x}-${y}`}>
      <rect x={x} y={y} width="46" height="12" rx="4" fill={lid} />
      <rect x={x + 3} y={y + 10} width="40" height="58" rx="10" fill={body} opacity="0.9" />
      <circle cx={x + 16} cy={y + 34} r="4" fill="#ffffff" opacity="0.55" />
      <circle cx={x + 28} cy={y + 46} r="4" fill="#ffffff" opacity="0.4" />
      <circle cx={x + 22} cy={y + 56} r="3" fill="#ffffff" opacity="0.5" />
    </g>
  );
  const bottle = (x: number, y: number, body: string, cap: string) => (
    <g key={`bottle-${x}-${y}`}>
      <rect x={x + 12} y={y} width="12" height="10" rx="2" fill={cap} />
      <path
        d={`M ${x + 12} ${y + 10} h 12 l 6 12 v 46 a 8 8 0 0 1 -8 8 h -12 a 8 8 0 0 1 -8 -8 v -46 z`}
        fill={body}
        opacity="0.9"
      />
      <rect x={x + 6} y={y + 38} width="24" height="16" rx="3" fill="#ffffff" opacity="0.55" />
    </g>
  );
  const box = (x: number, y: number, w: number, h: number, body: string) => (
    <rect key={`box-${x}-${y}`} x={x} y={y} width={w} height={h} rx="5" fill={body} opacity="0.9" />
  );
  const shelf = (x: number, y: number, w: number) => (
    <rect key={`shelf-${x}-${y}`} x={x} y={y} width={w} height="10" rx="5" fill="#b08968" opacity="0.55" />
  );

  return (
    <svg
      className="h-full w-full"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* left shelving unit */}
      {shelf(40, 300, 300)}
      {shelf(40, 470, 300)}
      {shelf(40, 640, 300)}
      {jar(60, 232, "#f4a261", "#e76f51")}
      {jar(120, 232, "#e9c46a", "#d9a441")}
      {box(185, 238, 62, 62, "#90be6d")}
      {bottle(262, 222, "#43aa8b", "#277da1")}
      {bottle(70, 392, "#577590", "#3d5a80")}
      {box(130, 408, 70, 62, "#f3722c")}
      {jar(220, 402, "#9d6bc4", "#7b4fa6")}
      {box(60, 578, 76, 62, "#f9c74f")}
      {bottle(160, 562, "#90be6d", "#588157")}
      {jar(240, 572, "#f9844a", "#e76f51")}

      {/* right shelving unit */}
      {shelf(1100, 300, 300)}
      {shelf(1100, 470, 300)}
      {shelf(1100, 640, 300)}
      {bottle(1120, 222, "#f3722c", "#bc4749")}
      {jar(1180, 232, "#43aa8b", "#2a9d8f")}
      {box(1250, 238, 62, 62, "#e9c46a")}
      {jar(1330, 232, "#577590", "#3d5a80")}
      {box(1120, 408, 70, 62, "#9d6bc4")}
      {bottle(1220, 392, "#e9c46a", "#bc6c25")}
      {jar(1290, 402, "#f4a261", "#e76f51")}
      {jar(1120, 572, "#90be6d", "#588157")}
      {box(1200, 578, 76, 62, "#43aa8b")}
      {bottle(1300, 562, "#577590", "#277da1")}

      {/* top-center hanging sign board + counter hints */}
      <rect x="620" y="54" width="200" height="64" rx="14" fill="#ffffff" opacity="0.35" />
      <rect x="480" y="786" width="480" height="16" rx="8" fill="#b08968" opacity="0.3" />
      {box(520, 724, 56, 62, "#f9c74f")}
      {bottle(600, 708, "#f3722c", "#bc4749")}
      {jar(852, 718, "#43aa8b", "#2a9d8f")}
    </svg>
  );
}

export function AuthBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-gradient-to-b from-[#dff3e4] via-[#eef6e9] to-[#fdf3d8]" />
      <div className="absolute inset-0 opacity-70 blur-[2px]">
        <ShelfIllustration />
      </div>
      {/* keep the centre calm behind the card */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.55),rgba(255,255,255,0)_62%)]" />
      <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-white/40 blur-3xl" />
      <div className="absolute -right-20 bottom-24 h-80 w-80 rounded-full bg-white/40 blur-3xl" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card shell with logo header + legal footer                        */
/* ------------------------------------------------------------------ */

export function AuthCard({
  heading,
  subtitle,
  children,
}: {
  heading: string;
  subtitle: string;
  children: ReactNode;
}) {
  const year = new Date().getFullYear();
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <AuthBackground />
      <div className="relative w-full max-w-md rounded-[24px] bg-white/95 p-7 shadow-[0_24px_60px_-16px_rgba(20,83,45,0.35)] ring-1 ring-black/5 backdrop-blur sm:p-9">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#16a34a] to-[#14532d] text-2xl text-white shadow-md">
            <Icon name="boxes-stacked" />
          </span>
          <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-[#14532d]">
            {heading}
          </h1>
          <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
        </div>

        {children}

        <div className="mt-7 border-t border-stone-200 pt-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500">
            Inventory Management System v1.0
          </p>
          <p className="mt-1 text-xs text-stone-400">
            © {year} Inventory Management System. All rights reserved.
          </p>
          <p className="mx-auto mt-2 max-w-sm text-[11px] leading-relaxed text-stone-400">
            This system uses only essential cookies — one secure session cookie that
            keeps you signed in. It does not use advertising or analytics cookies.
          </p>
          <p className="mt-2 text-xs font-medium">
            <Link href="/privacy" className="text-[#15803d] hover:underline">
              Privacy Policy
            </Link>
            <span className="mx-2 text-stone-300">·</span>
            <Link href="/terms" className="text-[#15803d] hover:underline">
              Terms of Service
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared form bits                                                  */
/* ------------------------------------------------------------------ */

export const authLabelCls =
  "mb-1.5 block text-[13px] font-bold text-stone-600";
export const authInputCls =
  "w-full rounded-full border border-stone-300 bg-white py-2.5 pl-11 pr-4 text-sm text-stone-900 shadow-inner outline-none transition placeholder:text-stone-400 focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/25";
export const authInputWithEyeCls =
  "w-full rounded-full border border-stone-300 bg-white py-2.5 pl-11 pr-11 text-sm text-stone-900 shadow-inner outline-none transition placeholder:text-stone-400 focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/25";
export const authPrimaryBtnCls =
  "flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#16a34a] to-[#15803d] py-3 text-[15px] font-bold text-white shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60";

export function FieldIcon({ name }: { name: string }) {
  return (
    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-stone-400">
      <Icon name={name} />
    </span>
  );
}

export function EyeToggle({
  show,
  onToggle,
}: {
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
      aria-label={show ? "Hide password" : "Show password"}
    >
      <Icon name={show ? "eye-slash" : "eye"} />
    </button>
  );
}

/** Tracks the keyboard Caps Lock state for the password warning. */
export function useCapsLock(): boolean {
  const [capsOn, setCapsOn] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (typeof e.getModifierState === "function") {
        setCapsOn(e.getModifierState("CapsLock"));
      }
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", handler);
    };
  }, []);
  return capsOn;
}

export function CapsLockWarning({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-600">
      <Icon name="triangle-exclamation" /> Caps Lock is on
    </p>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="mt-3 rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
      {message}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Social sign-in buttons (rendered ONLY when the owner has         */
/*  configured the matching provider credentials)                     */
/* ------------------------------------------------------------------ */

export function GoogleMark() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

export function FacebookMark() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.49h-2.8V24C19.62 23.1 24 18.1 24 12.07z"
      />
    </svg>
  );
}

export function SocialButtons({
  google,
  facebook,
}: {
  google: boolean;
  facebook: boolean;
}) {
  if (!google && !facebook) return null;
  const btnCls =
    "flex w-full items-center justify-center gap-2.5 rounded-full border border-stone-300 bg-white py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50";
  return (
    <div className="mt-5">
      <div className="flex items-center gap-3 text-xs text-stone-400">
        <span className="h-px flex-1 bg-stone-200" />
        or continue with
        <span className="h-px flex-1 bg-stone-200" />
      </div>
      <div className="mt-3 space-y-2.5">
        {google && (
          <Link href="/auth/social/google" className={btnCls}>
            <GoogleMark /> Continue with Google
          </Link>
        )}
        {facebook && (
          <Link href="/auth/social/facebook" className={btnCls}>
            <FacebookMark /> Continue with Facebook
          </Link>
        )}
      </div>
    </div>
  );
}
