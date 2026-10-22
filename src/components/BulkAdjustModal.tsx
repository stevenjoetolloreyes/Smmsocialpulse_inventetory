"use client";

import { useMemo, useState } from "react";
import { useStore } from "./store";
import { EmptyState, Icon, Modal, btnGhost, btnPrimary, inputCls } from "./ui";
import { ProductThumb } from "./Qr";
import { fmtInt } from "@/lib/format";
import { recordMovement } from "@/server/actions";

/**
 * Multi-product stock adjustment: type a target counted quantity per product
 * and apply them all at once. Each change writes its own movement + history.
 */
export function BulkAdjustModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, refresh, showToast } = useStore();
  const [targets, setTargets] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");
  const [applying, setApplying] = useState(false);

  const changes = useMemo(
    () =>
      data.products
        .map((p) => {
          const raw = targets[p.id];
          if (raw === undefined || raw === "") return null;
          const target = Math.trunc(Number(raw));
          if (!Number.isFinite(target) || target < 0 || target === p.quantity) return null;
          return { product: p, target };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [data.products, targets],
  );

  const apply = async () => {
    setApplying(true);
    let done = 0;
    try {
      for (const c of changes) {
        await recordMovement({
          itemId: c.product.id,
          type: "adjust",
          quantity: c.target,
          note: note.trim() || "Bulk adjustment",
        });
        done++;
      }
      await refresh();
      showToast(`Adjusted ${done} product(s).`);
      setTargets({});
      setNote("");
      onClose();
    } catch (e) {
      showToast(
        `Applied ${done} adjustment(s), then stopped: ${e instanceof Error ? e.message : "error"}`,
      );
      await refresh();
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Stock Adjustment" icon="sliders" wide>
      {data.products.length === 0 ? (
        <EmptyState icon="boxes-stacked" title="No products to adjust" />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-stone-500">
            Enter the new counted quantity for any product you want to correct. Blank rows are
            ignored; stock can never go below zero.
          </p>
          <input
            className={inputCls}
            placeholder="Note for all adjustments (e.g. Physical count — Oct 22)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="nice-scroll max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {data.products.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl bg-stone-50 px-3 py-2">
                <ProductThumb name={p.name} imageUrl={p.imageUrl} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-700">{p.name}</p>
                  <p className="text-xs text-stone-400">
                    Current: {fmtInt(p.quantity)} {p.unit}
                  </p>
                </div>
                <input
                  className={`${inputCls} w-28`}
                  type="number"
                  min={0}
                  placeholder="New count"
                  value={targets[p.id] ?? ""}
                  onChange={(e) => setTargets((t) => ({ ...t, [p.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-stone-500">
              {changes.length} change(s) ready
            </span>
            <div className="flex gap-2">
              <button className={btnGhost} onClick={onClose}>
                Cancel
              </button>
              <button
                className={btnPrimary}
                disabled={changes.length === 0 || applying}
                onClick={() => void apply()}
              >
                <Icon name="check" /> {applying ? "Applying…" : "Apply adjustments"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
