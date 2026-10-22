"use client";

import { useMemo, useRef, useState } from "react";
import { useStore } from "./store";
import { Card, EmptyState, Icon, btnGhost, btnPrimary, inputCls } from "./ui";
import { ProductThumb } from "./Qr";
import { Scanner } from "./Scanner";
import { extractCodeCandidate, ocrFromImage } from "@/lib/ocr";
import { findByCode, completeSale } from "@/server/actions";
import { fmtInt, peso } from "@/lib/format";
import type { ProductDTO } from "@/lib/types";

type CartLine = {
  itemId: number;
  name: string;
  unitName: string;
  unitPrice: number;
  qty: number;
  maxUnits: number;
};

function sellableOf(p: ProductDTO): number {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  return p.batches
    .filter((b) => b.status === "active" && b.qtyRemaining > 0 && (!b.expiryDate || b.expiryDate >= today))
    .reduce((s, b) => s + b.qtyRemaining, 0);
}

export function Pos() {
  const { data, run, showToast, printSale } = useStore();
  const { products, sales, settings } = data;
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerType, setCustomerType] = useState<"Regular" | "PWD" | "Senior">("Regular");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "GCash">("Cash");
  const [tendered, setTendered] = useState("");
  const [priceCheck, setPriceCheck] = useState(false);
  const [priceResult, setPriceResult] = useState<ProductDTO | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = products;
    if (!q) return pool.slice(0, 12);
    return pool
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q) ||
          p.units.some((u) => u.barcode.toLowerCase().includes(q)),
      )
      .slice(0, 12);
  }, [products, query]);

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const discountRate = customerType === "Regular" ? 0 : 0.2;
  const discount = Math.round(subtotal * discountRate * 100) / 100;
  const total = Math.round((subtotal - discount) * 100) / 100;
  const tenderedNum = parseFloat(tendered) || 0;
  const change = Math.max(0, Math.round((tenderedNum - total) * 100) / 100);
  const lastSale = sales[0];

  const addToCart = (p: ProductDTO, unitName?: string) => {
    const unit = p.units.find((u) => u.name === unitName) ?? p.units.find((u) => u.isBase) ?? p.units[0];
    if (!unit) return;
    const sellable = sellableOf(p);
    const maxUnits = Math.floor(sellable / unit.conversionFactor);
    if (maxUnits <= 0) {
      showToast(`${p.name} has no sellable stock.`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === p.id && l.unitName === unit.name);
      if (existing) {
        if (existing.qty >= maxUnits) {
          showToast(`Only ${maxUnits} ${unit.name} of ${p.name} available.`);
          return prev;
        }
        return prev.map((l) =>
          l === existing ? { ...l, qty: l.qty + 1, maxUnits } : l,
        );
      }
      return [
        ...prev,
        {
          itemId: p.id,
          name: p.name,
          unitName: unit.name,
          unitPrice: unit.sellingPrice,
          qty: 1,
          maxUnits,
        },
      ];
    });
  };

  const handleCode = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    try {
      const found = await run(() => findByCode(code));
      if (!found) {
        showToast(`No product matches "${code}".`);
        if (priceCheck) setPriceResult(null);
        return;
      }
      if (priceCheck) {
        setPriceResult(found);
      } else {
        const unit = found.units.find((u) => u.barcode && u.barcode === code);
        addToCart(found, unit?.name);
        showToast(`Added ${found.name} to cart.`);
      }
    } catch {
      /* run() already toasted */
    }
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    if (settings.security.requireTendered && paymentMethod === "Cash" && tenderedNum < total) {
      showToast("Enter the amount tendered — it must cover the total.");
      return;
    }
    try {
      const res = await run(() =>
        completeSale({
          lines: cart.map((l) => ({ itemId: l.itemId, unitName: l.unitName, qty: l.qty })),
          customerType,
          paymentMethod,
          amountTendered: tenderedNum,
        }),
      );
      setCart([]);
      setTendered("");
      showToast("Sale completed.");
      printSale(res.saleId);
    } catch {
      /* run() already toasted */
    }
  };

  const onOcrFile = async (file: File | undefined) => {
    if (!file) return;
    setOcrBusy(true);
    try {
      const text = await ocrFromImage(file);
      const candidate = extractCodeCandidate(text);
      if (candidate) {
        setQuery(candidate);
        await handleCode(candidate);
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
    <div className="grid gap-5 xl:grid-cols-5">
      {/* Left: search / scan / results */}
      <div className="space-y-4 xl:col-span-3">
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                <Icon name="magnifying-glass" />
              </span>
              <input
                className={`${inputCls} pl-9`}
                placeholder="Search product name, SKU or barcode — or scan/type a code and press Enter"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCode(query);
                }}
              />
            </div>
            <button
              className={btnGhost}
              onClick={() => setShowScanner((v) => !v)}
            >
              <Icon name="camera" /> {showScanner ? "Hide camera" : "Scan"}
            </button>
            <button
              className={btnGhost}
              onClick={() => fileRef.current?.click()}
              disabled={ocrBusy}
            >
              <Icon name="image" /> {ocrBusy ? "Reading…" : "OCR photo"}
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
            <button
              className={priceCheck ? btnPrimary : btnGhost}
              onClick={() => {
                setPriceCheck((v) => !v);
                setPriceResult(null);
              }}
            >
              <Icon name="tag" /> Price Check {priceCheck ? "ON" : ""}
            </button>
          </div>
          {showScanner && (
            <div className="mt-3">
              <Scanner active={showScanner} onDetect={(code) => void handleCode(code)} />
              <p className="mt-2 text-center text-xs text-stone-400">
                Point the camera at a product QR or barcode.{" "}
                {priceCheck ? "Price Check is ON — scans show the price instead of adding to cart." : "Scanned products are added to the cart."}
              </p>
            </div>
          )}
          {priceCheck && priceResult && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
              <ProductThumb name={priceResult.name} imageUrl={priceResult.imageUrl} size={48} />
              <div className="flex-1">
                <p className="font-bold text-stone-800">{priceResult.name}</p>
                <p className="text-xs text-stone-500">
                  {priceResult.code} · {fmtInt(priceResult.quantity)} {priceResult.unit} in stock
                </p>
              </div>
              <p className="text-xl font-bold text-emerald-700">{peso(priceResult.sellingPrice)}</p>
            </div>
          )}
          {priceCheck && !priceResult && (
            <p className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-500">
              Price Check mode: scan or type a code to see its price without adding it to the cart.
            </p>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {results.length === 0 && (
            <Card className="col-span-full">
              <EmptyState
                icon="magnifying-glass"
                title={products.length === 0 ? "No products yet" : "No matching products"}
                hint={
                  products.length === 0
                    ? "Add products in Inventory first, then sell them here."
                    : "Try a different name, SKU or barcode."
                }
              />
            </Card>
          )}
          {results.map((p) => {
            const sellable = sellableOf(p);
            return (
              <Card key={p.id} className="p-3">
                <div className="flex items-start gap-2.5">
                  <ProductThumb name={p.name} imageUrl={p.imageUrl} size={46} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-800">{p.name}</p>
                    <p className="text-xs text-stone-400">
                      {p.code} · {fmtInt(sellable)} sellable
                    </p>
                    <p className="text-sm font-bold text-[var(--brand)]">{peso(p.sellingPrice)}</p>
                  </div>
                </div>
                {p.units.length > 1 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.units.map((u) => (
                      <button
                        key={u.id}
                        disabled={sellable < u.conversionFactor}
                        onClick={() => (priceCheck ? setPriceResult(p) : addToCart(p, u.name))}
                        className="rounded-lg bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-200 disabled:opacity-40"
                      >
                        + {u.name} · {peso(u.sellingPrice)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    disabled={sellable <= 0}
                    onClick={() => (priceCheck ? setPriceResult(p) : addToCart(p))}
                    className={`${btnPrimary} mt-2 w-full py-1.5 text-xs`}
                  >
                    <Icon name="plus" /> Add to cart
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Right: cart */}
      <Card className="h-fit p-4 xl:col-span-2">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-stone-800">
          <span className="text-[var(--brand)]">
            <Icon name="cart-shopping" />
          </span>
          Cart
          {lastSale && (
            <button
              className="ml-auto text-xs font-semibold text-[var(--brand)] underline"
              onClick={() => printSale(lastSale.id)}
            >
              <Icon name="print" /> Reprint last receipt
            </button>
          )}
        </h2>

        {cart.length === 0 ? (
          <EmptyState icon="cart-shopping" title="Cart is empty" hint="Add products from the left, or scan a QR/barcode." />
        ) : (
          <ul className="nice-scroll max-h-64 space-y-2 overflow-y-auto pr-1">
            {cart.map((l) => (
              <li key={`${l.itemId}-${l.unitName}`} className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-700">{l.name}</p>
                  <p className="text-xs text-stone-400">
                    {l.unitName} · {peso(l.unitPrice)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-stone-600 shadow-sm"
                    onClick={() =>
                      setCart((prev) =>
                        prev
                          .map((x) => (x === l ? { ...x, qty: x.qty - 1 } : x))
                          .filter((x) => x.qty > 0),
                      )
                    }
                    aria-label="Decrease quantity"
                  >
                    <Icon name="minus" className="text-xs" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold">{l.qty}</span>
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-stone-600 shadow-sm"
                    onClick={() =>
                      setCart((prev) =>
                        prev.map((x) =>
                          x === l
                            ? { ...x, qty: Math.min(x.qty + 1, x.maxUnits) }
                            : x,
                        ),
                      )
                    }
                    aria-label="Increase quantity"
                  >
                    <Icon name="plus" className="text-xs" />
                  </button>
                </div>
                <span className="w-20 text-right text-sm font-bold text-stone-800">
                  {peso(l.unitPrice * l.qty)}
                </span>
                <button
                  className="text-red-400 hover:text-red-600"
                  onClick={() => setCart((prev) => prev.filter((x) => x !== l))}
                  aria-label="Remove line"
                >
                  <Icon name="trash" className="text-sm" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 space-y-3 border-t border-stone-100 pt-3">
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-400">
              Customer type
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {(["Regular", "PWD", "Senior"] as const).map((ct) => (
                <button
                  key={ct}
                  onClick={() => setCustomerType(ct)}
                  className={`rounded-xl px-2 py-2 text-sm font-semibold ${
                    customerType === ct
                      ? "bg-[var(--brand)] text-white"
                      : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {ct}
                  {ct !== "Regular" && <span className="block text-[10px] font-medium opacity-80">20% off</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-400">
              Payment method
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {(["Cash", "GCash"] as const).map((pm) => (
                <button
                  key={pm}
                  onClick={() => setPaymentMethod(pm)}
                  className={`flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold ${
                    paymentMethod === pm
                      ? "bg-[var(--brand)] text-white"
                      : "bg-stone-100 text-stone-600"
                  }`}
                >
                  <Icon name={pm === "Cash" ? "money-bill" : "mobile-screen"} /> {pm}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === "Cash" && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-400">
                Amount tendered
              </p>
              <input
                className={inputCls}
                inputMode="decimal"
                placeholder="0.00"
                value={tendered}
                onChange={(e) => setTendered(e.target.value.replace(/[^0-9.]/g, ""))}
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[50, 100, 200, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-200"
                    onClick={() => setTendered(String(Math.ceil(total / amt) * amt || amt))}
                  >
                    ₱{amt}
                  </button>
                ))}
                <button
                  className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-200"
                  onClick={() => setTendered(total ? String(total) : "")}
                >
                  Exact
                </button>
              </div>
            </div>
          )}

          <dl className="space-y-1 text-sm">
            <div className="flex justify-between text-stone-500">
              <dt>Subtotal</dt>
              <dd>{peso(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <dt>Discount ({customerType} 20%)</dt>
                <dd>−{peso(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-dashed border-stone-200 pt-1.5 text-base font-bold text-stone-800">
              <dt>Total</dt>
              <dd>{peso(total)}</dd>
            </div>
            {paymentMethod === "Cash" && tenderedNum > 0 && (
              <div className="flex justify-between font-semibold text-stone-600">
                <dt>Change</dt>
                <dd>{peso(change)}</dd>
              </div>
            )}
          </dl>

          <div className="flex gap-2">
            <button
              className={btnGhost}
              onClick={() => {
                setCart([]);
                setTendered("");
              }}
              disabled={cart.length === 0}
            >
              <Icon name="xmark" /> Cancel
            </button>
            <button
              className={`${btnPrimary} flex-1 py-2.5`}
              onClick={() => void checkout()}
              disabled={cart.length === 0}
            >
              <Icon name="check" /> Complete Sale
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
