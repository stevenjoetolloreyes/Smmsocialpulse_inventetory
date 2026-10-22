"use client";

import { useMemo, useState } from "react";
import { useStore } from "./store";
import {
  Badge, Card, EmptyState, Icon, Modal, SectionTitle,
  btnGhost, btnPrimary, inputCls, labelCls,
} from "./ui";
import { fmtDateTime, fmtExpiry, fmtInt, peso } from "@/lib/format";
import { addReceiving } from "@/server/actions";

export function Receiving() {
  const { data, run, showToast } = useStore();
  const { receivings, products, suppliers } = data;
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState<number | "">("");
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [qty, setQty] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [expiry, setExpiry] = useState("");
  const [receivedAs, setReceivedAs] = useState("");
  const [area, setArea] = useState("");
  const [placed, setPlaced] = useState(true);
  const [boxStatus, setBoxStatus] = useState<"Full" | "Partial">("Full");
  const [defectiveQty, setDefectiveQty] = useState("0");
  const [saving, setSaving] = useState(false);

  const product = useMemo(
    () => products.find((p) => p.id === itemId) ?? null,
    [products, itemId],
  );

  const totals = useMemo(
    () => ({
      count: receivings.length,
      units: receivings.reduce((s, r) => s + r.qty, 0),
      cost: receivings.reduce((s, r) => s + r.totalCost, 0),
      pending: receivings.reduce((s, r) => s + r.pendingQty, 0),
    }),
    [receivings],
  );

  const openModal = () => {
    setItemId(products[0]?.id ?? "");
    setSupplierId("");
    setInvoiceNo("");
    setQty("");
    setCostPrice("");
    setExpiry("");
    setReceivedAs("");
    setArea("");
    setPlaced(true);
    setBoxStatus("Full");
    setDefectiveQty("0");
    setOpen(true);
  };

  const submit = async () => {
    if (!product) return;
    setSaving(true);
    try {
      await run(() =>
        addReceiving({
          itemId: product.id,
          supplierId: supplierId === "" ? null : supplierId,
          invoiceNo,
          qty: Math.trunc(Number(qty) || 0),
          costPrice: Math.max(0, Number(costPrice) || 0),
          expiryDate: expiry || null,
          receivedAs: receivedAs || product.units.find((u) => u.isBase)?.name || product.unit,
          area,
          placed,
          boxStatus,
          defectiveQty: Math.max(0, Math.trunc(Number(defectiveQty) || 0)),
        }),
      );
      setOpen(false);
      showToast("Delivery received and stocked in.");
    } catch {
      /* toasted */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { icon: "truck-ramp-box", label: "Deliveries", value: fmtInt(totals.count) },
          { icon: "boxes-stacked", label: "Units received", value: fmtInt(totals.units) },
          { icon: "peso-sign", label: "Total received cost", value: peso(totals.cost) },
          { icon: "hourglass-half", label: "Pending qty", value: fmtInt(totals.pending) },
        ].map((c) => (
          <Card key={c.label} className="p-4">
            <span className="mb-1 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
              <Icon name={c.icon} />
            </span>
            <p className="text-lg font-bold text-stone-800">{c.value}</p>
            <p className="text-xs font-semibold text-stone-500">{c.label}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <SectionTitle
          icon="truck-ramp-box"
          title="Receiving Log"
          right={
            <button className={btnPrimary} onClick={openModal} disabled={products.length === 0}>
              <Icon name="plus" /> Add Receiving
            </button>
          }
        />
        {products.length === 0 ? (
          <EmptyState
            icon="box-open"
            title="Add a product first"
            hint="Receiving records deliveries against existing products. Add products in Inventory, then log their deliveries here."
          />
        ) : receivings.length === 0 ? (
          <EmptyState
            icon="truck-ramp-box"
            title="No deliveries recorded yet"
            hint="Use Add Receiving when a supplier delivery arrives — it creates a batch and stocks the product in."
          />
        ) : (
          <div className="nice-scroll overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-xs uppercase text-stone-400">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Batch</th>
                  <th className="py-2 pr-3">Supplier</th>
                  <th className="py-2 pr-3">Invoice</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3">Total cost</th>
                  <th className="py-2 pr-3">Expiry</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {receivings.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-3 text-stone-500">{fmtDateTime(r.createdAt, data.settings)}</td>
                    <td className="py-2.5 pr-3 font-medium text-stone-700">{r.itemName}</td>
                    <td className="py-2.5 pr-3 text-stone-500">{r.batchNo}</td>
                    <td className="py-2.5 pr-3 text-stone-500">{r.supplierName || "—"}</td>
                    <td className="py-2.5 pr-3 text-stone-500">{r.invoiceNo || "—"}</td>
                    <td className="py-2.5 pr-3 font-semibold">
                      {fmtInt(r.qty)} <span className="text-xs font-normal text-stone-400">as {r.receivedAs}</span>
                    </td>
                    <td className="py-2.5 pr-3">{peso(r.totalCost)}</td>
                    <td className="py-2.5 pr-3 text-stone-500">{fmtExpiry(r.expiryDate)}</td>
                    <td className="py-2.5">
                      <Badge tone={r.status === "Released" ? "green" : "amber"}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Receiving" icon="truck-ramp-box" wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Product *</label>
            <select
              className={inputCls}
              value={itemId}
              onChange={(e) => {
                const id = Number(e.target.value);
                setItemId(id);
                const p = products.find((x) => x.id === id);
                if (p) {
                  setCostPrice(String(p.costPrice));
                  setReceivedAs(p.units.find((u) => u.isBase)?.name ?? p.unit);
                  setArea(p.area);
                  if (p.supplierId) setSupplierId(p.supplierId);
                }
              }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Received as (unit)</label>
            <select className={inputCls} value={receivedAs} onChange={(e) => setReceivedAs(e.target.value)}>
              {(product?.units ?? []).map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                  {u.conversionFactor !== 1 ? ` (= ${u.conversionFactor} base)` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Quantity (in that unit) *</label>
            <input className={inputCls} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Cost price per unit (₱)</label>
            <input className={inputCls} type="number" min={0} step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Expiry date</label>
            <input className={inputCls} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Supplier</label>
            <select className={inputCls} value={supplierId} onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">— None —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Invoice / DR number</label>
            <input className={inputCls} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Storage area</label>
            <input className={inputCls} list="ims-areas" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Wholesale" />
          </div>
          <div>
            <label className={labelCls}>Box status</label>
            <select className={inputCls} value={boxStatus} onChange={(e) => setBoxStatus(e.target.value as "Full" | "Partial")}>
              <option value="Full">Full</option>
              <option value="Partial">Partial</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Defective qty found</label>
            <input className={inputCls} type="number" min={0} value={defectiveQty} onChange={(e) => setDefectiveQty(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-800"
              checked={placed}
              onChange={(e) => setPlaced(e.target.checked)}
            />
            Already placed on shelf (settled)
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button
            className={btnPrimary}
            onClick={() => void submit()}
            disabled={saving || !product || Math.trunc(Number(qty) || 0) <= 0}
          >
            <Icon name="check" /> {saving ? "Saving…" : "Receive & stock in"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
