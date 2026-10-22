"use client";

import type { SettingsDTO } from "@/lib/types";

/** ₱ formatting with two decimals, e.g. ₱1,234.50 */
export function peso(n: number): string {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtInt(n: number): string {
  return n.toLocaleString("en-PH");
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Renders an ISO timestamp in the store's configured date format. */
export function fmtDate(iso: string | null | undefined, settings?: SettingsDTO | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const fmt = settings?.dateFormat ?? "mdy";
  if (fmt === "iso") {
    const p = (x: number) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  if (fmt === "dmy") return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function fmtDateTime(iso: string | null | undefined, settings?: SettingsDTO | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const time = d.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
  return `${fmtDate(iso, settings)} · ${time}`;
}

/** A YYYY-MM-DD expiry string rendered for display. */
export function fmtExpiry(ymd: string | null | undefined): string {
  if (!ymd) return "No expiry";
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return ymd;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** Whole days from today (Asia/Manila) until a YYYY-MM-DD date; negative = past. */
export function daysUntil(ymd: string): number {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const a = new Date(`${today}T00:00:00`);
  const b = new Date(`${ymd}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Today as YYYY-MM-DD (Asia/Manila). */
export function todayYMD(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

/** Downloads a text file (used for CSV exports and the import template). */
export function downloadTextFile(filename: string, text: string, mime = "text/csv"): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Minimal CSV parser: handles quoted cells, escaped quotes and commas.
 * Returns rows of string cells (first row is the header).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushCell();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch === "\r") {
      // ignore — \n handles the break
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) pushRow();
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Product stock status derived from quantity vs reorder level. */
export function stockStatus(p: { quantity: number; reorderLevel: number }):
  | "out"
  | "low"
  | "ok" {
  if (p.quantity <= 0) return "out";
  if (p.quantity <= p.reorderLevel) return "low";
  return "ok";
}
