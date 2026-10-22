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
    <div className={`rounded-2xl border border-stone-200 bg-white shadow-sm ${className}`}>
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
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-bold text-stone-800">
        <span className="text-[var(--brand)]">
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
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-2xl text-stone-400">
        <Icon name={icon} />
      </span>
      <p className="font-semibold text-stone-700">{title}</p>
      {hint && <p className="max-w-sm text-sm text-stone-500">{hint}</p>}
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
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    stone: "bg-stone-200 text-stone-700",
    blue: "bg-sky-100 text-sky-800",
    violet: "bg-violet-100 text-violet-800",
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
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        className={`nice-scroll max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-xl sm:rounded-3xl ${
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
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/25 placeholder:text-stone-400";
export const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500";
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50";
export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50";
