"use client";

import { useMemo, useState } from "react";
import { useStore } from "./store";
import { Card, EmptyState, Icon, SectionTitle, btnGhost, btnPrimary, inputCls } from "./ui";
import { ProductThumb } from "./Qr";
import { fmtInt, peso } from "@/lib/format";

export function LabelsView() {
  const { data, setPrintJob } = useStore();
  const { products } = data;
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
    );
  }, [products, search]);

  const toggle = (id: number, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const print = () => {
    setPrintJob({ kind: "labels", productIds: [...selected] });
    setTimeout(() => window.print(), 250);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <SectionTitle
          icon="tags"
          title="Print QR Labels"
          right={
            <button className={btnPrimary} disabled={selected.size === 0} onClick={print}>
              <Icon name="print" /> Print {selected.size} label(s)
            </button>
          }
        />
        <p className="mb-3 text-sm text-stone-500">
          Each label shows the product's QR code (its SKU), name, code and price. QR codes are
          generated in this page — no external service. Stick them on shelves or products, then
          scan them from the Scan view or the Cashier.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${inputCls} min-w-48 flex-1`}
            placeholder="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className={btnGhost}
            onClick={() => setSelected(new Set(visible.map((p) => p.id)))}
            disabled={visible.length === 0}
          >
            <Icon name="check-double" /> Select all shown
          </button>
          <button className={btnGhost} onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
            <Icon name="xmark" /> Clear
          </button>
        </div>
      </Card>

      {products.length === 0 ? (
        <Card>
          <EmptyState icon="tags" title="No products yet" hint="Add products in Inventory first — every product automatically gets a QR label." />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState icon="magnifying-glass" title="No products match your search" />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const on = selected.has(p.id);
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 shadow-sm transition ${
                  on ? "border-[var(--brand)] bg-emerald-50/60" : "border-stone-200 bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-emerald-800"
                  checked={on}
                  onChange={(e) => toggle(p.id, e.target.checked)}
                />
                <ProductThumb name={p.name} imageUrl={p.imageUrl} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-stone-700">{p.name}</span>
                  <span className="block text-xs text-stone-400">
                    {p.code} · {peso(p.sellingPrice)} · {fmtInt(p.quantity)} in stock
                  </span>
                </span>
                <Icon name="qrcode" className="text-xl text-stone-300" />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
