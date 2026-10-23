"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useStore } from "./store";
import { Icon } from "./ui";
import { ProductThumb } from "./Qr";
import { fmtDate, fmtDateTime, fmtInt, peso, stockStatus } from "@/lib/format";
import type { SaleDTO } from "@/lib/types";

type Period = "today" | "week" | "month" | "all";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Last 7 Days" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
];

const SALES_CARD_LABEL: Record<Period, string> = {
  today: "Today's Sales",
  week: "Sales — Last 7 Days",
  month: "Sales This Month",
  all: "Total Sales",
};

const CHART_TITLE: Record<Period, string> = {
  today: "Today's Sales",
  week: "Sales — Last 7 Days",
  month: "Sales This Month",
  all: "All-Time Sales",
};

/** Manila calendar date (YYYY-MM-DD) `offset` days before today. */
function dayStr(offset: number): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(new Date());
  if (offset === 0) return today;
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - offset));
  return dt.toISOString().slice(0, 10);
}

function saleStatus(s: SaleDTO): "Completed" | "Partial return" | "Returned" {
  const totalBase = s.items.reduce((a, i) => a + i.qtyBase, 0);
  const returned = s.items.reduce((a, i) => a + i.returnedQtyBase, 0);
  if (returned <= 0) return "Completed";
  if (totalBase > 0 && returned >= totalBase) return "Returned";
  return "Partial return";
}

const cardCls =
  "rounded-[24px] bg-white shadow-[0_10px_36px_-16px_rgb(28_25_23/0.14)] ring-1 ring-stone-900/5";

function PeriodSelect({
  value,
  onChange,
  label,
}: {
  value: Period;
  onChange: (p: Period) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as Period)}
      className="cursor-pointer rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-300 focus:border-emerald-500 focus:outline-none"
    >
      {PERIODS.map((p) => (
        <option key={p.key} value={p.key}>
          {p.label}
        </option>
      ))}
    </select>
  );
}

function SectionCard({
  title,
  subtitle,
  right,
  children,
  delay = 0,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <section className={`${cardCls} ims-card p-5`} style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold tracking-tight text-stone-800">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-stone-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Dashboard() {
  const { data, setView, openProduct } = useStore();
  const { products, sales, settings } = data;
  const [period, setPeriod] = useState<Period>("all");

  // One-time banner right after the setup wizard launches the store.
  const [setupDone, setSetupDone] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("setup") === "done") {
      setSetupDone(true);
      window.history.replaceState(null, "", "/");
    }
  }, []);

  const model = useMemo(() => {
    const todayStr = dayStr(0);
    const monthKey = todayStr.slice(0, 7);
    const weekStart = dayStr(6);

    const inPeriod = (s: SaleDTO): boolean => {
      const d = s.createdAt.slice(0, 10);
      switch (period) {
        case "today":
          return d === todayStr;
        case "week":
          return d >= weekStart && d <= todayStr;
        case "month":
          return s.createdAt.slice(0, 7) === monthKey;
        default:
          return true;
      }
    };
    const periodSales = sales.filter(inPeriod);
    const periodTotal = periodSales.reduce((a, s) => a + s.total, 0);

    // Chart buckets per period.
    type Bucket = { label: string; total: number };
    let buckets: Bucket[] = [];
    if (period === "all") {
      const now = new Date();
      for (let back = 5; back >= 0; back--) {
        const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        buckets.push({
          label: d.toLocaleString("en-PH", { month: "short" }),
          total: sales
            .filter((s) => s.createdAt.slice(0, 7) === key)
            .reduce((a, s) => a + s.total, 0),
        });
      }
    } else if (period === "month") {
      const [y, m] = monthKey.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      for (let day = 1; day <= lastDay; day++) {
        const key = `${monthKey}-${String(day).padStart(2, "0")}`;
        buckets.push({
          label: String(day),
          total: periodSales
            .filter((s) => s.createdAt.slice(0, 10) === key)
            .reduce((a, s) => a + s.total, 0),
        });
      }
    } else if (period === "week") {
      for (let back = 6; back >= 0; back--) {
        const key = dayStr(back);
        const dt = new Date(`${key}T00:00:00`);
        buckets.push({
          label: dt.toLocaleDateString("en-PH", { weekday: "short" }),
          total: periodSales
            .filter((s) => s.createdAt.slice(0, 10) === key)
            .reduce((a, s) => a + s.total, 0),
        });
      }
    } else {
      // Today: hourly buckets across store hours, widened to fit any sale.
      const hours = periodSales
        .map((s) => parseInt(s.createdAt.slice(11, 13), 10))
        .filter((h) => Number.isFinite(h));
      const from = Math.min(6, ...(hours.length ? hours : [6]));
      const to = Math.max(21, ...(hours.length ? hours : [21]));
      for (let h = from; h <= to; h++) {
        const label = `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;
        buckets.push({
          label,
          total: periodSales
            .filter((s) => parseInt(s.createdAt.slice(11, 13), 10) === h)
            .reduce((a, s) => a + s.total, 0),
        });
      }
    }
    const chartMax = Math.max(...buckets.map((b) => b.total), 1);
    const best = buckets.reduce<Bucket | null>(
      (acc, b) => (b.total > 0 && (!acc || b.total > acc.total) ? b : acc),
      null,
    );

    // Daily average divisor: the number of days the period spans.
    let days = 1;
    if (period === "week") days = 7;
    else if (period === "month") days = Math.max(parseInt(todayStr.slice(8, 10), 10), 1);
    else if (period === "all" && sales.length) {
      const earliest = sales.reduce(
        (min, s) => (s.createdAt.slice(0, 10) < min ? s.createdAt.slice(0, 10) : min),
        todayStr,
      );
      const [ey, em, ed] = earliest.split("-").map(Number);
      const [ty, tm, td] = todayStr.split("-").map(Number);
      days = Math.max(
        Math.round(
          (Date.UTC(ty, tm - 1, td) - Date.UTC(ey, em - 1, ed)) / 86_400_000,
        ) + 1,
        1,
      );
    }
    const dailyAverage = periodTotal / days;

    // Top sellers within the selected period.
    const map = new Map<number, { name: string; qty: number; revenue: number }>();
    for (const s of periodSales) {
      for (const it of s.items) {
        const cur = map.get(it.itemId) ?? { name: it.productName, qty: 0, revenue: 0 };
        cur.qty += it.qtyUnits;
        cur.revenue += it.lineTotal;
        map.set(it.itemId, cur);
      }
    }
    const topSellers = [...map.entries()]
      .map(([itemId, v]) => ({ itemId, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const latest = [...sales].sort((a, b) => b.id - a.id).slice(0, 6);

    const low = products.filter((p) => stockStatus(p) === "low");
    const out = products.filter((p) => stockStatus(p) === "out");
    const okCount = products.filter((p) => stockStatus(p) === "ok").length;
    const totalUnits = products.reduce((s, p) => s + p.quantity, 0);
    const totalValue = products.reduce((s, p) => s + p.quantity * p.costPrice, 0);

    return {
      periodSales,
      periodTotal,
      buckets,
      chartMax,
      best,
      dailyAverage,
      topSellers,
      latest,
      low,
      out,
      okCount,
      totalUnits,
      totalValue,
    };
  }, [products, sales, period]);

  const areaStats = useMemo(() => {
    const map = new Map<string, { units: number; settled: number; unsettled: number; products: Set<number> }>();
    for (const p of products) {
      for (const b of p.batches) {
        if (b.status !== "active" && b.status !== "expired" && b.status !== "recalled") continue;
        if (b.qtyRemaining <= 0) continue;
        const area = b.area || p.area || "Unassigned";
        const cur = map.get(area) ?? { units: 0, settled: 0, unsettled: 0, products: new Set<number>() };
        cur.units += b.qtyRemaining;
        cur.products.add(p.id);
        if (b.placed) cur.settled += b.qtyRemaining;
        else cur.unsettled += b.qtyRemaining;
        map.set(area, cur);
      }
    }
    return [...map.entries()].map(([name, v]) => ({
      name,
      units: v.units,
      settled: v.settled,
      unsettled: v.unsettled,
      productCount: v.products.size,
    }));
  }, [products]);

  const activeUsers = data.staff.filter((s) => s.active).length;
  const plan = data.plan;
  const totalProducts = Math.max(products.length, 1);
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "All Time";

  const statusRows = [
    {
      key: "out",
      label: "Out of Stock",
      count: model.out.length,
      pct: Math.round((model.out.length / totalProducts) * 100),
      icon: "circle-xmark",
      tile: "bg-red-100 text-red-500",
      bar: "bg-red-400",
      pctCls: "text-red-500",
    },
    {
      key: "low",
      label: "Low Stock",
      count: model.low.length,
      pct: Math.round((model.low.length / totalProducts) * 100),
      icon: "triangle-exclamation",
      tile: "bg-amber-100 text-amber-500",
      bar: "bg-amber-400",
      pctCls: "text-amber-500",
    },
    {
      key: "ok",
      label: "Healthy Stock",
      count: model.okCount,
      pct: Math.round((model.okCount / totalProducts) * 100),
      icon: "circle-check",
      tile: "bg-emerald-100 text-emerald-500",
      bar: "bg-emerald-400",
      pctCls: "text-emerald-500",
    },
  ];

  return (
    <div className="space-y-4">
      {setupDone && (
        <div className="flex items-start gap-3 rounded-[24px] bg-emerald-600 px-4 py-3.5 text-white shadow">
          <span className="mt-0.5 text-lg">
            <Icon name="circle-check" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Setup completed — welcome to your store!</p>
            <p className="text-sm text-white/85">
              {data.store.name} is live on the {plan.name} plan. Add your first product in
              Inventory, or scan a QR code to stock in.
            </p>
          </div>
          <button
            onClick={() => setSetupDone(false)}
            className="rounded-full p-1 text-white/70 hover:bg-white/15 hover:text-white"
            aria-label="Dismiss"
          >
            <Icon name="xmark" />
          </button>
        </div>
      )}

      {/* Overview header */}
      <section className={`${cardCls} ims-card p-5`} style={{ animationDelay: "0ms" }}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-extrabold tracking-tight text-stone-800">
              Sales Overview
            </h2>
            <p className="mt-1 text-sm text-stone-400">
              Monitor today&rsquo;s sales, stock, and product activity.
            </p>
          </div>
          <PeriodSelect value={period} onChange={setPeriod} label="Overview period" />
        </div>
      </section>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <button
          onClick={() => setView("sales-report")}
          className="ims-card ims-card-hover relative overflow-hidden rounded-[24px] bg-[#eef6ff] p-5 text-left shadow-[0_10px_36px_-16px_rgb(28_25_23/0.14)] ring-1 ring-sky-900/5"
          style={{ animationDelay: "60ms" }}
        >
          <span className="pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 select-none text-[110px] font-black leading-none text-sky-900/5">
            ₱
          </span>
          <span className="relative flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-lg text-sky-600">
              <Icon name="arrow-trend-up" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-stone-500">
                {SALES_CARD_LABEL[period]}
              </span>
              <span className="block truncate text-[26px] font-extrabold leading-tight text-stone-800">
                {peso(model.periodTotal)}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <Icon name="arrow-up" className="text-[9px]" /> Current selected period ·{" "}
                {model.periodSales.length} sale{model.periodSales.length === 1 ? "" : "s"}
              </span>
            </span>
          </span>
        </button>

        <button
          onClick={() => setView("inventory")}
          className="ims-card ims-card-hover relative overflow-hidden rounded-[24px] bg-[#fdf6e9] p-5 text-left shadow-[0_10px_36px_-16px_rgb(28_25_23/0.14)] ring-1 ring-amber-900/5"
          style={{ animationDelay: "120ms" }}
        >
          {model.low.length + model.out.length > 0 && (
            <span className="absolute right-4 top-4 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
              Alerts: {model.low.length + model.out.length}
            </span>
          )}
          <span className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-lg text-amber-600">
              <Icon name="cube" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-stone-500">Low Stock Items</span>
              <span className="block text-[26px] font-extrabold leading-tight text-stone-800">
                {fmtInt(model.low.length)} item{model.low.length === 1 ? "" : "s"}
              </span>
              <span className="mt-0.5 block text-xs font-medium text-stone-400">
                {model.low.length > 0
                  ? "Review and restock soon"
                  : "All stock levels are healthy"}
              </span>
            </span>
          </span>
        </button>

        <button
          onClick={() => setView("inventory")}
          className="ims-card ims-card-hover relative overflow-hidden rounded-[24px] bg-[#edf9f0] p-5 text-left shadow-[0_10px_36px_-16px_rgb(28_25_23/0.14)] ring-1 ring-emerald-900/5"
          style={{ animationDelay: "180ms" }}
        >
          <span className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-lg text-emerald-600">
              <Icon name="tag" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-stone-500">Inventory Products</span>
              <span className="block text-[26px] font-extrabold leading-tight text-stone-800">
                {fmtInt(products.length)}
              </span>
              <span className="mt-0.5 block text-xs font-semibold text-emerald-600">
                Across {fmtInt(products.length)} SKU{products.length === 1 ? "" : "s"} ·{" "}
                {fmtInt(model.totalUnits)} units
              </span>
            </span>
          </span>
        </button>
      </div>

      {/* Active plan strip */}
      <section
        className={`${cardCls} ims-card flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5`}
        style={{ animationDelay: "220ms" }}
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400">
          <Icon name="crown" /> Active Plan
        </span>
        <span className="rounded-full bg-[var(--brand)] px-3 py-1 text-sm font-bold text-white">
          {plan.name}
          {plan.priceMonthly > 0 && (
            <span className="ml-1 font-medium text-white/75">{peso(plan.priceMonthly)}/mo</span>
          )}
        </span>
        <span className="text-sm text-stone-600">
          Users <strong>{activeUsers}</strong> of{" "}
          <strong>{plan.maxUsers === 0 ? "unlimited" : plan.maxUsers}</strong>
        </span>
        <span className="flex items-center gap-1.5 text-sm text-stone-600">
          <span className={plan.imageUpload ? "text-emerald-600" : "text-red-500"}>
            <Icon name={plan.imageUpload ? "check" : "xmark"} />
          </span>
          Product images
        </span>
        <span className="flex items-center gap-1.5 text-sm text-stone-600">
          <span className={plan.reportExport ? "text-emerald-600" : "text-red-500"}>
            <Icon name={plan.reportExport ? "check" : "xmark"} />
          </span>
          Report export
        </span>
        {data.store.planExpiresAt && data.store.planId !== "free" && (
          <span className="text-sm text-stone-500">
            Plan until {fmtDate(data.store.planExpiresAt)}
          </span>
        )}
        <button
          className="ml-auto text-sm font-bold text-[var(--brand)] hover:underline"
          onClick={() => setView("subscription")}
        >
          View Subscription <Icon name="arrow-right" className="text-xs" />
        </button>
      </section>

      {/* Sales chart */}
      <SectionCard
        title={CHART_TITLE[period]}
        right={<PeriodSelect value={period} onChange={setPeriod} label="Chart period" />}
        delay={280}
      >
        {model.periodSales.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-stone-200 px-4 py-12 text-center">
            <span className="text-3xl text-stone-300">
              <Icon name="chart-column" />
            </span>
            <p className="mt-3 font-bold text-stone-600">No sales data available</p>
            <p className="mt-1 text-sm text-stone-400">
              Try selecting another reporting period.
            </p>
          </div>
        ) : (
          <div className="flex h-44 items-end gap-2 px-1 pt-2">
            {model.buckets.map((b, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="max-w-full truncate text-[10px] font-semibold text-stone-500">
                  {b.total > 0 && period !== "month" ? peso(b.total) : ""}
                </span>
                <div
                  className="w-full max-w-14 rounded-t-lg bg-sky-400/90 transition-all"
                  style={{
                    height: `${Math.max((b.total / model.chartMax) * 118, b.total > 0 ? 6 : 2)}px`,
                  }}
                  title={`${b.label}: ${peso(b.total)}`}
                />
                <span className="max-w-full truncate text-[11px] font-medium text-stone-500">
                  {b.label}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 grid grid-cols-3 divide-x divide-stone-100 rounded-2xl bg-stone-50 py-3 text-center">
          <div className="px-2">
            <p className="text-xs font-medium text-stone-400">Period Total</p>
            <p className="mt-0.5 truncate font-extrabold text-stone-800">
              {peso(model.periodTotal)}
            </p>
          </div>
          <div className="px-2">
            <p className="text-xs font-medium text-stone-400">Daily Average</p>
            <p className="mt-0.5 truncate font-extrabold text-stone-800">
              {peso(model.dailyAverage)}
            </p>
          </div>
          <div className="px-2">
            <p className="text-xs font-medium text-stone-400">Best Period</p>
            <p className="mt-0.5 truncate font-extrabold text-stone-800">
              {model.best ? `${model.best.label} · ${peso(model.best.total)}` : "—"}
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Inventory status */}
        <SectionCard title="Inventory Status" subtitle="Overview of your stock health" delay={340}>
          <div className="space-y-2">
            {statusRows.map((r) => (
              <button
                key={r.key}
                onClick={() => setView("inventory")}
                className="block w-full rounded-2xl px-2 py-2 text-left transition hover:bg-stone-50"
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${r.tile}`}
                  >
                    <Icon name={r.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-stone-700">{r.label}</span>
                    <span className="block text-sm font-bold text-stone-800">{fmtInt(r.count)}</span>
                  </span>
                  <span className={`text-sm font-bold ${r.pctCls}`}>{r.pct}%</span>
                  <Icon name="chevron-right" className="text-xs text-stone-300" />
                </span>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-stone-100">
                  <span className={`block h-full rounded-full ${r.bar}`} style={{ width: `${r.pct}%` }} />
                </span>
              </button>
            ))}
          </div>

          {(model.low.length > 0 || model.out.length > 0) && (
            <div className="mt-3 space-y-1 border-t border-stone-100 pt-3">
              <p className="px-2 text-xs font-bold uppercase tracking-wide text-stone-400">
                Needs restocking
              </p>
              {[...model.out, ...model.low].slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  onClick={() => openProduct(p.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-stone-50"
                >
                  <ProductThumb name={p.name} imageUrl={p.imageUrl} size={28} />
                  <span className="flex-1 truncate text-sm font-medium text-stone-700">{p.name}</span>
                  <span
                    className={`text-xs font-bold ${p.quantity <= 0 ? "text-red-600" : "text-amber-600"}`}
                  >
                    {fmtInt(p.quantity)} left
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 px-2 pt-3 text-sm">
            <span className="text-stone-500">
              Inventory value <strong className="text-stone-800">{peso(model.totalValue)}</strong>
            </span>
            <button
              onClick={() => setView("inventory")}
              className="font-bold text-sky-600 hover:underline"
            >
              All inventory products <Icon name="chevron-right" className="text-[10px]" />
            </button>
          </div>
        </SectionCard>

        {/* Storage areas */}
        <SectionCard
          title="Storage Areas"
          subtitle="Settled and unsettled stock per area"
          right={
            <button
              onClick={() => setView("status")}
              className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-600 transition hover:bg-stone-200"
            >
              Details <Icon name="arrow-right" className="text-[10px]" />
            </button>
          }
          delay={400}
        >
          {areaStats.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-stone-200 px-4 py-10 text-center">
              <span className="text-3xl text-stone-300">
                <Icon name="warehouse" />
              </span>
              <p className="mt-3 font-bold text-stone-600">No stock placed yet</p>
              <p className="mt-1 text-sm text-stone-400">
                Receive or restock products into storage areas to see settled and unsettled
                counts here.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {areaStats.map((a) => (
                <li key={a.name} className="rounded-2xl bg-stone-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-stone-700">{a.name}</p>
                    <span className="text-xs font-medium text-stone-400">
                      {a.productCount} product(s) · {fmtInt(a.units)} units
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                      Settled: {fmtInt(a.settled)}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                      Unsettled: {fmtInt(a.unsettled)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Latest transactions */}
        <SectionCard
          title="Latest Transactions"
          subtitle="Most recent sales activity"
          right={
            <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-600">
              Recent
            </span>
          }
          delay={460}
        >
          {model.latest.length === 0 ? (
            <p className="py-10 text-center text-sm font-medium text-stone-400">
              No transactions yet
            </p>
          ) : (
            <>
              <div className="mb-1 hidden grid-cols-[1.2fr_1.6fr_0.8fr_0.9fr] gap-3 border-b border-stone-100 pb-2 text-[11px] font-bold uppercase tracking-wider text-stone-400 sm:grid">
                <span>Transaction ID</span>
                <span>Products</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Status</span>
              </div>
              <ul className="divide-y divide-stone-50">
                {model.latest.map((s) => {
                  const st = saleStatus(s);
                  const names = [...new Set(s.items.map((i) => i.productName))];
                  const units = s.items.reduce((a, i) => a + i.qtyUnits, 0);
                  return (
                    <li
                      key={s.id}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-3 sm:grid-cols-[1.2fr_1.6fr_0.8fr_0.9fr]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-stone-700">{s.orNumber}</p>
                        <p className="text-xs text-stone-400">
                          {fmtDateTime(s.createdAt, settings)} · {s.cashier}
                        </p>
                      </div>
                      <p className="order-3 col-span-2 truncate text-sm text-stone-500 sm:order-none sm:col-span-1">
                        {names.slice(0, 2).join(", ")}
                        {names.length > 2 ? ` +${names.length - 2} more` : ""} · {units} item
                        {units === 1 ? "" : "s"}
                      </p>
                      <p className="text-right text-sm font-extrabold text-stone-800">
                        {peso(s.total)}
                      </p>
                      <p className="order-4 text-right sm:order-none">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            st === "Completed"
                              ? "bg-emerald-50 text-emerald-600"
                              : st === "Returned"
                                ? "bg-red-50 text-red-500"
                                : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {st}
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ul>
              <button
                onClick={() => setView("sales-report")}
                className="mt-2 text-sm font-bold text-sky-600 hover:underline"
              >
                View full sales report <Icon name="arrow-right" className="text-xs" />
              </button>
            </>
          )}
        </SectionCard>

        {/* Top selling products */}
        <SectionCard
          title="Top Selling Products"
          subtitle={periodLabel}
          right={<PeriodSelect value={period} onChange={setPeriod} label="Top sellers period" />}
          delay={520}
        >
          {model.topSellers.length === 0 ? (
            <p className="py-10 text-center text-sm font-medium text-stone-400">
              No product sales yet
            </p>
          ) : (
            <ul className="space-y-2.5">
              {model.topSellers.map((t, i) => (
                <li key={t.itemId} className="flex items-center gap-3 text-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-500">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-stone-700">{t.name}</span>
                    <span className="block text-xs text-stone-400">{fmtInt(t.qty)} sold</span>
                  </span>
                  <span className="font-extrabold text-stone-800">{peso(t.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-sm">
            <span className="font-medium text-stone-500">Total Sales</span>
            <span className="font-extrabold text-stone-800">{peso(model.periodTotal)}</span>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
