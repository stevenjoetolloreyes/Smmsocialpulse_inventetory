"use client";

import type { ReactNode } from "react";

/** Font Awesome solid icon (owner's supplied icon pack, FA 6.5.2). */
export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <i className={`fa-solid fa-${name} ${className}`} aria-hidden="true" />;
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[24px] bg-white shadow-[0_10px_36px_-16px_rgb(28_25_23/0.14)] ring-1 ring-stone-900/5 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  icon,
  title,
  right,
}: {
  icon: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-stone-800">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-base text-[var(--brand)]">
          <Icon name={icon} />
        </span>
        {title}
      </h2>
      {right}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-200 px-4 py-10 text-center">
      <span className="text-3xl text-stone-300">
        <Icon name={icon} />
      </span>
      <p className="font-bold text-stone-600">{title}</p>
      {hint && <p className="max-w-sm text-sm text-stone-400">{hint}</p>}
      {action}
    </div>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red" | "stone" | "blue" | "violet";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-500",
    stone: "bg-stone-100 text-stone-500",
    blue: "bg-sky-50 text-sky-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  icon,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-stone-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div
        className={`nice-scroll max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-white shadow-2xl ring-1 ring-stone-900/10 sm:rounded-[28px] ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white px-5 py-4">
          <h3 className="flex items-center gap-2 font-bold text-stone-800">
            {icon && (
              <span className="text-[var(--brand)]">
                <Icon name={icon} />
              </span>
            )}
            {title}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200"
            aria-label="Close"
          >
            <Icon name="xmark" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/25 placeholder:text-stone-400";
export const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500";
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
