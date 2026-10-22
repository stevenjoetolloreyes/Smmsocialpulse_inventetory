"use client";

import { useMemo, useState } from "react";
import { useStore } from "./store";
import { Card, EmptyState, Icon, SectionTitle, btnPrimary, inputCls, labelCls } from "./ui";
import { daysUntil, downloadTextFile, fmtExpiry, fmtInt, peso, stockStatus } from "@/lib/format";
import { exportInventoryReportCsvAction } from "@/server/actions";

type StatusFilter = "All" | "In Stock" | "Low Stock" | "Out of Stock" | "Near Expiry" | "Expired";

export function InventoryReport() {
  const { data, openProduct, run, showToast } = useStore();
  const { products, categories } = data;
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [supplierId, setSupplierId] = useState("All");
  const [search, setSearch] = useState("");

  const rows = useMemo(
    () =>
      products.filter((p) => {
        if (category !== "All" && p.category !== category) return false;
        if (supplierId !== "All" && p.supplierId !== Number(supplierId)) return false;
        if (search && !`${p.name} ${p.code}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
        const st = stockStatus(p);
        const hasNear = p.batches.some(
          (b) => b.expiryDate && daysUntil(b.expiryDate) >= 0 && daysUntil(b.expiryDate) <= 30 && b.qtyRemaining > 0,
        );
        const hasExpired = p.batches.some(
          (b) => b.expiryDate && daysUntil(b.expiryDate) < 0 && b.qtyRemaining > 0,
        );
        switch (status) {
          case "All":
            return true;
          case "In Stock":
            return st === "ok";
          case "Low Stock":
            return st === "low";
          case "Out of Stock":
            return st === "out";
          case "Near Expiry":
            return hasNear;
          case "Expired":
            return hasExpired || p.productStatus === "expired";
        }
      }),
    [products, category, status, supplierId, search],
  );

  const totals = useMemo(() => {
    const units = rows.reduce((s, p) => s + p.quantity, 0);
    const cost = rows.reduce((s, p) => s + p.quantity * p.costPrice, 0);
    const retail = rows.reduce((s, p) => s + p.quantity * p.sellingPrice, 0);
    const near = products.filter((p) =>
      p.batches.some((b) => b.expiryDate && daysUntil(b.expiryDate) >= 0 && daysUntil(b.expiryDate) <= 30 && b.qtyRemaining > 0),
    ).length;
    const expired = products.filter(
      (p) =>
        p.productStatus === "expired" ||
        p.batches.some((b) => b.expiryDate && daysUntil(b.expiryDate) < 0 && b.qtyRemaining > 0),
    ).length;
    return { units, cost, retail, near, expired };
  }, [rows, products]);

  // The CSV is built on the server: report export is a paid-plan feature
  // and the gate is enforced in the action, not just by hiding this button.
  const exportCsv = async () => {
    try {
      const { csv } = await run(() => exportInventoryReportCsvAction());
      downloadTextFile("inventory-report.csv", csv);
      showToast("Inventory report exported.");
    } catch {
      /* toasted by run() */
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { icon: "boxes-stacked", label: "Products (filtered)", value: fmtInt(rows.length) },
          { icon: "layer-group", label: "Units on hand", value: fmtInt(totals.units) },
          { icon: "peso-sign", label: "Value at cost", value: peso(totals.cost) },
          { icon: "hourglass-half", label: "Near expiry products", value: fmtInt(totals.near) },
          { icon: "calendar-xmark", label: "Expired products", value: fmtInt(totals.expired) },
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
        <SectionTitle
          icon="file-lines"
          title="Inventory Report"
          right={
            data.plan.reportExport ? (
              <button className={btnPrimary} onClick={() => void exportCsv()} disabled={rows.length === 0}>
                <Icon name="file-csv" /> Export CSV
              </button>
            ) : (
              <span className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-500">
                CSV export is a Pro / Business feature — see Subscription
              </span>
            )
          }
        />
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls}>Search</label>
            <input className={inputCls} placeholder="Name or SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option>All</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Stock status</label>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              {(["All", "In Stock", "Low Stock", "Out of Stock", "Near Expiry", "Expired"] as StatusFilter[]).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Supplier</label>
            <select className={inputCls} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option>All</option>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {products.length === 0 ? (
          <EmptyState icon="boxes-stacked" title="No inventory to report" hint="Add products in Inventory and this report fills in automatically." />
        ) : rows.length === 0 ? (
          <EmptyState icon="filter" title="No products match these filters" />
        ) : (
          <div className="nice-scroll overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-xs uppercase text-stone-400">
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">On hand</th>
                  <th className="py-2 pr-3">Cost</th>
                  <th className="py-2 pr-3">Price</th>
                  <th className="py-2 pr-3">Value (cost)</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Nearest expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((p) => {
                  const st = stockStatus(p);
                  const expiries = p.batches
                    .filter((b) => b.expiryDate && b.qtyRemaining > 0)
                    .map((b) => b.expiryDate!)
                    .sort();
                  return (
                    <tr key={p.id} className="cursor-pointer hover:bg-stone-50" onClick={() => openProduct(p.id)}>
                      <td className="py-2.5 pr-3">
                        <span className="font-medium text-stone-700">{p.name}</span>
                        <span className="block text-xs text-stone-400">{p.code}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-stone-500">{p.category}</td>
                      <td className="py-2.5 pr-3 font-semibold">
                        {fmtInt(p.quantity)} <span className="text-xs font-normal text-stone-400">{p.unit}</span>
                      </td>
                      <td className="py-2.5 pr-3">{peso(p.costPrice)}</td>
                      <td className="py-2.5 pr-3">{peso(p.sellingPrice)}</td>
                      <td className="py-2.5 pr-3 font-semibold">{peso(p.quantity * p.costPrice)}</td>
                      <td className="py-2.5 pr-3">
                        {st === "out" ? (
                          <span className="font-semibold text-red-600">Out of stock</span>
                        ) : st === "low" ? (
                          <span className="font-semibold text-amber-600">Low stock</span>
                        ) : (
                          <span className="text-emerald-600">In stock</span>
                        )}
                        {p.productStatus !== "active" && (
                          <span className="block text-xs text-violet-600">{p.productStatus}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-stone-500">{fmtExpiry(expiries[0] ?? null)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-stone-400">
          Potential retail value of the filtered stock: <strong>{peso(totals.retail)}</strong>. Click a row to open the product.
        </p>
      </Card>
    </div>
  );
}
