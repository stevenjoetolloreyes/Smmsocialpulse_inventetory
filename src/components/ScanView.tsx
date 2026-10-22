"use client";

import { useRef, useState } from "react";
import { useStore } from "./store";
import { Card, EmptyState, Icon, btnGhost, btnPrimary, inputCls } from "./ui";
import { ProductThumb, QrImage } from "./Qr";
import { Scanner } from "./Scanner";
import { extractCodeCandidate, ocrFromImage } from "@/lib/ocr";
import { findByCode, recordMovement } from "@/server/actions";
import { fmtInt, peso } from "@/lib/format";
import type { ProductDTO } from "@/lib/types";

export function ScanView() {
  const { run, showToast, openProduct } = useStore();
  const [cameraOn, setCameraOn] = useState(false);
  const [manual, setManual] = useState("");
  const [found, setFound] = useState<ProductDTO | null>(null);
  const [lastCode, setLastCode] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [qty, setQty] = useState("1");
  const [expiry, setExpiry] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const lookup = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    setLastCode(code);
    try {
      const result = await run(() => findByCode(code));
      setFound(result);
      setNotFound(!result);
      if (!result) showToast(`No product matches "${code}".`);
    } catch {
      /* toasted */
    }
  };

  const doAction = async (type: "in" | "out" | "adjust") => {
    if (!found) return;
    const n = Math.trunc(Number(qty));
    if (!Number.isFinite(n) || n < 0 || (type !== "adjust" && n <= 0)) {
      showToast("Enter a valid quantity.");
      return;
    }
    try {
      await run(() =>
        recordMovement({
          itemId: found.id,
          type,
          quantity: n,
          note: type === "adjust" ? "Set from Scan" : "Quick action from Scan",
          expiryDate: type === "in" && expiry ? expiry : null,
        }),
      );
      showToast(
        type === "adjust"
          ? `${found.name} count set to ${n}.`
          : `${found.name}: ${type === "in" ? "+" : "−"}${n} ${found.unit}.`,
      );
      // Re-read so the card shows the fresh balance.
      const fresh = await run(() => findByCode(found.code));
      setFound(fresh);
    } catch {
      /* toasted */
    }
  };

  const onOcrFile = async (file: File | undefined) => {
    if (!file) return;
    setOcrBusy(true);
    try {
      const text = await ocrFromImage(file);
      const candidate = extractCodeCandidate(text);
      if (candidate) {
        setManual(candidate);
        await lookup(candidate);
      } else {
        showToast("No code-like text found in that image.");
      }
    } catch {
      showToast("OCR failed on that image. Try a clearer photo or type the code.");
    } finally {
      setOcrBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="p-4">
        <Scanner active={cameraOn} onDetect={(code) => void lookup(code)} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className={cameraOn ? btnPrimary : btnGhost}
            onClick={() => setCameraOn((v) => !v)}
          >
            <Icon name="camera" /> {cameraOn ? "Stop camera" : "Start camera"}
          </button>
          <button className={btnGhost} onClick={() => fileRef.current?.click()} disabled={ocrBusy}>
            <Icon name="image" /> {ocrBusy ? "Reading photo…" : "Scan from photo (OCR)"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void onOcrFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <p className="mt-2 text-xs text-stone-400">
          The photo/OCR option reads a printed code or label with on-device text recognition —
          the result always stays editable before anything is saved.
        </p>
      </Card>

      <Card className="p-4">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
          Manual code entry
        </label>
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder="Type an item code (INV-0001), barcode or batch number"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void lookup(manual);
            }}
          />
          <button className={btnPrimary} onClick={() => void lookup(manual)}>
            <Icon name="magnifying-glass" /> Find
          </button>
        </div>
      </Card>

      {notFound && (
        <Card>
          <EmptyState
            icon="circle-question"
            title={`No product found for "${lastCode}"`}
            hint="Check the code and try again, or add the product in Inventory first."
          />
        </Card>
      )}

      {found && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <QrImage value={found.code} size={96} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <ProductThumb name={found.name} imageUrl={found.imageUrl} size={40} />
                <div>
                  <p className="font-bold text-stone-800">{found.name}</p>
                  <p className="text-xs text-stone-400">
                    {found.code} · {found.category}
                    {found.area ? ` · ${found.area}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                <span>
                  On hand: <strong>{fmtInt(found.quantity)}</strong> {found.unit}
                </span>
                <span>
                  Price: <strong>{peso(found.sellingPrice)}</strong>
                </span>
                <span>
                  Batches: <strong>{found.batchCount}</strong>
                </span>
              </div>
            </div>
            <button className={btnGhost} onClick={() => openProduct(found.id)}>
              <Icon name="eye" /> Full details
            </button>
          </div>

          <div className="mt-4 border-t border-stone-100 pt-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">
              Quick stock action
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                className={inputCls}
                type="number"
                min={0}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                aria-label="Quantity"
              />
              <input
                className={inputCls}
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                aria-label="Expiry date (for Stock In)"
              />
              <div className="flex gap-1.5">
                <button className={btnPrimary} onClick={() => void doAction("in")}>
                  <Icon name="arrow-down" /> In
                </button>
                <button className={btnGhost} onClick={() => void doAction("out")}>
                  <Icon name="arrow-up" /> Out
                </button>
                <button className={btnGhost} onClick={() => void doAction("adjust")}>
                  <Icon name="scale-balanced" /> Set
                </button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-stone-400">
              "Set" makes the quantity the exact counted total. Stock Out never goes below zero.
              The expiry date applies to Stock In (new batch).
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
