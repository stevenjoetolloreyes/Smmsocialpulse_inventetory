import { asc, desc, eq } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as t from "@/lib/schema";
import { hashPassword } from "@/lib/auth";
import type { BatchDTO, ProductDTO, SettingsDTO } from "@/lib/types";

export type ItemRow = typeof t.items.$inferSelect;
export type BatchRow = typeof t.batches.$inferSelect;

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Local "today" as YYYY-MM-DD in the store's timezone (Asia/Manila). */
export function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

/* ---------------- code generators ---------------- */

export function nextItemCode(codes: string[]): string {
  let max = 0;
  for (const code of codes) {
    const m = /^INV-(\d+)$/i.exec(code.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `INV-${String(max + 1).padStart(4, "0")}`;
}

export function nextBatchNo(existing: string[]): string {
  const year = new Date().getFullYear();
  let max = 0;
  for (const b of existing) {
    const m = new RegExp(`^BATCH-${year}-(\\d+)$`).exec(b);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  let candidate = `BATCH-${year}-${String(max + 1).padStart(4, "0")}`;
  while (existing.includes(candidate)) {
    max += 1;
    candidate = `BATCH-${year}-${String(max + 1).padStart(4, "0")}`;
  }
  return candidate;
}

export function nextOrNumber(existing: string[]): string {
  const year = new Date().getFullYear();
  let max = 0;
  for (const s of existing) {
    const m = new RegExp(`^OR-${year}-(\\d+)$`).exec(s);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `OR-${year}-${String(max + 1).padStart(5, "0")}`;
}

/* ---------------- batches & stock math ---------------- */

/** Batch statuses whose remaining quantity counts toward on-hand stock. */
export const COUNTED_STATUSES = ["active", "expired", "recalled"];

export function countedQty(batches: BatchRow[]): number {
  return batches
    .filter((b) => COUNTED_STATUSES.includes(b.status))
    .reduce((sum, b) => sum + b.qtyRemaining, 0);
}

export function isSellable(b: BatchRow, today = todayStr()): boolean {
  if (b.status !== "active" || b.qtyRemaining <= 0) return false;
  if (b.expiryDate && b.expiryDate < today) return false;
  return true;
}

/** FIFO order: earliest expiry first; batches without expiry go last,
 *  ties broken by receiving date then id. */
export function fifoOrder(a: BatchRow, b: BatchRow): number {
  if (a.expiryDate && b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate);
  if (a.expiryDate) return -1;
  if (b.expiryDate) return 1;
  return a.receivedDate.getTime() - b.receivedDate.getTime() || a.id - b.id;
}

export async function syncItemQty(db: DB, itemId: number): Promise<number> {
  const batches = await db.select().from(t.batches);
  const qty = countedQty(batches.filter((b) => b.itemId === itemId));
  await db
    .update(t.items)
    .set({ quantity: qty, updatedAt: new Date() })
    .where(eq(t.items.id, itemId));
  return qty;
}

export async function createBatch(
  db: DB,
  args: {
    item: ItemRow;
    qty: number;
    costPrice: number;
    expiryDate?: string | null;
    supplierId?: number | null;
    invoiceNo?: string;
    note?: string;
    batchNo?: string;
    area?: string;
    placed?: boolean;
    defectiveQty?: number;
    boxStatus?: string;
    status?: string;
  },
): Promise<BatchRow> {
  const all = await db.select({ batchNo: t.batches.batchNo }).from(t.batches);
  const batchNo = args.batchNo?.trim() || nextBatchNo(all.map((r) => r.batchNo));
  const [row] = await db
    .insert(t.batches)
    .values({
      itemId: args.item.id,
      batchNo,
      qtyReceived: args.qty,
      qtyRemaining: args.qty,
      costPrice: args.costPrice,
      expiryDate: args.expiryDate ?? null,
      receivedDate: new Date(),
      status: args.status ?? "active",
      supplierId: args.supplierId ?? null,
      invoiceNo: args.invoiceNo ?? "",
      note: args.note ?? "",
      area: args.area ?? "",
      placed: args.placed ? 1 : 0,
      defectiveQty: args.defectiveQty ?? 0,
      boxStatus: args.boxStatus ?? "Full",
    })
    .returning();
  return row;
}

/**
 * Deducts `qty` base units from sellable batches in FIFO order.
 * Validates availability first and throws without mutating when short.
 */
export async function deductFIFO(
  db: DB,
  itemId: number,
  qty: number,
): Promise<{ batch: BatchRow; qty: number }[]> {
  const all = await db.select().from(t.batches);
  const sellable = all.filter((b) => b.itemId === itemId && isSellable(b)).sort(fifoOrder);
  const available = sellable.reduce((s, b) => s + b.qtyRemaining, 0);
  if (qty > available) {
    throw new Error(`Insufficient sellable stock: need ${qty}, only ${available} available.`);
  }
  const allocations: { batch: BatchRow; qty: number }[] = [];
  let remaining = qty;
  for (const b of sellable) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, b.qtyRemaining);
    if (take <= 0) continue;
    const newRemaining = b.qtyRemaining - take;
    await db.update(t.batches).set({ qtyRemaining: newRemaining }).where(eq(t.batches.id, b.id));
    allocations.push({ batch: { ...b, qtyRemaining: newRemaining }, qty: take });
    remaining -= take;
  }
  return allocations;
}

/* ---------------- audit & movements ---------------- */

export async function addHistory(
  db: DB,
  e: {
    action: string;
    entityType: string;
    entityId?: number | null;
    description: string;
    actor?: string;
    reference?: string;
  },
): Promise<void> {
  await db.insert(t.history).values({
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId ?? null,
    description: e.description,
    actor: e.actor ?? "",
    reference: e.reference ?? "",
    createdAt: new Date(),
  });
}

export async function addMovement(
  db: DB,
  m: {
    item: ItemRow;
    type: "in" | "out" | "adjust";
    quantity: number;
    balanceAfter: number;
    note?: string;
    batchId?: number | null;
    reference?: string;
    actor?: string;
  },
): Promise<void> {
  await db.insert(t.movements).values({
    itemId: m.item.id,
    itemName: m.item.name,
    itemCode: m.item.code,
    type: m.type,
    quantity: m.quantity,
    balanceAfter: m.balanceAfter,
    note: m.note ?? "",
    batchId: m.batchId ?? null,
    reference: m.reference ?? "",
    actor: m.actor ?? "",
    createdAt: new Date(),
  });
}

/* ---------------- seed & settings ---------------- */

export async function ensureSeed(db: DB): Promise<void> {
  const existingSettings = await db.select().from(t.settings);
  if (existingSettings.length === 0) {
    await db.insert(t.settings).values({
      id: 1,
      storeName: "My Store",
      logoText: "MS",
      primaryColor: "#14532d",
      theme: "system",
      dateFormat: "mdy",
      securityJson: JSON.stringify({
        requireTendered: true,
        allowReturns: true,
        showStockAlerts: true,
      }),
    });
  }
  const staffRows = await db.select().from(t.staff);
  if (staffRows.length === 0) {
    await db.insert(t.staff).values({
      name: "Administrator",
      username: "admin",
      passwordHash: await hashPassword("admin123"),
      email: "",
      role: "Administrator",
      active: 1,
      lastLogin: "",
      createdAt: new Date(),
    });
  }
}

export function defaultSettings(): SettingsDTO {
  return {
    storeName: "My Store",
    phone: "",
    address: "",
    email: "",
    logoText: "MS",
    storeCode: "",
    primaryColor: "#14532d",
    theme: "system",
    dateFormat: "mdy",
    security: { requireTendered: true, allowReturns: true, showStockAlerts: true },
  };
}

export async function loadSettings(db: DB): Promise<SettingsDTO> {
  const rows = await db.select().from(t.settings);
  const r = rows[0];
  if (!r) return defaultSettings();
  const d = defaultSettings();
  let security = d.security;
  try {
    const parsed = JSON.parse(r.securityJson) as Partial<SettingsDTO["security"]>;
    security = {
      requireTendered: parsed.requireTendered ?? true,
      allowReturns: parsed.allowReturns ?? true,
      showStockAlerts: parsed.showStockAlerts ?? true,
    };
  } catch {
    /* keep defaults */
  }
  return {
    storeName: r.storeName,
    phone: r.phone,
    address: r.address,
    email: r.email,
    logoText: r.logoText,
    storeCode: r.storeCode ?? "",
    primaryColor: r.primaryColor,
    theme: r.theme,
    dateFormat: r.dateFormat,
    security,
  };
}

/* ---------------- product assembly ---------------- */

export function toBatchDTO(b: BatchRow): BatchDTO {
  return {
    id: b.id,
    itemId: b.itemId,
    batchNo: b.batchNo,
    qtyReceived: b.qtyReceived,
    qtyRemaining: b.qtyRemaining,
    costPrice: b.costPrice,
    expiryDate: b.expiryDate ?? null,
    receivedDate: b.receivedDate.toISOString(),
    status: b.status,
    supplierId: b.supplierId ?? null,
    invoiceNo: b.invoiceNo,
    note: b.note,
    area: b.area,
    placed: b.placed === 1,
    defectiveQty: b.defectiveQty,
    boxStatus: b.boxStatus,
  };
}

export async function loadProducts(db: DB): Promise<ProductDTO[]> {
  const itemRows = await db.select().from(t.items).orderBy(asc(t.items.name));
  const unitRows = await db.select().from(t.productUnits);
  const batchRows = await db
    .select()
    .from(t.batches)
    .orderBy(desc(t.batches.receivedDate));
  return itemRows.map((i) => {
    const units = unitRows
      .filter((u) => u.itemId === i.id)
      .map((u) => ({
        id: u.id,
        itemId: u.itemId,
        name: u.name,
        conversionFactor: u.conversionFactor,
        sellingPrice: u.sellingPrice,
        barcode: u.barcode,
        isBase: u.isBase === 1,
      }));
    const batches = batchRows.filter((b) => b.itemId === i.id);
    const last = batches.length
      ? batches.reduce((a, b) => (a.receivedDate > b.receivedDate ? a : b))
      : null;
    return {
      id: i.id,
      name: i.name,
      code: i.code,
      category: i.category,
      unit: i.unit,
      costPrice: i.costPrice,
      sellingPrice: i.sellingPrice,
      quantity: i.quantity,
      reorderLevel: i.reorderLevel,
      location: i.location,
      notes: i.notes,
      imageUrl: i.imageUrl,
      supplierId: i.supplierId ?? null,
      barcode: i.barcode,
      productStatus: i.productStatus,
      area: i.area,
      deletedAt: i.deletedAt ? i.deletedAt.toISOString() : null,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      units,
      batches: batches.map(toBatchDTO),
      batchCount: batches.length,
      lastStockedAt: last ? last.receivedDate.toISOString() : null,
    };
  });
}
