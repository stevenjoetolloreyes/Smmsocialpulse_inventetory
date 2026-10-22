"use client";

import { useMemo, useState } from "react";
import { useStore } from "./store";
import { Badge, Icon, btnGhost, btnPrimary, inputCls, labelCls } from "./ui";
import { ProductThumb, QrImage } from "./Qr";
import { daysUntil, fmtDateTime, fmtExpiry, fmtInt, peso } from "@/lib/format";
import {
  adjustBatch, recordMovement, setBatchPlaced, setBatchStatus, setProductStatus, updateBatchDetails,
} from "@/server/actions";
import type { BatchDTO, ProductDTO } from "@/lib/types";

const STATUS_TONES: Record<string, "green" | "amber" | "red" | "stone" | "violet"> = {
  active: "green",
  expired: "red",
  recalled: "violet",
  damaged: "amber",
  archived: "stone",
};

export function ProductDetail({
  product,
  onClose,
  onEdit,
}: {
  product: ProductDTO;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { data, run, showToast, printJob, setPrintJob } = useStore();
  const [adjType, setAdjType] = useState<"in" | "out" | "adjust">("in");
  const [adjQty, setAdjQty] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [adjExpiry, setAdjExpiry] = useState("");

  const logs = useMemo(
    () => data.movements.filter((m) => m.itemId === product.id).slice(0, 30),
    [data.movements, product.id],
  );
  const supplierName = product.supplierId
    ? data.suppliers.find((s) => s.id === product.supplierId)?.name
    : null;

  const doAdjust = async () => {
    const qty = Math.trunc(Number(adjQty));
    if (!qty || qty < 0 || (adjType !== "adjust" && qty <= 0)) {
      showToast("Enter a valid quantity.");
      return;
    }
    try {
      await run(() =>
        recordMovement({
          itemId: product.id,
          type: adjType,
          quantity: qty,
          note: adjNote.trim() || "Manual adjustment",
          expiryDate: adjType === "in" && adjExpiry ? adjExpiry : null,
        }),
      );
      setAdjQty("");
      setAdjNote("");
      setAdjExpiry("");
      showToast("Stock updated.");
    } catch {
      /* toasted */
    }
  };

  const printLabel = () => {
    setPrintJob({ kind: "labels", productIds: [product.id] });
    setTimeout(() => window.print(), 250);
    void printJob;
  };

  return (
    <div className="no-print fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="nice-scroll h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-100 bg-white px-5 py-4">
          <ProductThumb name={product.name} imageUrl={product.imageUrl} size={44} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-bold text-stone-800">{product.name}</h3>
            <p className="text-xs text-stone-400">
              {product.code} · {product.category}
              {product.area ? ` · ${product.area}` : ""}
            </p>
          </div>
          <button className={btnGhost} onClick={onEdit}>
            <Icon name="pen" /> Edit
          </button>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200"
            onClick={onClose}
            aria-label="Close details"
          >
            <Icon name="xmark" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-2xl border border-stone-200 p-3 text-center">
              <QrImage value={product.code} size={120} />
              <p className="mt-1 text-xs font-semibold text-stone-500">{product.code}</p>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2 text-sm">
              <Info label="On hand" value={`${fmtInt(product.quantity)} ${product.unit}`} />
              <Info label="Selling price" value={peso(product.sellingPrice)} />
              <Info label="Cost price" value={peso(product.costPrice)} />
              <Info label="Stock value" value={peso(product.quantity * product.costPrice)} />
              <Info label="Reorder level" value={String(product.reorderLevel)} />
              <Info label="Batches" value={String(product.batchCount)} />
              <Info label="Barcode" value={product.barcode || "—"} />
              <Info label="Supplier" value={supplierName || "—"} />
              <Info label="Location" value={product.location || "—"} />
              <Info label="Last stocked" value={product.lastStockedAt ? fmtDateTime(product.lastStockedAt, data.settings) : "—"} />
            </div>
          </div>

          {product.notes && (
            <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">{product.notes}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button className={btnGhost} onClick={printLabel}>
              <Icon name="print" /> Print QR label
            </button>
            <select
              className={`${inputCls} w-auto`}
              value={product.productStatus}
              onChange={async (e) => {
                await run(() => setProductStatus(product.id, e.target.value as ProductDTO["productStatus"]));
                showToast(`Product status set to ${e.target.value}.`);
              }}
              aria-label="Product status"
            >
              {["active", "expired", "recalled", "damaged", "archived"].map((s) => (
                <option key={s} value={s}>
                  Status: {s}
                </option>
              ))}
            </select>
          </div>

          {/* Units */}
          <div>
            <h4 className="mb-2 text-sm font-bold text-stone-700">Units</h4>
            <div className="overflow-hidden rounded-xl border border-stone-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-400">
                  <tr>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2">Conversion</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Barcode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {product.units.map((u) => (
                    <tr key={u.id}>
                      <td className="px-3 py-2 font-medium">
                        {u.name} {u.isBase ? <Badge tone="green">base</Badge> : null}
                      </td>
                      <td className="px-3 py-2">1 {u.name} = {u.conversionFactor} {product.units.find((x) => x.isBase)?.name ?? product.unit}</td>
                      <td className="px-3 py-2">{peso(u.sellingPrice)}</td>
                      <td className="px-3 py-2 text-stone-500">{u.barcode || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick stock adjustment */}
          <div className="rounded-2xl border border-stone-200 p-4">
            <h4 className="mb-3 text-sm font-bold text-stone-700">Stock adjustment</h4>
            <div className="mb-2 grid grid-cols-3 gap-1.5">
              {(
                [
                  ["in", "Stock In", "arrow-down"],
                  ["out", "Stock Out", "arrow-up"],
                  ["adjust", "Set Count", "scale-balanced"],
                ] as const
              ).map(([key, label, icon]) => (
                <button
                  key={key}
                  onClick={() => setAdjType(key)}
                  className={`rounded-xl px-2 py-2 text-sm font-semibold ${
                    adjType === key ? "bg-[var(--brand)] text-white" : "bg-stone-100 text-stone-600"
                  }`}
                >
                  <Icon name={icon} /> {label}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                className={inputCls}
                type="number"
                min={0}
                placeholder={adjType === "adjust" ? `New total (${product.unit})` : `Qty (${product.unit})`}
                value={adjQty}
                onChange={(e) => setAdjQty(e.target.value)}
              />
              {adjType === "in" && (
                <input className={inputCls} type="date" value={adjExpiry} onChange={(e) => setAdjExpiry(e.target.value)} aria-label="Expiry date for the new batch" />
              )}
              <input className={inputCls} placeholder="Note (optional)" value={adjNote} onChange={(e) => setAdjNote(e.target.value)} />
            </div>
            <button className={`${btnPrimary} mt-3 w-full`} onClick={() => void doAdjust()}>
              <Icon name="check" /> Apply adjustment
            </button>
            <p className="mt-2 text-[11px] text-stone-400">
              Stock out uses FIFO (earliest expiry first) and can never take the balance below zero.
            </p>
          </div>

          {/* Batches */}
          <div>
            <h4 className="mb-2 text-sm font-bold text-stone-700">Batches ({product.batches.length})</h4>
            {product.batches.length === 0 ? (
              <p className="text-sm text-stone-400">No batches yet. Stock in or receive this product to create one.</p>
            ) : (
              <div className="space-y-2">
                {product.batches.map((b) => (
                  <BatchCard key={b.id} batch={b} product={product} />
                ))}
              </div>
            )}
          </div>

          {/* Movement log */}
          <div>
            <h4 className="mb-2 text-sm font-bold text-stone-700">Movement log</h4>
            {logs.length === 0 ? (
              <p className="text-sm text-stone-400">No movements recorded for this product yet.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {logs.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        m.type === "in"
                          ? "bg-emerald-50 text-emerald-600"
                          : m.type === "out"
                            ? "bg-red-50 text-red-500"
                            : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      <Icon name={m.type === "in" ? "arrow-down" : m.type === "out" ? "arrow-up" : "scale-balanced"} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-700">
                        {m.type === "adjust" ? "Adjusted" : m.type === "in" ? "Stock in" : "Stock out"}{" "}
                        <span className="font-bold">
                          {m.quantity > 0 ? "+" : ""}
                          {fmtInt(m.quantity)}
                        </span>{" "}
                        → balance {fmtInt(m.balanceAfter)}
                      </p>
                      <p className="truncate text-xs text-stone-400">
                        {m.note || "—"} · {fmtDateTime(m.createdAt, data.settings)} · {m.actor}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className="truncate font-semibold text-stone-700">{value}</p>
    </div>
  );
}

function BatchCard({ batch, product }: { batch: BatchDTO; product: ProductDTO }) {
  const { data, run, showToast } = useStore();
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(batch.qtyRemaining));
  const [defective, setDefective] = useState(String(batch.defectiveQty));
  const supplierName = batch.supplierId
    ? data.suppliers.find((s) => s.id === batch.supplierId)?.name
    : null;
  const expired = batch.expiryDate ? daysUntil(batch.expiryDate) < 0 : false;
  const nearExpiry = batch.expiryDate ? daysUntil(batch.expiryDate) <= 30 && !expired : false;

  return (
    <div className="rounded-xl border border-stone-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-stone-700">{batch.batchNo}</p>
        <Badge tone={STATUS_TONES[batch.status] ?? "stone"}>{batch.status}</Badge>
        <Badge tone={batch.boxStatus === "Full" ? "blue" : "amber"}>{batch.boxStatus}</Badge>
        {batch.defectiveQty > 0 && <Badge tone="red">{batch.defectiveQty} defective</Badge>}
        <span className="ml-auto text-sm font-bold text-stone-800">
          {fmtInt(batch.qtyRemaining)} / {fmtInt(batch.qtyReceived)} {product.unit}
        </span>
      </div>
      <p className="mt-1 text-xs text-stone-400">
        Received {fmtDateTime(batch.receivedDate, data.settings)} · Cost {peso(batch.costPrice)}
        {supplierName ? ` · ${supplierName}` : ""}
        {batch.invoiceNo ? ` · Invoice ${batch.invoiceNo}` : ""}
        {batch.area ? ` · Area: ${batch.area}` : ""}
        {" · "}
        {batch.placed ? "Settled (placed)" : "Unsettled (not placed)"}
        {" · "}Expiry: {fmtExpiry(batch.expiryDate)}
        {expired && batch.status === "active" ? " (expired)" : nearExpiry ? " (near expiry)" : ""}
        {batch.note ? ` · ${batch.note}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          className={btnGhost}
          onClick={async () => {
            await run(() => setBatchPlaced(batch.id, !batch.placed));
            showToast(batch.placed ? "Batch marked unsettled." : "Batch marked settled.");
          }}
        >
          <Icon name={batch.placed ? "box-open" : "box"} /> {batch.placed ? "Mark unsettled" : "Mark settled"}
        </button>
        <select
          className={`${inputCls} w-auto py-1.5`}
          value={batch.status}
          onChange={async (e) => {
            await run(() => setBatchStatus(batch.id, e.target.value as "active" | "expired" | "recalled" | "damaged" | "archived"));
            showToast(`Batch status set to ${e.target.value}.`);
          }}
          aria-label="Batch status"
        >
          {["active", "expired", "recalled", "damaged", "archived"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className={btnGhost} onClick={() => setEditing((v) => !v)}>
          <Icon name="pen" /> Edit batch
        </button>
      </div>
      {editing && (
        <div className="mt-3 grid gap-2 rounded-xl bg-stone-50 p-3 sm:grid-cols-4">
          <div>
            <label className={labelCls}>Qty remaining</label>
            <input className={inputCls} type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Defective qty</label>
            <input className={inputCls} type="number" min={0} value={defective} onChange={(e) => setDefective(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Box status</label>
            <select
              className={inputCls}
              defaultValue={batch.boxStatus}
              id={`box-${batch.id}`}
            >
              <option value="Full">Full</option>
              <option value="Partial">Partial</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Area</label>
            <input className={inputCls} list="ims-areas" defaultValue={batch.area} id={`area-${batch.id}`} />
          </div>
          <div className="flex gap-2 sm:col-span-4">
            <button
              className={btnPrimary}
              onClick={async () => {
                const newQty = Math.max(0, Math.trunc(Number(qty) || 0));
                if (newQty !== batch.qtyRemaining) {
                  await run(() =>
                    adjustBatch({ batchId: batch.id, newQty, note: "Batch quantity corrected" }),
                  );
                }
                const boxEl = document.getElementById(`box-${batch.id}`) as HTMLSelectElement | null;
                const areaEl = document.getElementById(`area-${batch.id}`) as HTMLInputElement | null;
                await run(() =>
                  updateBatchDetails({
                    batchId: batch.id,
                    defectiveQty: Math.max(0, Math.trunc(Number(defective) || 0)),
                    boxStatus: (boxEl?.value as "Full" | "Partial") ?? batch.boxStatus,
                    area: areaEl?.value ?? batch.area,
                  }),
                );
                setEditing(false);
                showToast("Batch updated.");
              }}
            >
              <Icon name="floppy-disk" /> Save batch
            </button>
            <button className={btnGhost} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
