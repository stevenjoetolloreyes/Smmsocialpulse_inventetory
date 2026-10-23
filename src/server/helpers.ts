import { createHash, randomBytes } from "node:crypto";
import { asc, desc, eq } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as t from "@/lib/schema";
import { hashPassword } from "@/lib/auth";
import { appBaseUrl } from "@/lib/mail";
import type { BatchDTO, PlanDTO, ProductDTO, SettingsDTO, StoreMetaDTO } from "@/lib/types";

export type ItemRow = typeof t.items.$inferSelect;
export type BatchRow = typeof t.batches.$inferSelect;
export type StoreRow = typeof t.stores.$inferSelect;
export type StaffRow = typeof t.staff.$inferSelect;
export type PlanRow = typeof t.plans.$inferSelect;

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Local "today" as YYYY-MM-DD in the store's timezone (Asia/Manila). */
export function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

/* ---------------- code generators (always fed store-scoped rows) -------- */

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

/** URL-safe unique slug for a store name (uniqueness checked by caller). */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "store";
}

/* ---------------- stores & plans ---------------- */

export async function loadStore(db: DB, storeId: number): Promise<StoreRow | null> {
  const [row] = await db.select().from(t.stores).where(eq(t.stores.id, storeId));
  return row ?? null;
}

export async function loadPlans(db: DB): Promise<PlanRow[]> {
  const rows = await db.select().from(t.plans);
  const order = ["free", "pro", "business"];
  return rows.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

export function toPlanDTO(p: PlanRow): PlanDTO {
  return {
    id: p.id,
    name: p.name,
    priceMonthly: p.priceMonthly,
    priceYearly: p.priceYearly,
    maxUsers: p.maxUsers,
    imageUpload: p.productImageUpload === 1,
    reportExport: p.reportExport === 1,
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "October 28, 2026"-style long date for server-generated messages. */
export function fmtDateLong(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * The plan that actually governs a store right now: an expired paid plan
 * behaves as Free until the platform owner renews it.
 */
export function effectivePlanId(store: StoreRow): string {
  if (store.planId !== "free" && store.planExpiresAt && store.planExpiresAt.getTime() < Date.now()) {
    return "free";
  }
  return store.planId;
}

export async function loadEffectivePlan(db: DB, store: StoreRow): Promise<PlanDTO> {
  const plans = await loadPlans(db);
  const eff = effectivePlanId(store);
  const row = plans.find((p) => p.id === eff) ?? plans.find((p) => p.id === "free");
  if (!row) throw new Error("Subscription plans are not configured.");
  return toPlanDTO(row);
}

export function toStoreMeta(store: StoreRow): StoreMetaDTO {
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    planId: store.planId,
    effectivePlanId: effectivePlanId(store),
    planExpiresAt: store.planExpiresAt ? store.planExpiresAt.toISOString() : null,
    setupCompleted: store.setupCompleted === 1,
    status: store.status,
  };
}

/** Throws a clear plan message when the store's plan blocks a feature. */
export function requirePlanFeature(plan: PlanDTO, feature: "imageUpload" | "reportExport"): void {
  if (feature === "imageUpload" && !plan.imageUpload) {
    throw new Error(
      `Product image upload is not included in the ${plan.name} plan. Ask the platform owner to upgrade your store to Pro or Business to use product images.`,
    );
  }
  if (feature === "reportExport" && !plan.reportExport) {
    throw new Error(
      `Report export is not included in the ${plan.name} plan. Ask the platform owner to upgrade your store to Pro or Business to export reports.`,
    );
  }
}

/** Number of ACTIVE users in a store (the count plans limit). */
export async function countActiveUsers(db: DB, storeId: number): Promise<number> {
  const all = await db.select().from(t.staff).where(eq(t.staff.storeId, storeId));
  return all.filter((s) => s.active === 1).length;
}

/**
 * Throws a clear plan message when activating one more user would exceed
 * the store plan's max_users (0 = unlimited). `excludeStaffId` is the user
 * being edited, so re-saving an already-active user never trips the gate.
 */
export async function assertUserCapacity(
  db: DB,
  storeId: number,
  plan: PlanDTO,
  excludeStaffId?: number | null,
): Promise<void> {
  if (plan.maxUsers <= 0) return;
  const rows = await db.select().from(t.staff).where(eq(t.staff.storeId, storeId));
  const activeCount = rows.filter((s) => s.active === 1 && s.id !== excludeStaffId).length;
  if (activeCount >= plan.maxUsers) {
    throw new Error(
      `Your ${plan.name} plan allows up to ${plan.maxUsers} active user${plan.maxUsers === 1 ? "" : "s"} and this store already has ${activeCount}. Ask the platform owner to upgrade your plan to add more users.`,
    );
  }
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
  const batches = await db.select().from(t.batches).where(eq(t.batches.itemId, itemId));
  const qty = countedQty(batches);
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
  const storeId = args.item.storeId;
  const siblings = await db
    .select({ batchNo: t.batches.batchNo })
    .from(t.batches)
    .where(eq(t.batches.storeId, storeId));
  const batchNo = args.batchNo?.trim() || nextBatchNo(siblings.map((r) => r.batchNo));
  const [row] = await db
    .insert(t.batches)
    .values({
      storeId,
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
  const all = await db.select().from(t.batches).where(eq(t.batches.itemId, itemId));
  const sellable = all.filter((b) => isSellable(b)).sort(fifoOrder);
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
  storeId: number,
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
    storeId,
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
    storeId: m.item.storeId,
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

/* ---------------- scoped row fetchers ----------------
 * Every fetch verifies the row belongs to the caller's store — a row id
 * from another store is indistinguishable from a missing row. */

export async function getStoreItem(db: DB, storeId: number, id: number): Promise<ItemRow | null> {
  const [row] = await db.select().from(t.items).where(eq(t.items.id, id));
  return row && row.storeId === storeId ? row : null;
}

export async function getStoreBatch(db: DB, storeId: number, id: number): Promise<BatchRow | null> {
  const [row] = await db.select().from(t.batches).where(eq(t.batches.id, id));
  return row && row.storeId === storeId ? row : null;
}

/* ---------------- email tokens ---------------- */

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a single-use email token (only its SHA-256 hash is stored) and
 * returns the raw token plus the ready-to-open link for the given type.
 */
export async function createEmailToken(
  db: DB,
  staffId: number,
  type: "verify" | "reset",
): Promise<{ token: string; url: string }> {
  const token = randomBytes(32).toString("hex");
  const ttlMs = type === "verify" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  await db.insert(t.emailTokens).values({
    staffId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMs),
    usedAt: null,
    createdAt: new Date(),
  });
  const path = type === "verify" ? "/auth/verify" : "/reset-password";
  return { token, url: `${appBaseUrl()}${path}?token=${token}` };
}

/**
 * Validates a raw token without consuming it. Returns the token row's
 * staff id when the token exists, matches the type, is unused and fresh.
 */
export async function peekEmailToken(
  db: DB,
  token: string,
  type: "verify" | "reset",
): Promise<number | null> {
  if (!token) return null;
  const rows = await db
    .select()
    .from(t.emailTokens)
    .where(eq(t.emailTokens.tokenHash, hashToken(token)));
  const row = rows.find((r) => r.type === type);
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
  return row.staffId;
}

/** Marks a token used (single-use enforcement lives here). */
export async function consumeEmailToken(db: DB, token: string): Promise<void> {
  await db
    .update(t.emailTokens)
    .set({ usedAt: new Date() })
    .where(eq(t.emailTokens.tokenHash, hashToken(token)));
}

/* ---------------- seed & settings ---------------- */

const DEFAULT_PLANS: PlanRow[] = [
  { id: "free", name: "Free", priceMonthly: 0, priceYearly: 0, maxUsers: 2, productImageUpload: 0, reportExport: 0 },
  { id: "pro", name: "Pro", priceMonthly: 499, priceYearly: 4990, maxUsers: 10, productImageUpload: 1, reportExport: 1 },
  { id: "business", name: "Business", priceMonthly: 1999, priceYearly: 19990, maxUsers: 0, productImageUpload: 1, reportExport: 1 },
];

export async function ensureSeed(db: DB): Promise<void> {
  // Plans (seeded by the migration too — this keeps pre-migration and
  // hand-repaired databases consistent).
  const planRows = await db.select().from(t.plans);
  if (planRows.length === 0) {
    for (const p of DEFAULT_PLANS) await db.insert(t.plans).values(p);
  }

  // The legacy store (migration 0002 creates it on existing databases;
  // on a brand-new database the migration inserts it as well — this is
  // the belt-and-braces path for stores table existing but empty).
  let storeRows = await db.select().from(t.stores);
  if (storeRows.length === 0) {
    const [settingsRow] = await db.select().from(t.settings);
    await db.insert(t.stores).values({
      name: settingsRow?.storeName || "My Store",
      slug: "main",
      ownerStaffId: null,
      planId: "free",
      planExpiresAt: null,
      setupCompleted: 1,
      status: "active",
      createdAt: new Date(),
    });
    storeRows = await db.select().from(t.stores);
  }
  const legacyStore = storeRows.find((s) => s.slug === "main") ?? storeRows[0];

  // Per-store settings row for the legacy store (id mirrors the store id).
  const settingsRows = await db
    .select()
    .from(t.settings)
    .where(eq(t.settings.storeId, legacyStore.id));
  if (settingsRows.length === 0) {
    await db.insert(t.settings).values({
      id: legacyStore.id,
      storeId: legacyStore.id,
      storeName: legacyStore.name || "My Store",
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

  // Store codes are mandatory (staff sign-in requires one): backfill any
  // settings row that still has none — legacy and older test stores get
  // theirs here, on first boot after this change.
  const allSettingsRows = await db.select().from(t.settings);
  for (const row of allSettingsRows) {
    if (!(row.storeCode ?? "").trim()) {
      await db
        .update(t.settings)
        .set({ storeCode: await generateStoreCode(db) })
        .where(eq(t.settings.storeId, row.storeId));
    }
  }

  // Platform admin seed (fresh installs only): admin / admin123.
  const staffRows = await db.select().from(t.staff);
  if (staffRows.length === 0) {
    const [admin] = await db
      .insert(t.staff)
      .values({
        storeId: null,
        name: "Administrator",
        username: "admin",
        passwordHash: await hashPassword("admin123"),
        email: "",
        role: "Administrator",
        active: 1,
        emailVerified: 1,
        isPlatformAdmin: 1,
        lastLogin: "",
        createdAt: new Date(),
      })
      .returning();
    if (admin && legacyStore.ownerStaffId == null) {
      await db
        .update(t.stores)
        .set({ ownerStaffId: admin.id })
        .where(eq(t.stores.id, legacyStore.id));
    }
  }
}

export function defaultSettings(): SettingsDTO {
  return {
    storeName: "My Store",
    phone: "",
    address: "",
    city: "",
    province: "",
    zip: "",
    email: "",
    logoText: "MS",
    logoData: "",
    storeCode: "",
    primaryColor: "#14532d",
    theme: "system",
    dateFormat: "mdy",
    security: { requireTendered: true, allowReturns: true, showStockAlerts: true },
  };
}

/* ---------------- store codes (staff sign-in gate) ---------------- */

/** Unambiguous uppercase alphabet (no 0/O, 1/I/L) for generated codes. */
const STORE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Generates a fresh "STR-XXXXXX" store code, unique across every store's
 * settings row. Retries on collision.
 */
export async function generateStoreCode(db: DB): Promise<string> {
  const rows = await db.select({ storeCode: t.settings.storeCode }).from(t.settings);
  const used = new Set(
    rows.map((r) => (r.storeCode ?? "").trim()).filter((c) => c !== ""),
  );
  for (let attempt = 0; attempt < 100; attempt++) {
    const bytes = randomBytes(6);
    let suffix = "";
    for (let i = 0; i < 6; i++) {
      suffix += STORE_CODE_ALPHABET[bytes[i] % STORE_CODE_ALPHABET.length];
    }
    const code = `STR-${suffix}`;
    if (!used.has(code)) return code;
  }
  throw new Error("Could not generate a unique store code. Please try again.");
}

/**
 * Every store must ALWAYS have a store code: staff sign-in requires it.
 * Returns the store's existing code, or generates + persists one when the
 * settings row has none (or does not exist yet).
 */
export async function ensureStoreCode(db: DB, storeId: number): Promise<string> {
  const rows = await db.select().from(t.settings).where(eq(t.settings.storeId, storeId));
  const row = rows[0];
  const existing = (row?.storeCode ?? "").trim();
  if (existing) return existing;
  const code = await generateStoreCode(db);
  if (row) {
    await db
      .update(t.settings)
      .set({ storeCode: code })
      .where(eq(t.settings.storeId, storeId));
  } else {
    await db.insert(t.settings).values({ id: storeId, storeId, storeCode: code });
  }
  return code;
}

export async function loadSettings(db: DB, storeId: number): Promise<SettingsDTO> {
  // Self-healing: a store loaded for a session always ends up with a code.
  const storeCode = await ensureStoreCode(db, storeId);
  const rows = await db.select().from(t.settings).where(eq(t.settings.storeId, storeId));
  const r = rows[0];
  if (!r) return { ...defaultSettings(), storeCode };
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
    city: r.city ?? "",
    province: r.province ?? "",
    zip: r.zip ?? "",
    email: r.email,
    logoText: r.logoText,
    logoData: r.logoData ?? "",
    storeCode,
    primaryColor: r.primaryColor,
    theme: r.theme,
    dateFormat: r.dateFormat,
    security,
  };
}

/** Creates the per-store settings row for a freshly registered store. */
export async function createStoreSettings(
  db: DB,
  storeId: number,
  storeName: string,
): Promise<void> {
  await db.insert(t.settings).values({
    id: storeId,
    storeId,
    storeName,
    storeCode: await generateStoreCode(db),
    logoText: storeName.slice(0, 2).toUpperCase() || "MS",
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

export async function loadProducts(db: DB, storeId: number): Promise<ProductDTO[]> {
  const itemRows = await db
    .select()
    .from(t.items)
    .where(eq(t.items.storeId, storeId))
    .orderBy(asc(t.items.name));
  const unitRows = await db
    .select()
    .from(t.productUnits)
    .where(eq(t.productUnits.storeId, storeId));
  const batchRows = await db
    .select()
    .from(t.batches)
    .where(eq(t.batches.storeId, storeId))
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
