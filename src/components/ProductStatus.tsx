"use client";

import { useMemo, useState } from "react";
import { useStore } from "./store";
import { Badge, Card, EmptyState, Icon, SectionTitle, btnGhost } from "./ui";
import { ProductThumb } from "./Qr";
import { daysUntil, fmtExpiry, fmtInt } from "@/lib/format";
import { setBatchPlaced, setBatchStatus, updateBatchDetails } from "@/server/actions";
import type { BatchDTO } from "@/lib/types";

type Filter = "all" | "active" | "expired" | "recalled" | "damaged" | "archived" | "near-expiry" | "partial" | "defective";

const FILTERS: { key: Filter; label: string; icon: string }[] = [
  { key: "all", label: "All batches", icon: "layer-group" },
  { key: "active", label: "Active", icon: "circle-check" },
  { key: "near-expiry", label: "Near expiry (30d)", icon: "hourglass-half" },
  { key: "expired", label: "Expired", icon: "calendar-xmark" },
  { key: "recalled", label: "Recalled", icon: "rotate-left" },
  { key: "damaged", label: "Damaged", icon: "heart-crack" },
  { key: "archived", label: "Archived", icon: "box-archive" },
  { key: "partial", label: "Partial boxes", icon: "box-open" },
  { key: "defective", label: "With defective", icon: "triangle-exclamation" },
];

type Row = { batch: BatchDTO; productId: number; productName: string; unit: string; imageUrl: string };

export function ProductStatus() {
  const { data, run, showToast, openProduct } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [areaFilter, setAreaFilter] = useState("All");
  const [newArea, setNewArea] = useState("");

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const p of data.products) {
      for (const b of p.batches) {
        out.push({ batch: b, productId: p.id, productName: p.name, unit: p.unit, imageUrl: p.imageUrl });
      }
    }
    return out;
  }, [data.products]);

  const counts = useMemo(() => {
    return {
      active: rows.filter((r) => r.batch.status === "active").length,
      expired: rows.filter(
        (r) => r.batch.status === "expired" || (r.batch.expiryDate && daysUntil(r.batch.expiryDate) < 0),
      ).length,
      recalled: rows.filter((r) => r.batch.status === "recalled").length,
      damaged: rows.filter((r) => r.batch.status === "damaged").length,
      archived: rows.filter((r) => r.batch.status === "archived").length,
      near: rows.filter(
        (r) => r.batch.expiryDate && daysUntil(r.batch.expiryDate) >= 0 && daysUntil(r.batch.expiryDate) <= 30,
      ).length,
      partial: rows.filter((r) => r.batch.boxStatus === "Partial").length,
      defectiveUnits: rows.reduce((s, r) => s + r.batch.defectiveQty, 0),
    };
  }, [rows]);

  const visible = rows.filter((r) => {
    if (areaFilter !== "All" && (r.batch.area || "Unassigned") !== areaFilter) return false;
    switch (filter) {
      case "all":
        return true;
      case "active":
        return r.batch.status === "active";
      case "expired":
        return r.batch.status === "expired" || (!!r.batch.expiryDate && daysUntil(r.batch.expiryDate) < 0);
      case "recalled":
        return r.batch.status === "recalled";
      case "damaged":
        return r.batch.status === "damaged";
      case "archived":
        return r.batch.status === "archived";
      case "near-expiry":
        return !!r.batch.expiryDate && daysUntil(r.batch.expiryDate) >= 0 && daysUntil(r.batch.expiryDate) <= 30;
      case "partial":
        return r.batch.boxStatus === "Partial";
      case "defective":
        return r.batch.defectiveQty > 0;
    }
  });

  const areaSummary = useMemo(() => {
    const map = new Map<string, { batches: number; settled: number; unsettled: number }>();
    for (const r of rows) {
      if (r.batch.qtyRemaining <= 0) continue;
      if (r.batch.status !== "active" && r.batch.status !== "expired" && r.batch.status !== "recalled") continue;
      const area = r.batch.area || "Unassigned";
      const cur = map.get(area) ?? { batches: 0, settled: 0, unsettled: 0 };
      cur.batches++;
      if (r.batch.placed) cur.settled += r.batch.qtyRemaining;
      else cur.unsettled += r.batch.qtyRemaining;
      map.set(area, cur);
    }
    return [...map.entries()];
  }, [rows]);

  const summaryCards = [
    { icon: "circle-check", label: "Active batches", value: counts.active, tone: "bg-emerald-50 text-emerald-700" },
    { icon: "hourglass-half", label: "Near expiry", value: counts.near, tone: "bg-amber-50 text-amber-700" },
    { icon: "calendar-xmark", label: "Expired", value: counts.expired, tone: "bg-red-50 text-red-700" },
    { icon: "rotate-left", label: "Recalled", value: counts.recalled, tone: "bg-violet-50 text-violet-700" },
    { icon: "heart-crack", label: "Damaged", value: counts.damaged, tone: "bg-orange-50 text-orange-700" },
    { icon: "triangle-exclamation", label: "Defective units", value: counts.defectiveUnits, tone: "bg-red-50 text-red-700" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {summaryCards.map((c) => (
          <Card key={c.label} className="p-4">
            <span className={`mb-1 inline-flex h-8 w-8 items-center justify-center rounded-lg ${c.tone}`}>
              <Icon name={c.icon} />
            </span>
            <p className="text-lg font-bold text-stone-800">{fmtInt(c.value)}</p>
            <p className="text-xs font-semibold text-stone-500">{c.label}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <SectionTitle icon="warehouse" title="Storage Areas — Settled vs Unsettled" />
        {areaSummary.length === 0 ? (
          <EmptyState icon="warehouse" title="No stock in any area yet" hint="Areas appear here once batches with remaining stock exist." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {areaSummary.map(([name, v]) => (
              <div key={name} className="rounded-xl bg-stone-50 px-4 py-3">
                <p className="font-semibold text-stone-700">{name}</p>
                <p className="text-xs text-stone-400">
                  {v.batches} batch(es) with stock
                </p>
                <div className="mt-2 flex gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                    Settled: {fmtInt(v.settled)}
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                    Unsettled: {fmtInt(v.unsettled)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
          <input
            className="w-56 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            placeholder="New storage area name"
            value={newArea}
            onChange={(e) => setNewArea(e.target.value)}
          />
          <AreaButtons newArea={newArea} clear={() => setNewArea("")} />
          <span className="self-center text-xs text-stone-400">
            Areas: {data.areas.length ? data.areas.join(", ") : "none yet"}
          </span>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle icon="clipboard-check" title="Batch Status" />
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${
                filter === f.key ? "bg-[var(--brand)] text-white" : "bg-stone-100 text-stone-600"
              }`}
            >
              <Icon name={f.icon} /> {f.label}
            </button>
          ))}
          <select
            className="ml-auto rounded-xl border border-stone-300 px-3 py-1.5 text-sm"
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            aria-label="Filter by area"
          >
            <option value="All">All areas</option>
            {data.areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            <option value="Unassigned">Unassigned</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon="layer-group" title="No batches yet" hint="Batches are created by stock-ins, receiving, restocks and imports." />
        ) : visible.length === 0 ? (
          <EmptyState icon="filter" title="No batches match this filter" />
        ) : (
          <div className="nice-scroll overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-xs uppercase text-stone-400">
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Batch</th>
                  <th className="py-2 pr-3">Remaining</th>
                  <th className="py-2 pr-3">Expiry</th>
                  <th className="py-2 pr-3">Box</th>
                  <th className="py-2 pr-3">Defective</th>
                  <th className="py-2 pr-3">Area</th>
                  <th className="py-2 pr-3">Placed</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visible.map(({ batch: b, productId, productName, unit, imageUrl }) => {
                  const days = b.expiryDate ? daysUntil(b.expiryDate) : null;
                  return (
                    <tr key={b.id}>
                      <td className="py-2.5 pr-3">
                        <button className="flex items-center gap-2 text-left" onClick={() => openProduct(productId)}>
                          <ProductThumb name={productName} imageUrl={imageUrl} size={30} />
                          <span className="font-medium text-stone-700 hover:underline">{productName}</span>
                        </button>
                      </td>
                      <td className="py-2.5 pr-3 text-stone-500">{b.batchNo}</td>
                      <td className="py-2.5 pr-3 font-semibold">
                        {fmtInt(b.qtyRemaining)} <span className="text-xs font-normal text-stone-400">{unit}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={days !== null && days < 0 ? "font-semibold text-red-600" : days !== null && days <= 30 ? "font-semibold text-amber-600" : "text-stone-500"}>
                          {fmtExpiry(b.expiryDate)}
                          {days !== null && days < 0 ? " (expired)" : days !== null && days <= 30 ? ` (${days}d)` : ""}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <button
                          className="underline decoration-dotted underline-offset-2"
                          onClick={async () => {
                            await run(() =>
                              updateBatchDetails({
                                batchId: b.id,
                                defectiveQty: b.defectiveQty,
                                boxStatus: b.boxStatus === "Full" ? "Partial" : "Full",
                                area: b.area,
                              }),
                            );
                            showToast(`Batch ${b.batchNo} box set to ${b.boxStatus === "Full" ? "Partial" : "Full"}.`);
                          }}
                        >
                          <Badge tone={b.boxStatus === "Full" ? "blue" : "amber"}>{b.boxStatus}</Badge>
                        </button>
                      </td>
                      <td className="py-2.5 pr-3 text-stone-600">{b.defectiveQty > 0 ? b.defectiveQty : "—"}</td>
                      <td className="py-2.5 pr-3 text-stone-500">{b.area || "—"}</td>
                      <td className="py-2.5 pr-3">
                        <button
                          className={btnGhost}
                          onClick={async () => {
                            await run(() => setBatchPlaced(b.id, !b.placed));
                            showToast(b.placed ? "Batch unsettled." : "Batch settled.");
                          }}
                        >
                          <Icon name={b.placed ? "box" : "box-open"} /> {b.placed ? "Settled" : "Unsettled"}
                        </button>
                      </td>
                      <td className="py-2.5">
                        <select
                          className="rounded-lg border border-stone-300 px-2 py-1 text-sm"
                          value={b.status}
                          onChange={async (e) => {
                            await run(() => setBatchStatus(b.id, e.target.value as "active" | "expired" | "recalled" | "damaged" | "archived"));
                            showToast(`Batch ${b.batchNo} → ${e.target.value}.`);
                          }}
                          aria-label={`Status for batch ${b.batchNo}`}
                        >
                          {["active", "expired", "recalled", "damaged", "archived"].map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function AreaButtons({ newArea, clear }: { newArea: string; clear: () => void }) {
  const { data, run, showToast } = useStore();
  return (
    <>
      <button
        className={btnGhost}
        disabled={!newArea.trim()}
        onClick={async () => {
          const { saveArea } = await import("@/server/actions");
          await run(() => saveArea(newArea));
          showToast(`Area "${newArea.trim()}" added.`);
          clear();
        }}
      >
        <Icon name="plus" /> Add area
      </button>
      {data.areas.map((a) => (
        <button
          key={a}
          className="rounded-xl px-2 py-2 text-xs font-semibold text-red-400 hover:bg-red-50"
          title={`Remove area ${a}`}
          onClick={async () => {
            if (!window.confirm(`Remove the "${a}" area from the list? Products already assigned keep their area label.`)) return;
            const { deleteArea } = await import("@/server/actions");
            await run(() => deleteArea(a));
            showToast(`Area "${a}" removed.`);
          }}
        >
          <Icon name="xmark" /> {a}
        </button>
      ))}
    </>
  );
}
