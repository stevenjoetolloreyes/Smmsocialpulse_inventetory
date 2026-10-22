"use client";

import { useMemo, useState } from "react";
import { useStore } from "./store";
import {
  Badge, Card, EmptyState, Icon, Modal, SectionTitle,
  btnGhost, btnPrimary, inputCls, labelCls,
} from "./ui";
import { fmtDate, fmtDateTime, fmtInt, peso, todayYMD } from "@/lib/format";
import { recordReturn } from "@/server/actions";
import type { SaleDTO } from "@/lib/types";

function inRange(iso: string, from: string, to: string): boolean {
  const day = iso.slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}

export function SalesReport() {
  const { data, printSale } = useStore();
  const { sales, returns, settings } = data;
  const [tab, setTab] = useState<"sales" | "returns">("sales");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [payment, setPayment] = useState("All");
  const [customer, setCustomer] = useState("All");
  const [cashier, setCashier] = useState("All");
  const [status, setStatus] = useState("All");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const cashiers = useMemo(
    () => [...new Set(sales.map((s) => s.cashier).filter(Boolean))],
    [sales],
  );

  const filtered = useMemo(
    () =>
      sales.filter(
        (s) =>
          inRange(s.createdAt, from, to) &&
          (payment === "All" || s.paymentMethod === payment) &&
          (customer === "All" || s.customerType === customer) &&
          (cashier === "All" || s.cashier === cashier) &&
          (status === "All" || s.status === status),
      ),
    [sales, from, to, payment, customer, cashier, status],
  );

  const totals = useMemo(() => {
    const revenue = filtered.reduce((s, x) => s + x.total, 0);
    const cash = filtered.filter((x) => x.paymentMethod === "Cash").reduce((s, x) => s + x.total, 0);
    const gcash = filtered.filter((x) => x.paymentMethod === "GCash").reduce((s, x) => s + x.total, 0);
    const discounts = filtered.reduce((s, x) => s + x.discountAmount, 0);
    const itemsSold = filtered.reduce(
      (s, x) => s + x.items.reduce((a, i) => a + i.qtyUnits, 0),
      0,
    );
    return { revenue, cash, gcash, discounts, itemsSold };
  }, [filtered]);

  const chart = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const s of filtered) {
      const day = s.createdAt.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + s.total);
    }
    const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
    const max = Math.max(...days.map((d) => d[1]), 1);
    return { days, max };
  }, [filtered]);

  const filteredReturns = useMemo(
    () => returns.filter((r) => inRange(r.createdAt, from, to)),
    [returns, from, to],
  );

  const selected = selectedId ? sales.find((s) => s.id === selectedId) ?? null : null;

  const quickRange = (kind: "today" | "week" | "month" | "all") => {
    const today = todayYMD();
    if (kind === "all") {
      setFrom("");
      setTo("");
    } else if (kind === "today") {
      setFrom(today);
      setTo(today);
    } else if (kind === "week") {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setFrom(d.toISOString().slice(0, 10));
      setTo(today);
    } else {
      setFrom(`${today.slice(0, 7)}-01`);
      setTo(today);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { icon: "peso-sign", label: "Total revenue", value: peso(totals.revenue) },
          { icon: "receipt", label: "Transactions", value: fmtInt(filtered.length) },
          { icon: "money-bill", label: "Cash sales", value: peso(totals.cash) },
          { icon: "mobile-screen", label: "GCash sales", value: peso(totals.gcash) },
          { icon: "percent", label: "Discounts given", value: peso(totals.discounts) },
        ].map((c) => (
          <Card key={c.label} className="p-4">
            <span className="mb-1 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
              <Icon name={c.icon} />
            </span>
            <p className="truncate text-lg font-bold text-stone-800">{c.value}</p>
            <p className="text-xs font-semibold text-stone-500">{c.label}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {(
              [
                ["sales", "Sales"],
                ["returns", "Returns / Exchanges"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                  tab === key ? "bg-[var(--brand)] text-white" : "bg-stone-100 text-stone-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {(["today", "week", "month", "all"] as const).map((k) => (
              <button key={k} className={btnGhost} onClick={() => quickRange(k)}>
                {k === "all" ? "All time" : k === "today" ? "Today" : k === "week" ? "Last 7 days" : "This month"}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className={labelCls}>From</label>
            <input className={inputCls} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>To</label>
            <input className={inputCls} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Payment</label>
            <select className={inputCls} value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option>All</option>
              <option>Cash</option>
              <option>GCash</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Customer</label>
            <select className={inputCls} value={customer} onChange={(e) => setCustomer(e.target.value)}>
              <option>All</option>
              <option>Regular</option>
              <option>PWD</option>
              <option>Senior</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Cashier</label>
            <select className={inputCls} value={cashier} onChange={(e) => setCashier(e.target.value)}>
              <option>All</option>
              {cashiers.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>All</option>
              <option>Completed</option>
              <option>Partially Refunded</option>
            </select>
          </div>
        </div>

        {tab === "sales" && (
          <>
            {filtered.length > 0 && chart.days.length > 0 && (
              <div className="mb-4 flex h-28 items-end gap-2 rounded-2xl bg-stone-50 px-4 pb-2 pt-3">
                {chart.days.map(([day, total]) => (
                  <div key={day} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full max-w-10 rounded-t-md bg-[var(--brand)]/80"
                      style={{ height: `${Math.max((total / chart.max) * 72, 3)}px` }}
                      title={`${fmtDate(day, settings)}: ${peso(total)}`}
                    />
                    <span className="text-[10px] text-stone-400">
                      {fmtDate(day, settings).replace(/,?\s*\d{4}$/, "")}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {sales.length === 0 ? (
              <EmptyState icon="receipt" title="No sales recorded yet" hint="Sales completed in the Cashier (POS) will be reported here." />
            ) : filtered.length === 0 ? (
              <EmptyState icon="filter" title="No sales match these filters" />
            ) : (
              <div className="nice-scroll overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-xs uppercase text-stone-400">
                      <th className="py-2 pr-3">OR #</th>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Items</th>
                      <th className="py-2 pr-3">Customer</th>
                      <th className="py-2 pr-3">Payment</th>
                      <th className="py-2 pr-3">Cashier</th>
                      <th className="py-2 pr-3">Total</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filtered.map((s) => (
                      <tr
                        key={s.id}
                        className="cursor-pointer hover:bg-stone-50"
                        onClick={() => setSelectedId(s.id)}
                      >
                        <td className="py-2.5 pr-3 font-semibold text-[var(--brand)]">{s.orNumber}</td>
                        <td className="py-2.5 pr-3 text-stone-500">{fmtDateTime(s.createdAt, settings)}</td>
                        <td className="py-2.5 pr-3">{s.items.reduce((a, i) => a + i.qtyUnits, 0)}</td>
                        <td className="py-2.5 pr-3">{s.customerType}</td>
                        <td className="py-2.5 pr-3">{s.paymentMethod}</td>
                        <td className="py-2.5 pr-3 text-stone-500">{s.cashier}</td>
                        <td className="py-2.5 pr-3 font-bold">{peso(s.total)}</td>
                        <td className="py-2.5">
                          <Badge tone={s.status === "Completed" ? "green" : "amber"}>{s.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs text-stone-400">
              {fmtInt(totals.itemsSold)} item(s) sold in the filtered range. Click a row to see the full sale, reprint its receipt, or process a return.
            </p>
          </>
        )}

        {tab === "returns" && (
          <>
            {returns.length === 0 ? (
              <EmptyState
                icon="rotate-left"
                title="No returns recorded"
                hint="Open a sale from the Sales tab and use “Process return” — returned units go back to their original batches."
              />
            ) : filteredReturns.length === 0 ? (
              <EmptyState icon="filter" title="No returns in this date range" />
            ) : (
              <div className="nice-scroll overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-xs uppercase text-stone-400">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">OR #</th>
                      <th className="py-2 pr-3">Product</th>
                      <th className="py-2 pr-3">Batch</th>
                      <th className="py-2 pr-3">Qty restored</th>
                      <th className="py-2 pr-3">By</th>
                      <th className="py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredReturns.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2.5 pr-3 text-stone-500">{fmtDateTime(r.createdAt, settings)}</td>
                        <td className="py-2.5 pr-3 font-semibold">{r.orNumber}</td>
                        <td className="py-2.5 pr-3">{r.productName}</td>
                        <td className="py-2.5 pr-3 text-stone-500">{r.batchNo}</td>
                        <td className="py-2.5 pr-3 font-semibold">{fmtInt(r.qty)}</td>
                        <td className="py-2.5 pr-3 text-stone-500">{r.actor}</td>
                        <td className="py-2.5 text-stone-500">{r.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>

      {selected && (
        <SaleDetailModal sale={selected} onClose={() => setSelectedId(null)} onReprint={() => printSale(selected.id)} />
      )}
    </div>
  );
}

function SaleDetailModal({
  sale,
  onClose,
  onReprint,
}: {
  sale: SaleDTO;
  onClose: () => void;
  onReprint: () => void;
}) {
  const { data, run, showToast } = useStore();
  const [returnQty, setReturnQty] = useState<Record<number, string>>({});
  const [returnNote, setReturnNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const allowReturns = data.settings.security.allowReturns;

  const doReturn = async () => {
    const lines = sale.items
      .map((it) => ({ saleItemId: it.id, qtyUnits: Math.trunc(Number(returnQty[it.id]) || 0) }))
      .filter((l) => l.qtyUnits > 0);
    if (lines.length === 0) {
      showToast("Enter a return quantity for at least one line.");
      return;
    }
    setProcessing(true);
    try {
      await run(() => recordReturn({ saleId: sale.id, lines, note: returnNote }));
      showToast("Return processed — stock restored to the original batches.");
      onClose();
    } catch {
      /* toasted */
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Sale ${sale.orNumber}`} icon="receipt" wide>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Date", fmtDateTime(sale.createdAt, data.settings)],
            ["Cashier", sale.cashier],
            ["Customer", sale.customerType],
            ["Payment", sale.paymentMethod],
            ["Tendered", peso(sale.amountTendered)],
            ["Change", peso(sale.changeDue)],
            ["Status", sale.status],
            ["Total", peso(sale.total)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-stone-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase text-stone-400">{k}</p>
              <p className="font-semibold text-stone-700">{v}</p>
            </div>
          ))}
        </div>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-xs uppercase text-stone-400">
              <th className="py-1.5 pr-3">Product</th>
              <th className="py-1.5 pr-3">Unit</th>
              <th className="py-1.5 pr-3">Qty</th>
              <th className="py-1.5 pr-3">Price</th>
              <th className="py-1.5 pr-3">Line total</th>
              <th className="py-1.5 pr-3">Returned</th>
              {allowReturns && <th className="py-1.5">Return qty</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {sale.items.map((it) => {
              const returnable = it.qtyUnits - Math.floor(it.returnedQtyBase / it.conversionFactor);
              return (
                <tr key={it.id}>
                  <td className="py-2 pr-3 font-medium">{it.productName}</td>
                  <td className="py-2 pr-3">{it.unitName}</td>
                  <td className="py-2 pr-3">{it.qtyUnits}</td>
                  <td className="py-2 pr-3">{peso(it.unitPrice)}</td>
                  <td className="py-2 pr-3 font-semibold">{peso(it.lineTotal)}</td>
                  <td className="py-2 pr-3">{it.returnedQtyBase > 0 ? `${Math.floor(it.returnedQtyBase / it.conversionFactor)} ${it.unitName}` : "—"}</td>
                  {allowReturns && (
                    <td className="py-2">
                      <input
                        className={`${inputCls} w-20 py-1.5`}
                        type="number"
                        min={0}
                        max={returnable}
                        placeholder="0"
                        value={returnQty[it.id] ?? ""}
                        onChange={(e) => setReturnQty((q) => ({ ...q, [it.id]: e.target.value }))}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="space-y-0.5 border-t border-dashed border-stone-200 pt-2 text-right">
          <p className="text-stone-500">Subtotal: {peso(sale.subtotal)}</p>
          {sale.discountAmount > 0 && (
            <p className="text-emerald-600">Discount: −{peso(sale.discountAmount)}</p>
          )}
          <p className="text-base font-bold">Total: {peso(sale.total)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className={btnGhost} onClick={onReprint}>
            <Icon name="print" /> Reprint receipt
          </button>
          {allowReturns && (
            <>
              <input
                className={`${inputCls} min-w-40 flex-1`}
                placeholder="Return note (e.g. damaged packaging, exchange)"
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
              />
              <button className={btnPrimary} onClick={() => void doReturn()} disabled={processing}>
                <Icon name="rotate-left" /> {processing ? "Processing…" : "Process return"}
              </button>
            </>
          )}
          {!allowReturns && (
            <p className="self-center text-xs text-stone-400">
              Returns are disabled in Settings → Security.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
