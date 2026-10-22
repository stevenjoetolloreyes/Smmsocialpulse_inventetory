"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "./store";
import { Card, EmptyState, Icon, SectionTitle, btnGhost } from "./ui";
import { ProductThumb } from "./Qr";
import { fmtDate, fmtDateTime, fmtInt, peso, stockStatus } from "@/lib/format";

export function Dashboard() {
  const { data, setView, openProduct } = useStore();
  const { products, sales, settings } = data;

  // One-time banner right after the setup wizard launches the store.
  const [setupDone, setSetupDone] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("setup") === "done") {
      setSetupDone(true);
      window.history.replaceState(null, "", "/");
    }
  }, []);

  const stats = useMemo(() => {
    const totalValue = products.reduce((s, p) => s + p.quantity * p.costPrice, 0);
    const totalUnits = products.reduce((s, p) => s + p.quantity, 0);
    const low = products.filter((p) => stockStatus(p) === "low");
    const out = products.filter((p) => stockStatus(p) === "out");
    const salesTotal = sales.reduce((s, x) => s + x.total, 0);
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const todaySales = sales.filter((x) => x.createdAt.slice(0, 10) === todayStr);
    const monthKey = todayStr.slice(0, 7);
    const monthSales = sales.filter((x) => x.createdAt.slice(0, 7) === monthKey);
    return {
      totalValue,
      totalUnits,
      low,
      out,
      salesTotal,
      todaySales,
      todayTotal: todaySales.reduce((s, x) => s + x.total, 0),
      monthTotal: monthSales.reduce((s, x) => s + x.total, 0),
      monthCount: monthSales.length,
    };
  }, [products, sales]);

  const chart = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; total: number }[] = [];
    for (let back = 5; back >= 0; back--) {
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: d.toLocaleString("en-PH", { month: "short" }),
        total: sales.filter((s) => s.createdAt.slice(0, 7) === key).reduce((a, s) => a + s.total, 0),
      });
    }
    const max = Math.max(...months.map((m) => m.total), 1);
    return { months, max };
  }, [sales]);

  const topSellers = useMemo(() => {
    const map = new Map<number, { name: string; qty: number; revenue: number }>();
    for (const s of sales) {
      for (const it of s.items) {
        const cur = map.get(it.itemId) ?? { name: it.productName, qty: 0, revenue: 0 };
        cur.qty += it.qtyUnits;
        cur.revenue += it.lineTotal;
        map.set(it.itemId, cur);
      }
    }
    return [...map.entries()]
      .map(([itemId, v]) => ({ itemId, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [sales]);

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

  const invStatus = useMemo(() => {
    const ok = products.filter((p) => stockStatus(p) === "ok").length;
    const total = Math.max(products.length, 1);
    return {
      okPct: Math.round((ok / total) * 100),
      lowPct: Math.round((stats.low.length / total) * 100),
      outPct: Math.round((stats.out.length / total) * 100),
    };
  }, [products, stats]);

  const statCards = [
    { icon: "peso-sign", label: "Inventory Value", value: peso(stats.totalValue), sub: `${fmtInt(stats.totalUnits)} units on hand`, tone: "text-emerald-700 bg-emerald-50" },
    { icon: "cash-register", label: "Sales Today", value: peso(stats.todayTotal), sub: `${stats.todaySales.length} transaction${stats.todaySales.length === 1 ? "" : "s"}`, tone: "text-sky-700 bg-sky-50" },
    { icon: "chart-line", label: "Sales This Month", value: peso(stats.monthTotal), sub: `${stats.monthCount} transactions`, tone: "text-violet-700 bg-violet-50" },
    { icon: "boxes-stacked", label: "Distinct Items", value: fmtInt(products.length), sub: `${fmtInt(stats.totalUnits)} total units`, tone: "text-amber-700 bg-amber-50" },
    { icon: "triangle-exclamation", label: "Low Stock", value: fmtInt(stats.low.length), sub: "at or below reorder level", tone: "text-amber-700 bg-amber-50" },
    { icon: "circle-xmark", label: "Out of Stock", value: fmtInt(stats.out.length), sub: "needs restocking", tone: "text-red-700 bg-red-50" },
  ];

  const activeUsers = data.staff.filter((s) => s.active).length;
  const plan = data.plan;

  return (
    <div className="space-y-5">
      {setupDone && (
        <div className="flex items-start gap-3 rounded-2xl bg-emerald-600 px-4 py-3.5 text-white shadow">
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

      {/* Active plan strip */}
      <Card className="flex flex-wrap items-center gap-x-5 gap-y-2 border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-800">
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
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {statCards.map((c) => (
          <Card key={c.label} className="p-4">
            <span className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.tone}`}>
              <Icon name={c.icon} />
            </span>
            <p className="truncate text-lg font-bold text-stone-800">{c.value}</p>
            <p className="text-xs font-semibold text-stone-500">{c.label}</p>
            <p className="text-[11px] text-stone-400">{c.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionTitle icon="chart-column" title="Revenue — Last 6 Months" />
          {sales.length === 0 ? (
            <EmptyState
              icon="chart-column"
              title="No sales yet"
              hint="Completed sales from the Cashier (POS) will appear here as monthly revenue."
            />
          ) : (
            <div className="flex h-44 items-end gap-3 px-1 pt-2">
              {chart.months.map((m) => (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-stone-500">
                    {m.total > 0 ? peso(m.total) : ""}
                  </span>
                  <div
                    className="w-full max-w-14 rounded-t-lg bg-[var(--brand)]/85 transition-all"
                    style={{ height: `${Math.max((m.total / chart.max) * 120, m.total > 0 ? 6 : 2)}px` }}
                  />
                  <span className="text-xs font-medium text-stone-500">{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle icon="heart-pulse" title="Inventory Status" />
          <div className="space-y-3 text-sm">
            {[
              { label: "In stock", pct: invStatus.okPct, cls: "bg-emerald-500" },
              { label: "Low stock", pct: invStatus.lowPct, cls: "bg-amber-400" },
              { label: "Out of stock", pct: invStatus.outPct, cls: "bg-red-500" },
            ].map((r) => (
              <div key={r.label}>
                <div className="mb-1 flex justify-between text-xs font-semibold text-stone-600">
                  <span>{r.label}</span>
                  <span>{r.pct}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
                  <div className={`h-full rounded-full ${r.cls}`} style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t border-stone-100 pt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
              Needs restocking
            </p>
            {stats.low.length + stats.out.length === 0 ? (
              <p className="text-sm text-stone-500">All products are above their reorder level.</p>
            ) : (
              [...stats.out, ...stats.low].slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  onClick={() => openProduct(p.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-stone-50"
                >
                  <ProductThumb name={p.name} imageUrl={p.imageUrl} size={30} />
                  <span className="flex-1 truncate text-sm font-medium text-stone-700">{p.name}</span>
                  <span className={`text-xs font-bold ${p.quantity <= 0 ? "text-red-600" : "text-amber-600"}`}>
                    {fmtInt(p.quantity)} left
                  </span>
                </button>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionTitle
            icon="receipt"
            title="Latest Transactions"
            right={
              <button className={btnGhost} onClick={() => setView("sales-report")}>
                <Icon name="arrow-right" /> View report
              </button>
            }
          />
          {sales.length === 0 ? (
            <EmptyState icon="receipt" title="No transactions yet" hint="Sales you complete in the Cashier (POS) show up here." />
          ) : (
            <ul className="divide-y divide-stone-100">
              {sales.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                    <Icon name={s.paymentMethod === "GCash" ? "mobile-screen" : "money-bill"} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-700">
                      {s.orNumber} · {s.items.reduce((a, i) => a + i.qtyUnits, 0)} item(s)
                    </p>
                    <p className="text-xs text-stone-400">
                      {fmtDateTime(s.createdAt, settings)} · {s.cashier}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-stone-800">{peso(s.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle icon="crown" title="Top Sellers" />
            {topSellers.length === 0 ? (
              <EmptyState icon="crown" title="No sales data yet" />
            ) : (
              <ul className="space-y-2.5">
                {topSellers.map((t, i) => (
                  <li key={t.itemId} className="flex items-center gap-2 text-sm">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-500">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate font-medium text-stone-700">{t.name}</span>
                    <span className="text-xs text-stone-400">{fmtInt(t.qty)} sold</span>
                    <span className="font-bold text-stone-800">{peso(t.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle
              icon="warehouse"
              title="Storage Areas"
              right={
                <button className={btnGhost} onClick={() => setView("status")}>
                  <Icon name="arrow-right" /> Details
                </button>
              }
            />
            {areaStats.length === 0 ? (
              <EmptyState
                icon="warehouse"
                title="No stock placed yet"
                hint="Receive or restock products into storage areas to see settled and unsettled counts here."
              />
            ) : (
              <ul className="space-y-3">
                {areaStats.map((a) => (
                  <li key={a.name} className="rounded-xl bg-stone-50 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-stone-700">{a.name}</p>
                      <span className="text-xs font-medium text-stone-400">
                        {a.productCount} product(s) · {fmtInt(a.units)} units
                      </span>
                    </div>
                    <div className="mt-1.5 flex gap-2 text-xs font-semibold">
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
          </Card>
        </div>
      </div>
    </div>
  );
}
