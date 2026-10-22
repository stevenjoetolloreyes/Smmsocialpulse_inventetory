"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "./store";
import {
  Badge, Card, EmptyState, Icon, Modal, SectionTitle,
  btnGhost, btnPrimary, inputCls, labelCls,
} from "./ui";
import { ProductThumb, QrImage } from "./Qr";
import {
  csvEscape, downloadTextFile, fmtExpiry, fmtInt, parseCsv, peso, stockStatus,
} from "@/lib/format";
import {
  deleteProduct, importProducts, recordMovement, saveProduct, setProductStatus, suggestItemCode,
  type ProductFormInput,
} from "@/server/actions";
import type { ImportRow, ProductDTO } from "@/lib/types";
import { ProductDetail } from "./ProductDetail";
import { BulkAdjustModal } from "./BulkAdjustModal";

const PAGE_SIZES = [10, 25, 50];

type UnitRow = { name: string; factor: string; price: string; barcode: string };

type FormState = {
  id: number | null;
  name: string;
  code: string;
  category: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  reorderLevel: number;
  location: string;
  notes: string;
  imageUrl: string;
  supplierId: number | null;
  barcode: string;
  area: string;
  openingQty: number;
  openingExpiry: string;
  units: UnitRow[];
};

function blankForm(code: string): FormState {
  return {
    id: null,
    name: "",
    code,
    category: "General",
    unit: "pcs",
    costPrice: 0,
    sellingPrice: 0,
    reorderLevel: 5,
    location: "",
    notes: "",
    imageUrl: "",
    supplierId: null,
    barcode: "",
    area: "",
    openingQty: 0,
    openingExpiry: "",
    units: [],
  };
}

export function Inventory() {
  const { data, run, showToast, setView, selectedProductId, openProduct } = useStore();
  const { products, suppliers, categories } = data;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankForm(""));
  const [importOpen, setImportOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === "All" || p.category === category) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)),
    );
  }, [products, query, category]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  const selected = selectedProductId
    ? products.find((p) => p.id === selectedProductId) ?? null
    : null;

  const openAdd = async () => {
    try {
      const { code } = await run(() => suggestItemCode());
      setForm(blankForm(code));
    } catch {
      setForm(blankForm(""));
    }
    setFormOpen(true);
  };

  const openEdit = (p: ProductDTO) => {
    setForm({
      id: p.id,
      name: p.name,
      code: p.code,
      category: p.category,
      unit: p.units.find((u) => u.isBase)?.name ?? p.unit,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      reorderLevel: p.reorderLevel,
      location: p.location,
      notes: p.notes,
      imageUrl: p.imageUrl,
      supplierId: p.supplierId,
      barcode: p.barcode,
      area: p.area,
      openingQty: 0,
      openingExpiry: "",
      units: p.units
        .filter((u) => !u.isBase)
        .map((u) => ({
          name: u.name,
          factor: String(u.conversionFactor),
          price: String(u.sellingPrice),
          barcode: u.barcode,
        })),
    });
    setFormOpen(true);
  };

  const submitForm = async () => {
    setSaving(true);
    try {
      const payload: ProductFormInput = {
        id: form.id,
        name: form.name,
        code: form.code,
        category: form.category,
        unit: form.unit,
        costPrice: Number(form.costPrice) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
        reorderLevel: Math.max(0, Math.trunc(Number(form.reorderLevel) || 0)),
        location: form.location,
        notes: form.notes,
        imageUrl: form.imageUrl,
        supplierId: form.supplierId,
        barcode: form.barcode,
        area: form.area,
        openingQty: Math.max(0, Math.trunc(Number(form.openingQty) || 0)),
        expiryDate: form.openingExpiry ? form.openingExpiry : null,
        extraUnits: form.units
          .filter((u) => u.name.trim())
          .map((u) => ({
            name: u.name.trim(),
            conversionFactor: Math.max(0.0001, parseFloat(u.factor) || 1),
            sellingPrice: Math.max(0, parseFloat(u.price) || 0),
            barcode: u.barcode.trim(),
          })),
      };
      await run(() => saveProduct(payload));
      setFormOpen(false);
      showToast(form.id ? "Product updated." : "Product added.");
    } catch {
      /* toasted */
    } finally {
      setSaving(false);
    }
  };

  const setF = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
              <Icon name="magnifying-glass" />
            </span>
            <input
              className={`${inputCls} pl-9`}
              placeholder="Search by name, SKU or barcode"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            className={`${inputCls} w-auto`}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
          >
            <option value="All">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className={`${inputCls} w-auto`}
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            aria-label="Items per page"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
          <button className={btnPrimary} onClick={() => void openAdd()}>
            <Icon name="plus" /> Add Product
          </button>
          <button className={btnGhost} onClick={() => setImportOpen(true)}>
            <Icon name="file-import" /> Import CSV
          </button>
          <button className={btnGhost} onClick={() => setAdjustOpen(true)}>
            <Icon name="sliders" /> Adjustment
          </button>
          <button className={btnGhost} onClick={() => setView("bulk")}>
            <Icon name="layer-group" /> Bulk Restock
          </button>
        </div>
      </Card>

      {products.length === 0 ? (
        <Card>
          <EmptyState
            icon="boxes-stacked"
            title="No products yet"
            hint="Your inventory starts empty. Add your first product or import a CSV list."
            action={
              <button className={btnPrimary} onClick={() => void openAdd()}>
                <Icon name="plus" /> Add your first product
              </button>
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon="magnifying-glass" title="No products match your filters" />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((p) => {
              const st = stockStatus(p);
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <button onClick={() => openProduct(p.id)}>
                      <ProductThumb name={p.name} imageUrl={p.imageUrl} size={52} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <button
                        className="block max-w-full truncate text-left font-semibold text-stone-800 hover:underline"
                        onClick={() => openProduct(p.id)}
                      >
                        {p.name}
                      </button>
                      <p className="text-xs text-stone-400">
                        {p.code} · {p.category}
                        {p.area ? ` · ${p.area}` : ""}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold text-stone-800">{peso(p.sellingPrice)}</span>
                        <span className="text-xs text-stone-400">
                          · {fmtInt(p.quantity)} {p.unit} in stock
                        </span>
                        {st === "out" && <Badge tone="red">Out of stock</Badge>}
                        {st === "low" && <Badge tone="amber">Low stock</Badge>}
                        {p.productStatus !== "active" && (
                          <Badge tone="violet">{p.productStatus}</Badge>
                        )}
                      </div>
                    </div>
                    <QrImage value={p.code} size={52} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-stone-100 pt-3">
                    <button className={btnGhost} onClick={() => openProduct(p.id)}>
                      <Icon name="eye" /> Details
                    </button>
                    <button className={btnGhost} onClick={() => openEdit(p)}>
                      <Icon name="pen" /> Edit
                    </button>
                    <QuickAdjust product={p} />
                    <button
                      className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold text-red-500 hover:bg-red-50"
                      onClick={async () => {
                        if (!window.confirm(`Move ${p.name} to Recently Deleted? Its stock history is kept.`)) return;
                        await run(() => deleteProduct(p.id));
                        showToast(`${p.name} moved to Recently Deleted.`);
                      }}
                    >
                      <Icon name="trash" /> Delete
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-sm text-stone-500">
            <span>
              Showing {filtered.length === 0 ? 0 : page * pageSize + 1}–
              {Math.min(filtered.length, page * pageSize + pageSize)} of {filtered.length}
            </span>
            <div className="flex gap-1.5">
              <button
                className={btnGhost}
                disabled={page <= 0}
                onClick={() => setPage((x) => Math.max(0, x - 1))}
              >
                <Icon name="chevron-left" />
              </button>
              <span className="flex items-center px-1 font-semibold">
                {page + 1} / {pageCount}
              </span>
              <button
                className={btnGhost}
                disabled={page >= pageCount - 1}
                onClick={() => setPage((x) => Math.min(pageCount - 1, x + 1))}
              >
                <Icon name="chevron-right" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Product form modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? "Edit Product" : "Add Product"}
        icon="box"
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Product name *</label>
            <input className={inputCls} value={form.name} onChange={(e) => setF("name", e.target.value)} placeholder="e.g. Lucky Me Pancit Canton" />
          </div>
          <div>
            <label className={labelCls}>SKU / Item code *</label>
            <input className={inputCls} value={form.code} onChange={(e) => setF("code", e.target.value)} placeholder="INV-0001" />
            <p className="mt-1 text-[11px] text-stone-400">This code is what the product's QR code contains.</p>
          </div>
          <div>
            <label className={labelCls}>Barcode (base unit)</label>
            <input className={inputCls} value={form.barcode} onChange={(e) => setF("barcode", e.target.value)} placeholder="Manufacturer barcode, if any" />
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <input className={inputCls} list="ims-categories" value={form.category} onChange={(e) => setF("category", e.target.value)} />
            <datalist id="ims-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Storage area</label>
            <input className={inputCls} list="ims-areas" value={form.area} onChange={(e) => setF("area", e.target.value)} placeholder="e.g. Wholesale" />
            <datalist id="ims-areas">
              {data.areas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Base unit name</label>
            <input className={inputCls} value={form.unit} onChange={(e) => setF("unit", e.target.value)} placeholder="pcs, sachet, bottle…" />
          </div>
          <div>
            <label className={labelCls}>Reorder level</label>
            <input className={inputCls} type="number" min={0} value={form.reorderLevel} onChange={(e) => setF("reorderLevel", Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Cost price (₱)</label>
            <input className={inputCls} type="number" min={0} step="0.01" value={form.costPrice} onChange={(e) => setF("costPrice", Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Selling price (₱)</label>
            <input className={inputCls} type="number" min={0} step="0.01" value={form.sellingPrice} onChange={(e) => setF("sellingPrice", Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Default supplier</label>
            <select className={inputCls} value={form.supplierId ?? ""} onChange={(e) => setF("supplierId", e.target.value ? Number(e.target.value) : null)}>
              <option value="">— None —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Shelf location</label>
            <input className={inputCls} value={form.location} onChange={(e) => setF("location", e.target.value)} placeholder="e.g. Aisle 2, Shelf B" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Image URL (optional)</label>
            {data.plan.imageUpload ? (
              <input className={inputCls} value={form.imageUrl} onChange={(e) => setF("imageUrl", e.target.value)} placeholder="https://… — leave blank to use initials" />
            ) : (
              <p className="rounded-xl bg-stone-50 px-3.5 py-2.5 text-xs leading-relaxed text-stone-500">
                Product images are available on the <strong>Pro</strong> and{" "}
                <strong>Business</strong> plans. Your store is on the{" "}
                <strong>{data.plan.name}</strong> plan, so products use their initials
                instead — see Subscription for how upgrades work.
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Notes</label>
            <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setF("notes", e.target.value)} />
          </div>

          {!form.id && (
            <>
              <div>
                <label className={labelCls}>Opening quantity (base units)</label>
                <input className={inputCls} type="number" min={0} value={form.openingQty} onChange={(e) => setF("openingQty", Number(e.target.value))} />
              </div>
              <div>
                <label className={labelCls}>Opening batch expiry</label>
                <input className={inputCls} type="date" value={form.openingExpiry} onChange={(e) => setF("openingExpiry", e.target.value)} />
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <span className={labelCls}>Additional units (pack, case, box…)</span>
              <button
                className={btnGhost}
                onClick={() => setF("units", [...form.units, { name: "", factor: "12", price: "", barcode: "" }])}
              >
                <Icon name="plus" /> Add unit
              </button>
            </div>
            {form.units.length === 0 && (
              <p className="text-xs text-stone-400">
                Optional. Each extra unit converts to base units (e.g. 1 pack = 12 pcs) and can carry its own price and barcode.
              </p>
            )}
            <div className="space-y-2">
              {form.units.map((u, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-xl bg-stone-50 p-2.5 sm:grid-cols-5">
                  <input className={inputCls} placeholder="Unit name (pack)" value={u.name} onChange={(e) => setF("units", form.units.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <input className={inputCls} type="number" min="0.0001" step="any" placeholder="= base units" value={u.factor} onChange={(e) => setF("units", form.units.map((x, j) => (j === i ? { ...x, factor: e.target.value } : x)))} />
                  <input className={inputCls} type="number" min={0} step="0.01" placeholder="Price ₱" value={u.price} onChange={(e) => setF("units", form.units.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                  <input className={inputCls} placeholder="Barcode" value={u.barcode} onChange={(e) => setF("units", form.units.map((x, j) => (j === i ? { ...x, barcode: e.target.value } : x)))} />
                  <button className="text-red-500 hover:text-red-700" onClick={() => setF("units", form.units.filter((_, j) => j !== i))} aria-label="Remove unit">
                    <Icon name="trash" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setFormOpen(false)}>
            Cancel
          </button>
          <button className={btnPrimary} onClick={() => void submitForm()} disabled={saving || !form.name.trim() || !form.code.trim()}>
            <Icon name="floppy-disk" /> {saving ? "Saving…" : "Save product"}
          </button>
        </div>
      </Modal>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <BulkAdjustModal open={adjustOpen} onClose={() => setAdjustOpen(false)} />

      {selected && (
        <ProductDetail
          product={selected}
          onClose={() => openProduct(null)}
          onEdit={() => openEdit(selected)}
        />
      )}
    </div>
  );
}

function QuickAdjust({ product }: { product: ProductDTO }) {
  const { run, showToast } = useStore();
  const doAdjust = async (type: "in" | "out") => {
    const raw = window.prompt(
      `${type === "in" ? "Stock in" : "Stock out"} — how many ${product.unit} of ${product.name}?`,
      "1",
    );
    if (raw === null) return;
    const qty = Math.trunc(Number(raw));
    if (!qty || qty <= 0) {
      showToast("Enter a quantity greater than zero.");
      return;
    }
    try {
      await run(() => recordMovement({ itemId: product.id, type, quantity: qty, note: "Quick adjust" }));
      showToast(`${product.name}: ${type === "in" ? "+" : "−"}${qty} ${product.unit}.`);
    } catch {
      /* toasted */
    }
  };
  return (
    <>
      <button className={btnGhost} onClick={() => void doAdjust("in")}>
        <Icon name="arrow-down" /> In
      </button>
      <button className={btnGhost} onClick={() => void doAdjust("out")}>
        <Icon name="arrow-up" /> Out
      </button>
    </>
  );
}

const IMPORT_HEADERS = [
  "PRODUCT NAME", "CATEGORY", "SKU", "REORDER POINT", "BATCH NUMBER",
  "QTY ON HAND", "COST PRICE", "EXPIRY DATE", "UNIT TYPE", "SELLING PRICE",
  "BARCODE",
];

// The parser accepts the canonical ALL-CAPS headers above as well as their
// Title Case equivalents ("Product Name", "Category", …), case-insensitively.
const HEADER_ALIASES: Record<string, string[]> = {
  productName: ["product name"],
  category: ["category"],
  sku: ["sku"],
  reorderPoint: ["reorder point"],
  batchNumber: ["batch number"],
  qtyOnHand: ["qty on hand"],
  costPrice: ["cost price"],
  expiryDate: ["expiry date"],
  unitType: ["unit type"],
  sellingPrice: ["selling price"],
  barcode: ["barcode"],
};

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { run, showToast } = useStore();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const downloadTemplate = () => {
    const example1: Record<string, string> = {
      "PRODUCT NAME": "EXAMPLE — Coca-Cola 1.5L (delete this row)",
      CATEGORY: "Beverages",
      SKU: "INV-0101",
      "REORDER POINT": "10",
      "BATCH NUMBER": "BATCH-2026-00101",
      "QTY ON HAND": "24",
      "COST PRICE": "62",
      "EXPIRY DATE": "2027-03-01",
      "UNIT TYPE": "bottle",
      "SELLING PRICE": "75",
      BARCODE: "4800016641879",
    };
    const example2: Record<string, string> = {
      "PRODUCT NAME": "EXAMPLE — Lucky Me Pancit Canton (delete this row)",
      CATEGORY: "Noodles",
      SKU: "",
      "REORDER POINT": "20",
      "BATCH NUMBER": "",
      "QTY ON HAND": "100",
      "COST PRICE": "11.5",
      "EXPIRY DATE": "",
      "UNIT TYPE": "pack",
      "SELLING PRICE": "14",
      BARCODE: "",
    };
    const line = (r: Record<string, string>) =>
      IMPORT_HEADERS.map((h) => csvEscape(r[h] ?? "")).join(",");
    const csv = [IMPORT_HEADERS.join(","), line(example1), line(example2)].join("\n");
    downloadTextFile("inventory-import-template.csv", csv);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const grid = parseCsv(text);
    if (grid.length < 2) {
      showToast("That file has no data rows.");
      setRows([]);
      return;
    }
    // Normalize headers: trim + lowercase, then match each field by alias so
    // both "PRODUCT NAME" and "Product Name" (any casing) are accepted.
    const header = grid[0].map((h) => h.trim().toLowerCase());
    const colOf = (field: keyof typeof HEADER_ALIASES) => {
      for (const alias of HEADER_ALIASES[field]) {
        const i = header.indexOf(alias);
        if (i >= 0) return i;
      }
      return -1;
    };
    const cols = {
      productName: colOf("productName"),
      category: colOf("category"),
      sku: colOf("sku"),
      reorderPoint: colOf("reorderPoint"),
      batchNumber: colOf("batchNumber"),
      qtyOnHand: colOf("qtyOnHand"),
      costPrice: colOf("costPrice"),
      expiryDate: colOf("expiryDate"),
      unitType: colOf("unitType"),
      sellingPrice: colOf("sellingPrice"),
      barcode: colOf("barcode"),
    };
    if (cols.productName < 0) {
      showToast('Could not find a "PRODUCT NAME" column in that file. Use the downloadable template.');
      setRows([]);
      return;
    }
    const cell = (cells: string[], i: number) => (i >= 0 ? (cells[i] ?? "") : "");
    const num = (v: string) => {
      const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };
    const parsed: ImportRow[] = grid.slice(1).map((cells) => ({
      productName: cell(cells, cols.productName),
      sku: cell(cells, cols.sku),
      barcode: cell(cells, cols.barcode),
      category: cell(cells, cols.category),
      unitType: cell(cells, cols.unitType),
      costPrice: num(cell(cells, cols.costPrice)),
      sellingPrice: num(cell(cells, cols.sellingPrice)),
      reorderPoint: num(cell(cells, cols.reorderPoint)),
      qtyOnHand: num(cell(cells, cols.qtyOnHand)),
      expiryDate: cell(cells, cols.expiryDate),
      batchNumber: cell(cells, cols.batchNumber),
    }));
    setRows(parsed);
  };

  const doImport = async () => {
    setImporting(true);
    try {
      const res = await run(() => importProducts(rows));
      showToast(
        `Import done: ${res.imported} imported, ${res.skipped} skipped.${res.errors.length ? " " + res.errors.slice(0, 2).join(" ") : ""}`,
      );
      setRows([]);
      setFileName("");
      onClose();
    } catch {
      /* toasted */
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Import Products from CSV" icon="file-import" wide>
      <div className="space-y-3">
        <p className="text-sm text-stone-500">
          Use the template so the columns line up. Rows with an existing SKU add their
          Qty on Hand as a new batch; new SKUs create new products.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={btnGhost} onClick={downloadTemplate}>
            <Icon name="download" /> Download template
          </button>
          <button className={btnGhost} onClick={() => fileRef.current?.click()}>
            <Icon name="folder-open" /> Choose CSV file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {fileName && <span className="self-center text-sm font-medium text-stone-600">{fileName}</span>}
        </div>

        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-700">
                {rows.length} row(s) parsed from the file
              </span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                {rows.filter((r) => r.productName.trim()).length} will be imported
              </span>
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-700">
                {rows.filter((r) => !r.productName.trim()).length} will be skipped (no product name)
              </span>
            </div>
            <div className="nice-scroll max-h-64 overflow-auto rounded-xl border border-stone-200">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="sticky top-0 bg-stone-50">
                  <tr>
                    {["Name", "SKU", "Category", "Unit", "Cost", "Price", "Qty", "Expiry"].map((h) => (
                      <th key={h} className="px-2.5 py-2 font-semibold text-stone-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((r, i) => (
                    <tr key={i} className={r.productName.trim() ? "" : "bg-red-50"}>
                      <td className="px-2.5 py-1.5 font-medium">{r.productName || "(missing name)"}</td>
                      <td className="px-2.5 py-1.5">{r.sku || "(auto)"}</td>
                      <td className="px-2.5 py-1.5">{r.category || "General"}</td>
                      <td className="px-2.5 py-1.5">{r.unitType || "pcs"}</td>
                      <td className="px-2.5 py-1.5">{peso(r.costPrice)}</td>
                      <td className="px-2.5 py-1.5">{peso(r.sellingPrice)}</td>
                      <td className="px-2.5 py-1.5">{fmtInt(r.qtyOnHand)}</td>
                      <td className="px-2.5 py-1.5">{r.expiryDate ? fmtExpiry(r.expiryDate) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-stone-400">
              Nothing is saved yet — review the counts above, then press Import to save these rows.
              Rows highlighted in red have no product name and will be skipped.
            </p>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button className={btnPrimary} onClick={() => void doImport()} disabled={rows.length === 0 || importing}>
            <Icon name="file-import" /> {importing ? "Importing…" : `Import ${rows.length} row(s)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
