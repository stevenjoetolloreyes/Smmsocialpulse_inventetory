"use client";

import { useMemo, useState } from "react";
import { useStore } from "./store";
import { Card, EmptyState, Icon, Modal, btnGhost, btnPrimary, inputCls } from "./ui";
import { ProductThumb } from "./Qr";
import { fmtInt, peso, stockStatus } from "@/lib/format";
import { bulkRestock } from "@/server/actions";

type Row = { qty: string; cost: string; expiry: string };

export function BulkRestock() {
  const { data, run, showToast } = useStore();
  const { products } = data;
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [bulkQty, setBulkQty] = useState("");
  const [bulkCost, setBulkCost] = useState("");
  const [bulkExpiry, setBulkExpiry] = useState("");
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const visible = useMemo(
    () =>
      products.filter((p) =>
        filter === "all" ? true : filter === "low" ? stockStatus(p) === "low" : stockStatus(p) === "out",
      ),
    [products, filter],
  );

  const toggle = (id: number, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    if (on) {
      const p = products.find((x) => x.id === id);
      setRows((prev) =>
        prev[id]
          ? prev
          : { ...prev, [id]: { qty: "", cost: p ? String(p.costPrice) : "", expiry: "" } },
      );
    }
  };

  const setRow = (id: number, patch: Partial<Row>) =>
    setRows((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { qty: "", cost: "", expiry: "" }), ...patch } }));

  const applyBulk = () => {
    for (const id of selected) {
      setRow(id, {
        ...(bulkQty ? { qty: bulkQty } : {}),
        ...(bulkCost ? { cost: bulkCost } : {}),
        ...(bulkExpiry ? { expiry: bulkExpiry } : {}),
      });
    }
    showToast("Bulk values applied to the selected rows — review, then restock.");
  };

  const entries = useMemo(
    () =>
      [...selected]
        .map((id) => {
          const p = products.find((x) => x.id === id);
          const r = rows[id];
          if (!p || !r) return null;
          const qty = Math.trunc(Number(r.qty) || 0);
          if (qty <= 0) return null;
          return {
            itemId: id,
            name: p.name,
            unit: p.unit,
            qty,
            costPrice: Math.max(0, Number(r.cost) || 0),
            expiryDate: r.expiry || null,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [selected, products, rows],
  );

  const totalCost = entries.reduce((s, e) => s + e.qty * e.costPrice, 0);

  const doRestock = async () => {
    setApplying(true);
    try {
      await run(() =>
        bulkRestock({
          entries: entries.map((e) => ({
            itemId: e.itemId,
            qty: e.qty,
            costPrice: e.costPrice,
            expiryDate: e.expiryDate,
          })),
          note,
        }),
      );
      setConfirmOpen(false);
      setSelected(new Set());
      setRows({});
      setNote("");
      showToast(`Restocked ${entries.length} product(s).`);
    } catch {
      /* toasted */
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {(
              [
                ["all", "All products"],
                ["low", "Low stock"],
                ["out", "Out of stock"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                  filter === key ? "bg-[var(--brand)] text-white" : "bg-stone-100 text-stone-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-sm font-medium text-stone-500">
            {selected.size} selected · {entries.length} with a quantity
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-stone-400">Bulk qty</label>
            <input className={`${inputCls} w-28`} type="number" min={0} value={bulkQty} onChange={(e) => setBulkQty(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-stone-400">Bulk cost ₱</label>
            <input className={`${inputCls} w-28`} type="number" min={0} step="0.01" value={bulkCost} onChange={(e) => setBulkCost(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-stone-400">Bulk expiry</label>
            <input className={`${inputCls} w-40`} type="date" value={bulkExpiry} onChange={(e) => setBulkExpiry(e.target.value)} />
          </div>
          <button className={btnGhost} onClick={applyBulk} disabled={selected.size === 0}>
            <Icon name="wand-magic-sparkles" /> Apply to selected
          </button>
          <input
            className={`${inputCls} min-w-44 flex-1`}
            placeholder="Note for this restock (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            className={btnPrimary}
            disabled={entries.length === 0}
            onClick={() => setConfirmOpen(true)}
          >
            <Icon name="layer-group" /> Restock {entries.length} product(s)
          </button>
        </div>
      </Card>

      {products.length === 0 ? (
        <Card>
          <EmptyState icon="boxes-stacked" title="No products yet" hint="Add products in Inventory first, then restock them here in bulk." />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState icon="check" title="Nothing matches this filter" hint="No products fall under the selected filter right now." />
        </Card>
      ) : (
        <Card className="p-2 sm:p-4">
          <div className="nice-scroll max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
            {visible.map((p) => {
              const on = selected.has(p.id);
              const r = rows[p.id] ?? { qty: "", cost: "", expiry: "" };
              const st = stockStatus(p);
              return (
                <div
                  key={p.id}
                  className={`flex flex-wrap items-center gap-3 rounded-xl px-3 py-2 ${on ? "bg-emerald-50" : "bg-stone-50"}`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-800"
                    checked={on}
                    onChange={(e) => toggle(p.id, e.target.checked)}
                    aria-label={`Select ${p.name}`}
                  />
                  <ProductThumb name={p.name} imageUrl={p.imageUrl} size={36} />
                  <div className="min-w-32 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-700">{p.name}</p>
                    <p className="text-xs text-stone-400">
                      {fmtInt(p.quantity)} {p.unit} on hand
                      {st === "out" ? " · out of stock" : st === "low" ? " · low stock" : ""}
                    </p>
                  </div>
                  {on && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className={`${inputCls} w-24`}
                        type="number"
                        min={0}
                        placeholder="Qty"
                        value={r.qty}
                        onChange={(e) => setRow(p.id, { qty: e.target.value })}
                      />
                      <input
                        className={`${inputCls} w-24`}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Cost ₱"
                        value={r.cost}
                        onChange={(e) => setRow(p.id, { cost: e.target.value })}
                      />
                      <input
                        className={`${inputCls} w-40`}
                        type="date"
                        value={r.expiry}
                        onChange={(e) => setRow(p.id, { expiry: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Bulk Restock" icon="layer-group">
        <ul className="nice-scroll max-h-64 space-y-1.5 overflow-y-auto pr-1 text-sm">
          {entries.map((e) => (
            <li key={e.itemId} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2">
              <span className="font-medium text-stone-700">{e.name}</span>
              <span className="text-stone-500">
                +{fmtInt(e.qty)} {e.unit} @ {peso(e.costPrice)}
                {e.expiryDate ? ` · exp ${e.expiryDate}` : ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between text-sm font-bold text-stone-800">
          <span>Total restock cost</span>
          <span>{peso(totalCost)}</span>
        </p>
        <p className="mt-1 text-xs text-stone-400">
          Each product gets a new batch, a stock movement, and a history entry.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setConfirmOpen(false)}>
            Back
          </button>
          <button className={btnPrimary} onClick={() => void doRestock()} disabled={applying}>
            <Icon name="check" /> {applying ? "Restocking…" : "Confirm restock"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
