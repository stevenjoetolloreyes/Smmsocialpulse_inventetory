"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as t from "@/lib/schema";
import {
  clearSessionCookie,
  hashPassword,
  requireSession,
  setSessionCookie,
  verifyPassword,
  type SessionUser,
} from "@/lib/auth";
import type { ImportRow, SettingsDTO, UnitInput } from "@/lib/types";
import { getStoreData } from "./data";
import {
  addHistory,
  addMovement,
  countedQty,
  createBatch,
  deductFIFO,
  fifoOrder,
  isSellable,
  loadProducts,
  loadSettings,
  nextItemCode,
  nextOrNumber,
  round2,
  syncItemQty,
  COUNTED_STATUSES,
  type BatchRow,
  type ItemRow,
} from "./helpers";

/* ---------------- auth ---------------- */

export type LoginMode = "owner" | "staff";

/** Roles allowed to sign in from the Owner / Main tab. */
const OWNER_ROLES = ["Administrator"];

/**
 * Signs a user in. Two modes mirror the login page tabs:
 * - "owner": identifier is an email OR username; the account must hold an
 *   owner/admin role.
 * - "staff": identifier is a staff username; the account must NOT hold an
 *   owner role. When the store has a store code configured and one is
 *   provided, it must match.
 */
export async function loginAction(
  identifier: string,
  password: string,
  mode: LoginMode = "owner",
  storeCode: string = "",
): Promise<{ user: SessionUser }> {
  const db = await getDb();
  const rows = await db.select().from(t.staff);
  const needle = identifier.trim().toLowerCase();
  const user =
    mode === "owner"
      ? rows.find(
          (s) =>
            s.username.toLowerCase() === needle ||
            (s.email !== "" && s.email.toLowerCase() === needle),
        )
      : rows.find((s) => s.username.toLowerCase() === needle);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new Error(
      mode === "owner"
        ? "Invalid email or username or password."
        : "Invalid username or password.",
    );
  }
  if (user.active !== 1) {
    throw new Error(
      "This account is not active yet. If you just registered, the store owner must activate it in Settings → User Management first.",
    );
  }
  const isOwner = OWNER_ROLES.includes(user.role);
  if (mode === "owner" && !isOwner) {
    throw new Error(
      "This is not an owner account. If you are branch staff, use the Branch Staff tab to sign in.",
    );
  }
  if (mode === "staff" && isOwner) {
    throw new Error("Owner accounts sign in from the Owner / Main tab.");
  }
  if (mode === "staff") {
    const provided = storeCode.trim();
    const settings = await loadSettings(db);
    if (provided && settings.storeCode && provided !== settings.storeCode) {
      throw new Error("That store code does not match this store. Check the code and try again.");
    }
  }
  const nowIso = new Date().toISOString();
  await db.update(t.staff).set({ lastLogin: nowIso }).where(eq(t.staff.id, user.id));
  const session: SessionUser = {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
  };
  await setSessionCookie(session);
  await addHistory(db, {
    action: "Login",
    entityType: "Staff",
    entityId: user.id,
    description: `${user.name} logged in`,
    actor: user.name,
    reference: user.username,
  });
  return { user: session };
}

/**
 * Public self-registration from /register. Always creates an INACTIVE
 * staff account with the plain "Staff" role — the store owner reviews,
 * activates, and may promote it in Settings → User Management. Public
 * registration can never grant an owner/admin account.
 */
export async function registerAction(input: {
  username: string;
  email: string;
  password: string;
}): Promise<{ ok: true }> {
  const db = await getDb();
  const username = input.username.trim();
  const email = input.email.trim();
  if (username.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const all = await db.select().from(t.staff);
  if (all.some((s) => s.username.toLowerCase() === username.toLowerCase())) {
    throw new Error(`Username "${username}" is already taken.`);
  }
  if (all.some((s) => s.email !== "" && s.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("An account with this email already exists.");
  }
  const [row] = await db
    .insert(t.staff)
    .values({
      name: username,
      username,
      email,
      passwordHash: await hashPassword(input.password),
      role: "Staff",
      active: 0,
      lastLogin: "",
      createdAt: new Date(),
    })
    .returning();
  await addHistory(db, {
    action: "Create",
    entityType: "Staff",
    entityId: row.id,
    description: `Account "${username}" registered and is waiting for owner activation`,
    actor: username,
    reference: username,
  });
  return { ok: true as const };
}

/**
 * Public branding for the sign-in / register screens (no session needed):
 * the store name for the card heading, and whether the social sign-in
 * buttons should be shown (only when the owner has configured the
 * matching provider credentials in the environment).
 */
export async function getAuthBranding(): Promise<{
  storeName: string;
  googleEnabled: boolean;
  facebookEnabled: boolean;
}> {
  const db = await getDb();
  const settings = await loadSettings(db);
  return {
    storeName: settings.storeName,
    googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID?.trim()),
    facebookEnabled: Boolean(process.env.FACEBOOK_APP_ID?.trim()),
  };
}

export async function logoutAction(): Promise<{ ok: true }> {
  await clearSessionCookie();
  return { ok: true as const };
}

/* ---------------- data ---------------- */

export async function fetchStoreData() {
  await requireSession();
  const db = await getDb();
  return getStoreData(db);
}

export async function findByCode(code: string) {
  await requireSession();
  const db = await getDb();
  const needle = code.trim().toLowerCase();
  if (!needle) return null;
  const products = await loadProducts(db);
  const live = products.filter((p) => !p.deletedAt);
  let found = live.find(
    (p) => p.code.toLowerCase() === needle || p.barcode.toLowerCase() === needle,
  );
  if (!found) {
    found = live.find((p) => p.units.some((u) => u.barcode !== "" && u.barcode.toLowerCase() === needle));
  }
  if (!found) {
    found = live.find((p) => p.batches.some((b) => b.batchNo.toLowerCase() === needle));
  }
  return found ?? null;
}

export async function suggestItemCode(): Promise<{ code: string }> {
  await requireSession();
  const db = await getDb();
  const rows = await db.select({ code: t.items.code }).from(t.items);
  return { code: nextItemCode(rows.map((r) => r.code)) };
}

/* ---------------- products ---------------- */

export type ProductFormInput = {
  id?: number | null;
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
  expiryDate: string | null;
  extraUnits: UnitInput[];
};

export async function saveProduct(input: ProductFormInput): Promise<{ ok: true; id: number }> {
  const user = await requireSession();
  const db = await getDb();
  const actor = user.name;
  const name = input.name.trim();
  if (!name) throw new Error("Product name is required.");
  const category = input.category.trim() || "General";
  const unitName = input.unit.trim() || "pcs";

  const allItems = await db.select().from(t.items);
  let code = input.code.trim();
  if (!code) code = nextItemCode(allItems.map((i) => i.code));
  const dup = allItems.find((i) => i.code.toLowerCase() === code.toLowerCase());
  if (dup && dup.id !== input.id) {
    throw new Error(`SKU "${code}" is already used by another product.`);
  }

  let row: ItemRow;
  if (input.id) {
    const [updated] = await db
      .update(t.items)
      .set({
        name,
        code,
        category,
        unit: unitName,
        costPrice: input.costPrice,
        sellingPrice: input.sellingPrice,
        reorderLevel: Math.max(0, Math.trunc(input.reorderLevel)),
        location: input.location.trim(),
        notes: input.notes.trim(),
        imageUrl: input.imageUrl.trim(),
        supplierId: input.supplierId,
        barcode: input.barcode.trim(),
        area: input.area.trim(),
        updatedAt: new Date(),
      })
      .where(eq(t.items.id, input.id))
      .returning();
    if (!updated) throw new Error("Product not found.");
    row = updated;
    // Replace the unit set: base unit first, then the extras.
    await db.delete(t.productUnits).where(eq(t.productUnits.itemId, row.id));
  } else {
    const now = new Date();
    const [inserted] = await db
      .insert(t.items)
      .values({
        name,
        code,
        category,
        unit: unitName,
        costPrice: input.costPrice,
        sellingPrice: input.sellingPrice,
        quantity: 0,
        reorderLevel: Math.max(0, Math.trunc(input.reorderLevel)),
        location: input.location.trim(),
        notes: input.notes.trim(),
        imageUrl: input.imageUrl.trim(),
        supplierId: input.supplierId,
        barcode: input.barcode.trim(),
        productStatus: "active",
        area: input.area.trim(),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!inserted) throw new Error("Failed to create product.");
    row = inserted;
  }

  await db.insert(t.productUnits).values({
    itemId: row.id,
    name: unitName,
    conversionFactor: 1,
    sellingPrice: input.sellingPrice,
    barcode: input.barcode.trim(),
    isBase: 1,
  });
  for (const u of input.extraUnits) {
    if (!u.name.trim()) continue;
    await db.insert(t.productUnits).values({
      itemId: row.id,
      name: u.name.trim(),
      conversionFactor: u.conversionFactor > 0 ? u.conversionFactor : 1,
      sellingPrice: Math.max(0, u.sellingPrice),
      barcode: u.barcode.trim(),
      isBase: 0,
    });
  }

  const catRows = await db.select().from(t.categories);
  if (!catRows.some((c) => c.name === category)) {
    await db.insert(t.categories).values({ name: category });
  }

  if (!input.id && input.openingQty > 0) {
    const batch = await createBatch(db, {
      item: row,
      qty: Math.trunc(input.openingQty),
      costPrice: input.costPrice,
      expiryDate: input.expiryDate,
      supplierId: input.supplierId,
      note: "Opening stock",
      area: input.area.trim(),
    });
    const balance = await syncItemQty(db, row.id);
    await addMovement(db, {
      item: row,
      type: "in",
      quantity: Math.trunc(input.openingQty),
      balanceAfter: balance,
      note: "Opening stock",
      batchId: batch.id,
      actor,
    });
  }

  await addHistory(db, {
    action: input.id ? "Update" : "Create",
    entityType: "Product",
    entityId: row.id,
    description: `${input.id ? "Updated" : "Created"} product ${row.name} (${row.code})`,
    actor,
    reference: row.code,
  });
  return { ok: true as const, id: row.id };
}

export async function deleteProduct(id: number): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  const [row] = await db.select().from(t.items).where(eq(t.items.id, id));
  if (row) {
    await db
      .update(t.items)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(t.items.id, id));
    await addHistory(db, {
      action: "Delete",
      entityType: "Product",
      entityId: row.id,
      description: `Deleted product ${row.name} (${row.code})`,
      actor: user.name,
      reference: row.code,
    });
  }
  return { ok: true as const };
}

export async function permanentDeleteProduct(id: number): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  const [row] = await db.select().from(t.items).where(eq(t.items.id, id));
  if (!row) return { ok: true as const };
  // Remove the product's own operational records. Past sale lines keep their
  // stored product name / SKU snapshots, so sales history stays readable.
  const itemBatches = (await db.select().from(t.batches)).filter((b) => b.itemId === id);
  for (const b of itemBatches) {
    await db.delete(t.receivings).where(eq(t.receivings.batchId, b.id));
  }
  await db.delete(t.batches).where(eq(t.batches.itemId, id));
  await db.delete(t.productUnits).where(eq(t.productUnits.itemId, id));
  await db.delete(t.movements).where(eq(t.movements.itemId, id));
  await db.delete(t.items).where(eq(t.items.id, id));
  await addHistory(db, {
    action: "Delete",
    entityType: "Product",
    entityId: row.id,
    description: `Permanently deleted product ${row.name} (${row.code}) and its batches, units and movements`,
    actor: user.name,
    reference: row.code,
  });
  return { ok: true as const };
}

export async function restoreProduct(id: number): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  const [row] = await db.select().from(t.items).where(eq(t.items.id, id));
  if (row) {
    await db
      .update(t.items)
      .set({ deletedAt: null, productStatus: "active", updatedAt: new Date() })
      .where(eq(t.items.id, id));
    await addHistory(db, {
      action: "Restore",
      entityType: "Product",
      entityId: row.id,
      description: `Restored product ${row.name} (${row.code})`,
      actor: user.name,
      reference: row.code,
    });
  }
  return { ok: true as const };
}

export async function setProductStatus(id: number, status: string): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  const [row] = await db.select().from(t.items).where(eq(t.items.id, id));
  if (!row) throw new Error("Product not found.");
  await db
    .update(t.items)
    .set({ productStatus: status, updatedAt: new Date() })
    .where(eq(t.items.id, id));
  await addHistory(db, {
    action: "Update",
    entityType: "Product",
    entityId: row.id,
    description: `Marked product ${row.name} as ${status}`,
    actor: user.name,
    reference: row.code,
  });
  return { ok: true as const };
}

export async function saveCategory(name: string): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required.");
  const rows = await db.select().from(t.categories);
  if (!rows.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
    await db.insert(t.categories).values({ name: trimmed });
    await addHistory(db, {
      action: "Create",
      entityType: "Category",
      description: `Added category ${trimmed}`,
      actor: user.name,
      reference: trimmed,
    });
  }
  return { ok: true as const };
}

/* ---------------- stock movements (Scan view) ---------------- */

export async function recordMovement(input: {
  itemId: number;
  type: "in" | "out" | "adjust";
  quantity: number;
  note: string;
  expiryDate?: string | null;
}): Promise<{ ok: true; balanceAfter: number }> {
  const user = await requireSession();
  const db = await getDb();
  const actor = user.name;
  const [item] = await db.select().from(t.items).where(eq(t.items.id, input.itemId));
  if (!item || item.deletedAt) throw new Error("Product not found.");
  const qty = Math.trunc(input.quantity);
  let delta = 0;
  let batchId: number | null = null;

  if (input.type === "in") {
    if (qty <= 0) throw new Error("Quantity must be greater than zero.");
    const batch = await createBatch(db, {
      item,
      qty,
      costPrice: item.costPrice,
      expiryDate: input.expiryDate ?? null,
      note: input.note.trim() || "Stock in",
      area: item.area,
    });
    batchId = batch.id;
    delta = qty;
  } else if (input.type === "out") {
    if (qty <= 0) throw new Error("Quantity must be greater than zero.");
    const batches = (await db.select().from(t.batches)).filter((b) => b.itemId === item.id);
    const sellable = batches.filter((b) => isSellable(b)).reduce((s, b) => s + b.qtyRemaining, 0);
    if (qty > sellable) {
      throw new Error(`Cannot stock out ${qty} — only ${sellable} ${item.unit} sellable on hand.`);
    }
    const allocs = await deductFIFO(db, item.id, qty);
    batchId = allocs[0]?.batch.id ?? null;
    delta = -qty;
  } else {
    if (qty < 0) throw new Error("Adjusted quantity cannot be negative.");
    const batches = (await db.select().from(t.batches)).filter((b) => b.itemId === item.id);
    const current = countedQty(batches);
    delta = qty - current;
    if (delta > 0) {
      const batch = await createBatch(db, {
        item,
        qty: delta,
        costPrice: item.costPrice,
        note: input.note.trim() || "Adjustment",
        area: item.area,
      });
      batchId = batch.id;
    } else if (delta < 0) {
      let toRemove = -delta;
      const counted = batches
        .filter((b) => COUNTED_STATUSES.includes(b.status) && b.qtyRemaining > 0)
        .sort(fifoOrder);
      for (const b of counted) {
        if (toRemove <= 0) break;
        const take = Math.min(toRemove, b.qtyRemaining);
        await db
          .update(t.batches)
          .set({ qtyRemaining: b.qtyRemaining - take })
          .where(eq(t.batches.id, b.id));
        batchId = b.id;
        toRemove -= take;
      }
    }
  }

  const balanceAfter = await syncItemQty(db, item.id);
  await db.insert(t.movements).values({
    itemId: item.id,
    itemName: item.name,
    itemCode: item.code,
    type: input.type,
    quantity: delta,
    balanceAfter,
    note: input.note.trim(),
    batchId,
    reference: "",
    actor,
    createdAt: new Date(),
  });
  const label = input.type === "in" ? "Stock In" : input.type === "out" ? "Stock Out" : "Adjustment";
  await addHistory(db, {
    action: label,
    entityType: "Product",
    entityId: item.id,
    description: `${label} ${delta >= 0 ? "+" : ""}${delta} ${item.unit} for ${item.name} — balance ${balanceAfter}`,
    actor,
    reference: item.code,
  });
  return { ok: true as const, balanceAfter };
}

/* ---------------- batches ---------------- */

export async function adjustBatch(input: {
  batchId: number;
  newQty: number;
  note: string;
}): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  const [batch] = await db.select().from(t.batches).where(eq(t.batches.id, input.batchId));
  if (!batch) throw new Error("Batch not found.");
  const [item] = await db.select().from(t.items).where(eq(t.items.id, batch.itemId));
  if (!item) throw new Error("Product not found.");
  const newQty = Math.max(0, Math.trunc(input.newQty));
  const delta = newQty - batch.qtyRemaining;
  await db
    .update(t.batches)
    .set({ qtyRemaining: newQty, qtyReceived: Math.max(batch.qtyReceived, newQty) })
    .where(eq(t.batches.id, batch.id));
  const balanceAfter = await syncItemQty(db, item.id);
  if (delta !== 0) {
    await addMovement(db, {
      item,
      type: "adjust",
      quantity: delta,
      balanceAfter,
      note: input.note.trim() || `Adjustment on ${batch.batchNo}`,
      batchId: batch.id,
      actor: user.name,
    });
  }
  await addHistory(db, {
    action: "Adjustment",
    entityType: "Batch",
    entityId: batch.id,
    description: `Adjusted batch ${batch.batchNo} of ${item.name} to ${newQty} ${item.unit}${input.note.trim() ? ` — ${input.note.trim()}` : ""}`,
    actor: user.name,
    reference: batch.batchNo,
  });
  return { ok: true as const };
}

export async function setBatchStatus(
  batchId: number,
  status: "active" | "expired" | "recalled" | "damaged" | "archived",
): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  const [batch] = await db.select().from(t.batches).where(eq(t.batches.id, batchId));
  if (!batch) throw new Error("Batch not found.");
  const [item] = await db.select().from(t.items).where(eq(t.items.id, batch.itemId));
  if (!item) throw new Error("Product not found.");
  const wasCounted = COUNTED_STATUSES.includes(batch.status);
  const willCount = COUNTED_STATUSES.includes(status);
  await db.update(t.batches).set({ status }).where(eq(t.batches.id, batch.id));
  const balanceAfter = await syncItemQty(db, item.id);
  if (wasCounted !== willCount && batch.qtyRemaining !== 0) {
    await addMovement(db, {
      item,
      type: "adjust",
      quantity: willCount ? batch.qtyRemaining : -batch.qtyRemaining,
      balanceAfter,
      note: `Batch ${batch.batchNo} marked ${status}`,
      batchId: batch.id,
      actor: user.name,
    });
  }
  await addHistory(db, {
    action: status === "active" ? "Update" : status[0].toUpperCase() + status.slice(1),
    entityType: "Batch",
    entityId: batch.id,
    description: `Batch ${batch.batchNo} of ${item.name} marked ${status}`,
    actor: user.name,
    reference: batch.batchNo,
  });
  return { ok: true as const };
}

export async function setBatchPlaced(batchId: number, placed: boolean): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  const [batch] = await db.select().from(t.batches).where(eq(t.batches.id, batchId));
  if (!batch) throw new Error("Batch not found.");
  await db
    .update(t.batches)
    .set({ placed: placed ? 1 : 0 })
    .where(eq(t.batches.id, batch.id));
  await addHistory(db, {
    action: "Update",
    entityType: "Batch",
    entityId: batch.id,
    description: `Batch ${batch.batchNo} marked ${placed ? "settled (placed in its area)" : "unsettled"}`,
    actor: user.name,
    reference: batch.batchNo,
  });
  return { ok: true as const };
}

export async function updateBatchDetails(input: {
  batchId: number;
  defectiveQty: number;
  boxStatus: string;
  area: string;
}): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  const [batch] = await db.select().from(t.batches).where(eq(t.batches.id, input.batchId));
  if (!batch) throw new Error("Batch not found.");
  await db
    .update(t.batches)
    .set({
      defectiveQty: Math.max(0, Math.trunc(input.defectiveQty)),
      boxStatus: input.boxStatus === "Partial" ? "Partial" : "Full",
      area: input.area.trim(),
    })
    .where(eq(t.batches.id, batch.id));
  await addHistory(db, {
    action: "Update",
    entityType: "Batch",
    entityId: batch.id,
    description: `Updated batch ${batch.batchNo}: box ${input.boxStatus}, defective ${Math.max(0, Math.trunc(input.defectiveQty))}, area "${input.area.trim()}"`,
    actor: user.name,
    reference: batch.batchNo,
  });
  return { ok: true as const };
}

/* ---------------- receiving & bulk restock ---------------- */

export async function addReceiving(input: {
  itemId: number;
  supplierId: number | null;
  invoiceNo: string;
  qty: number;
  costPrice: number;
  expiryDate: string | null;
  receivedAs: string;
  area: string;
  placed: boolean;
  boxStatus: "Full" | "Partial";
  defectiveQty: number;
}): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  const [item] = await db.select().from(t.items).where(eq(t.items.id, input.itemId));
  if (!item || item.deletedAt) throw new Error("Product not found.");
  const qty = Math.trunc(input.qty);
  if (qty <= 0) throw new Error("Quantity must be greater than zero.");

  const units = (await db.select().from(t.productUnits)).filter((u) => u.itemId === item.id);
  const unit = units.find((u) => u.name === input.receivedAs) ?? units.find((u) => u.isBase === 1);
  const factor = unit?.conversionFactor ?? 1;
  const qtyBase = Math.round(qty * factor);
  const batch = await createBatch(db, {
    item,
    qty: qtyBase,
    costPrice: factor > 0 ? round2(input.costPrice / factor) : input.costPrice,
    expiryDate: input.expiryDate,
    supplierId: input.supplierId,
    invoiceNo: input.invoiceNo.trim(),
    note: "Receiving",
    area: input.area.trim() || item.area,
    placed: input.placed,
    boxStatus: input.boxStatus,
    defectiveQty: Math.max(0, Math.trunc(input.defectiveQty)),
  });
  await db.insert(t.receivings).values({
    batchId: batch.id,
    itemId: item.id,
    supplierId: input.supplierId,
    invoiceNo: input.invoiceNo.trim(),
    qty: qtyBase,
    totalCost: round2(qtyBase * batch.costPrice),
    receivedAs: unit?.name ?? item.unit,
    status: "Released",
    pendingQty: 0,
    createdAt: new Date(),
  });
  const balanceAfter = await syncItemQty(db, item.id);
  await addMovement(db, {
    item,
    type: "in",
    quantity: qtyBase,
    balanceAfter,
    note: input.invoiceNo.trim() ? `Receiving · Invoice ${input.invoiceNo.trim()}` : "Receiving",
    batchId: batch.id,
    reference: input.invoiceNo.trim(),
    actor: user.name,
  });
  await addHistory(db, {
    action: "Restock New Batch",
    entityType: "Batch",
    entityId: batch.id,
    description: `Received ${qtyBase} ${item.unit} of ${item.name} as batch ${batch.batchNo}${input.invoiceNo.trim() ? ` · Invoice ${input.invoiceNo.trim()}` : ""}`,
    actor: user.name,
    reference: batch.batchNo,
  });
  return { ok: true as const };
}

export async function bulkRestock(input: {
  entries: { itemId: number; qty: number; costPrice: number; expiryDate: string | null }[];
  note: string;
}): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  if (input.entries.length === 0) throw new Error("Select at least one product to restock.");
  for (const e of input.entries) {
    const qty = Math.trunc(e.qty);
    if (qty <= 0) continue;
    const [item] = await db.select().from(t.items).where(eq(t.items.id, e.itemId));
    if (!item || item.deletedAt) continue;
    const batch = await createBatch(db, {
      item,
      qty,
      costPrice: Math.max(0, e.costPrice),
      expiryDate: e.expiryDate,
      note: input.note.trim() || "Bulk restock",
      area: item.area,
    });
    const balanceAfter = await syncItemQty(db, item.id);
    await addMovement(db, {
      item,
      type: "in",
      quantity: qty,
      balanceAfter,
      note: input.note.trim() || "Bulk restock",
      batchId: batch.id,
      actor: user.name,
    });
    await addHistory(db, {
      action: "Restock",
      entityType: "Batch",
      entityId: batch.id,
      description: `Bulk restock: +${qty} ${item.unit} of ${item.name} as batch ${batch.batchNo}`,
      actor: user.name,
      reference: batch.batchNo,
    });
  }
  return { ok: true as const };
}

/* ---------------- suppliers ---------------- */

export async function saveSupplier(input: {
  id: number | null;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
}): Promise<{ ok: true; id: number }> {
  const user = await requireSession();
  const db = await getDb();
  const name = input.name.trim();
  if (!name) throw new Error("Supplier name is required.");
  const now = new Date();
  if (input.id) {
    const [row] = await db
      .update(t.suppliers)
      .set({
        name,
        contactPerson: input.contactPerson.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        address: input.address.trim(),
        updatedAt: now,
      })
      .where(eq(t.suppliers.id, input.id))
      .returning();
    if (!row) throw new Error("Supplier not found.");
    await addHistory(db, {
      action: "Update",
      entityType: "Supplier",
      entityId: row.id,
      description: `Updated supplier ${row.name}`,
      actor: user.name,
      reference: row.name,
    });
    return { ok: true as const, id: row.id };
  }
  const [row] = await db
    .insert(t.suppliers)
    .values({
      name,
      contactPerson: input.contactPerson.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      address: input.address.trim(),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) throw new Error("Failed to save supplier.");
  await addHistory(db, {
    action: "Create",
    entityType: "Supplier",
    entityId: row.id,
    description: `Added supplier ${row.name}`,
    actor: user.name,
    reference: row.name,
  });
  return { ok: true as const, id: row.id };
}

export async function deleteSupplier(id: number): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  const [row] = await db.select().from(t.suppliers).where(eq(t.suppliers.id, id));
  if (row) {
    await db.delete(t.suppliers).where(eq(t.suppliers.id, id));
    await addHistory(db, {
      action: "Delete",
      entityType: "Supplier",
      entityId: row.id,
      description: `Deleted supplier ${row.name}`,
      actor: user.name,
      reference: row.name,
    });
  }
  return { ok: true as const };
}

/* ---------------- sales (POS) ---------------- */

export async function completeSale(input: {
  lines: { itemId: number; unitName: string; qty: number }[];
  customerType: "Regular" | "PWD" | "Senior";
  paymentMethod: "Cash" | "GCash";
  amountTendered: number;
}): Promise<{ ok: true; saleId: number }> {
  const user = await requireSession();
  const db = await getDb();
  const actor = user.name;
  if (input.lines.length === 0) throw new Error("The cart is empty.");

  const allItems = await db.select().from(t.items);
  const allUnits = await db.select().from(t.productUnits);
  const allBatches = await db.select().from(t.batches);

  type Prepared = {
    item: ItemRow;
    unitName: string;
    factor: number;
    qtyUnits: number;
    qtyBase: number;
    unitPrice: number;
    lineTotal: number;
  };
  const prepared: Prepared[] = [];
  const requiredByItem = new Map<number, number>();

  // Phase 1: validate the whole cart before mutating anything.
  for (const line of input.lines) {
    const item = allItems.find((i) => i.id === line.itemId);
    if (!item || item.deletedAt) throw new Error("A product in the cart no longer exists.");
    const units = allUnits.filter((u) => u.itemId === item.id);
    const unit = units.find((u) => u.name === line.unitName) ?? units.find((u) => u.isBase === 1);
    if (!unit) throw new Error(`No unit found for ${item.name}.`);
    const qtyUnits = Math.trunc(line.qty);
    if (qtyUnits <= 0) throw new Error(`Invalid quantity for ${item.name}.`);
    const qtyBase = Math.round(qtyUnits * unit.conversionFactor);
    prepared.push({
      item,
      unitName: unit.name,
      factor: unit.conversionFactor,
      qtyUnits,
      qtyBase,
      unitPrice: unit.sellingPrice,
      lineTotal: round2(unit.sellingPrice * qtyUnits),
    });
    requiredByItem.set(item.id, (requiredByItem.get(item.id) ?? 0) + qtyBase);
  }
  for (const [itemId, need] of requiredByItem) {
    const available = allBatches
      .filter((b) => b.itemId === itemId && isSellable(b))
      .reduce((s, b) => s + b.qtyRemaining, 0);
    if (need > available) {
      const p = prepared.find((x) => x.item.id === itemId);
      throw new Error(
        `Not enough sellable stock for ${p?.item.name ?? "an item"}: need ${need}, only ${available} available.`,
      );
    }
  }

  const subtotal = round2(prepared.reduce((s, p) => s + p.lineTotal, 0));
  const discountRate = input.customerType === "Regular" ? 0 : 0.2;
  const discountAmount = round2(subtotal * discountRate);
  const total = round2(subtotal - discountAmount);
  let tendered = round2(input.amountTendered);
  if (input.paymentMethod === "GCash" && tendered <= 0) tendered = total;
  if (input.paymentMethod === "Cash" && tendered < total) {
    throw new Error(`Amount tendered (₱${tendered.toFixed(2)}) is less than the total (₱${total.toFixed(2)}).`);
  }
  const changeDue = round2(Math.max(0, tendered - total));

  const allSales = await db.select({ orNumber: t.sales.orNumber }).from(t.sales);
  const orNumber = nextOrNumber(allSales.map((s) => s.orNumber));
  const [sale] = await db
    .insert(t.sales)
    .values({
      orNumber,
      subtotal,
      discountRate,
      discountAmount,
      total,
      paymentMethod: input.paymentMethod,
      customerType: input.customerType,
      cashier: actor,
      amountTendered: tendered,
      changeDue,
      status: "Completed",
      createdAt: new Date(),
    })
    .returning();
  if (!sale) throw new Error("Failed to save sale.");

  // Phase 2: deduct FIFO per line and record allocations + movements.
  for (const p of prepared) {
    const allocs = await deductFIFO(db, p.item.id, p.qtyBase);
    const balanceAfter = await syncItemQty(db, p.item.id);
    const [si] = await db
      .insert(t.saleItems)
      .values({
        saleId: sale.id,
        itemId: p.item.id,
        productName: p.item.name,
        sku: p.item.code,
        unitName: p.unitName,
        conversionFactor: p.factor,
        qtyUnits: p.qtyUnits,
        qtyBase: p.qtyBase,
        unitPrice: p.unitPrice,
        lineTotal: p.lineTotal,
      })
      .returning();
    if (!si) throw new Error("Failed to save sale item.");
    for (const a of allocs) {
      await db.insert(t.saleAllocations).values({
        saleItemId: si.id,
        batchId: a.batch.id,
        qty: a.qty,
        returnedQty: 0,
      });
    }
    await addMovement(db, {
      item: p.item,
      type: "out",
      quantity: -p.qtyBase,
      balanceAfter,
      note: `Sale ${orNumber}`,
      reference: orNumber,
      actor,
    });
  }

  await addHistory(db, {
    action: "Sale",
    entityType: "Sale",
    entityId: sale.id,
    description: `Sale ${orNumber}: ${prepared.map((p) => `${p.qtyUnits} ${p.unitName} ${p.item.name}`).join(", ")} — total ₱${total.toFixed(2)} via ${input.paymentMethod}`,
    actor,
    reference: orNumber,
  });
  return { ok: true as const, saleId: sale.id };
}

export async function recordReturn(input: {
  saleId: number;
  lines: { saleItemId: number; qtyUnits: number }[];
  note: string;
}): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  const [sale] = await db.select().from(t.sales).where(eq(t.sales.id, input.saleId));
  if (!sale) throw new Error("Sale not found.");
  const allSaleItems = await db.select().from(t.saleItems);
  const allAllocs = await db.select().from(t.saleAllocations);

  // Validate every line before mutating.
  type Prep = { si: (typeof allSaleItems)[number]; qtyBase: number };
  const preps: Prep[] = [];
  for (const line of input.lines) {
    const si = allSaleItems.find((x) => x.id === line.saleItemId);
    if (!si || si.saleId !== sale.id) throw new Error("Sale item not found on this sale.");
    const allocs = allAllocs.filter((a) => a.saleItemId === si.id);
    const alreadyReturned = allocs.reduce((s, a) => s + a.returnedQty, 0);
    const qtyBase = Math.round(Math.trunc(line.qtyUnits) * si.conversionFactor);
    if (qtyBase <= 0) throw new Error("Return quantity must be greater than zero.");
    if (alreadyReturned + qtyBase > si.qtyBase) {
      const returnable = Math.floor((si.qtyBase - alreadyReturned) / si.conversionFactor);
      throw new Error(`Cannot return ${line.qtyUnits} ${si.unitName} of ${si.productName} — only ${returnable} returnable.`);
    }
    preps.push({ si, qtyBase });
  }

  for (const prep of preps) {
    let remaining = prep.qtyBase;
    const allocs = allAllocs.filter((a) => a.saleItemId === prep.si.id);
    for (const a of allocs) {
      if (remaining <= 0) break;
      const capacity = a.qty - a.returnedQty;
      if (capacity <= 0) continue;
      const restore = Math.min(capacity, remaining);
      const [batch] = await db.select().from(t.batches).where(eq(t.batches.id, a.batchId));
      if (batch) {
        await db
          .update(t.batches)
          .set({
            qtyRemaining: batch.qtyRemaining + restore,
            status: batch.status === "archived" ? "active" : batch.status,
          })
          .where(eq(t.batches.id, batch.id));
      }
      await db
        .update(t.saleAllocations)
        .set({ returnedQty: a.returnedQty + restore })
        .where(eq(t.saleAllocations.id, a.id));
      await db.insert(t.saleReturns).values({
        saleId: sale.id,
        saleItemId: prep.si.id,
        batchId: a.batchId,
        qty: restore,
        actor: user.name,
        note: input.note.trim(),
        createdAt: new Date(),
      });
      remaining -= restore;
    }
    const [item] = await db.select().from(t.items).where(eq(t.items.id, prep.si.itemId));
    if (item) {
      const balanceAfter = await syncItemQty(db, item.id);
      await addMovement(db, {
        item,
        type: "in",
        quantity: prep.qtyBase,
        balanceAfter,
        note: `Return · ${sale.orNumber}${input.note.trim() ? ` — ${input.note.trim()}` : ""}`,
        reference: sale.orNumber,
        actor: user.name,
      });
    }
    await addHistory(db, {
      action: "Return",
      entityType: "Sale",
      entityId: sale.id,
      description: `Return on ${sale.orNumber}: ${prep.qtyBase} ${item?.unit ?? ""} of ${prep.si.productName} restored to stock`,
      actor: user.name,
      reference: sale.orNumber,
    });
  }
  await db.update(t.sales).set({ status: "Partially Refunded" }).where(eq(t.sales.id, sale.id));
  return { ok: true as const };
}

/* ---------------- CSV import ---------------- */

export async function importProducts(
  rows: ImportRow[],
): Promise<{ ok: true; imported: number; skipped: number; errors: string[] }> {
  const user = await requireSession();
  const db = await getDb();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    if (!r || !r.productName.trim()) {
      skipped++;
      errors.push(`Row ${idx + 1}: missing product name — skipped.`);
      continue;
    }
    try {
      const allItems = await db.select().from(t.items);
      const code = r.sku.trim();
      let item = code
        ? allItems.find((i) => i.code.toLowerCase() === code.toLowerCase() && !i.deletedAt)
        : undefined;
      if (!item) {
        const finalCode = code || nextItemCode(allItems.map((i) => i.code));
        const now = new Date();
        const [inserted] = await db
          .insert(t.items)
          .values({
            name: r.productName.trim(),
            code: finalCode,
            category: r.category.trim() || "General",
            unit: r.unitType.trim() || "pcs",
            costPrice: Math.max(0, r.costPrice),
            sellingPrice: Math.max(0, r.sellingPrice),
            quantity: 0,
            reorderLevel: Math.max(0, Math.trunc(r.reorderPoint)),
            location: "",
            notes: "",
            imageUrl: "",
            supplierId: null,
            barcode: r.barcode.trim(),
            productStatus: "active",
            area: "",
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (!inserted) throw new Error("insert failed");
        item = inserted;
        await db.insert(t.productUnits).values({
          itemId: item.id,
          name: item.unit,
          conversionFactor: 1,
          sellingPrice: Math.max(0, r.sellingPrice),
          barcode: r.barcode.trim(),
          isBase: 1,
        });
        const cats = await db.select().from(t.categories);
        if (!cats.some((c) => c.name === item!.category)) {
          await db.insert(t.categories).values({ name: item.category });
        }
        await addHistory(db, {
          action: "Create",
          entityType: "Product",
          entityId: item.id,
          description: `Imported product ${item.name} (${item.code})`,
          actor: user.name,
          reference: item.code,
        });
      }
      const qty = Math.trunc(r.qtyOnHand);
      if (qty > 0) {
        const existingNos = (await db.select({ batchNo: t.batches.batchNo }).from(t.batches)).map(
          (x) => x.batchNo,
        );
        const wanted = r.batchNumber.trim();
        const batch = await createBatch(db, {
          item,
          qty,
          costPrice: Math.max(0, r.costPrice),
          expiryDate: r.expiryDate.trim() ? r.expiryDate.trim() : null,
          batchNo: wanted && !existingNos.includes(wanted) ? wanted : undefined,
          note: "Imported opening stock",
        });
        const balanceAfter = await syncItemQty(db, item.id);
        await addMovement(db, {
          item,
          type: "in",
          quantity: qty,
          balanceAfter,
          note: "Imported opening stock",
          batchId: batch.id,
          actor: user.name,
        });
      }
      imported++;
    } catch (e) {
      skipped++;
      errors.push(`Row ${idx + 1} (${r.productName}): ${e instanceof Error ? e.message : "failed"}`);
    }
  }
  return { ok: true as const, imported, skipped, errors };
}

/* ---------------- settings, staff, areas ---------------- */

export async function saveSettings(input: SettingsDTO): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  const values = {
    id: 1,
    storeName: input.storeName.trim() || "My Store",
    phone: input.phone.trim(),
    address: input.address.trim(),
    email: input.email.trim(),
    logoText:
      input.logoText.trim() || (input.storeName.trim().slice(0, 2).toUpperCase() || "MS"),
    storeCode: input.storeCode.trim(),
    primaryColor: input.primaryColor,
    theme: input.theme,
    dateFormat: input.dateFormat,
    securityJson: JSON.stringify(input.security),
  };
  const existing = await db.select().from(t.settings);
  if (existing.length > 0) {
    await db.update(t.settings).set(values).where(eq(t.settings.id, 1));
  } else {
    await db.insert(t.settings).values(values);
  }
  await addHistory(db, {
    action: "Update",
    entityType: "Settings",
    description: `Updated store settings (${values.storeName})`,
    actor: user.name,
    reference: "",
  });
  return { ok: true as const };
}

export async function saveStaff(input: {
  id: number | null;
  name: string;
  username: string;
  password: string;
  email: string;
  role: string;
  active: boolean;
}): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  const username = input.username.trim();
  const all = await db.select().from(t.staff);
  if (
    username &&
    all.some((s) => s.username.toLowerCase() === username.toLowerCase() && s.id !== input.id)
  ) {
    throw new Error(`Username "${username}" is already taken by another user.`);
  }
  if (input.id) {
    const current = all.find((s) => s.id === input.id);
    if (!current) throw new Error("User not found.");
    await db
      .update(t.staff)
      .set({
        name,
        username,
        email: input.email.trim(),
        role: input.role,
        active: input.active ? 1 : 0,
        passwordHash: input.password ? await hashPassword(input.password) : current.passwordHash,
      })
      .where(eq(t.staff.id, input.id));
    await addHistory(db, {
      action: "Update",
      entityType: "Staff",
      entityId: input.id,
      description: `Updated user ${name} (${input.role})${input.password ? " · password changed" : ""}`,
      actor: user.name,
      reference: username || name,
    });
  } else {
    if (!username) throw new Error("Username is required for a new user.");
    if (!input.password) throw new Error("Password is required for a new user.");
    const [row] = await db
      .insert(t.staff)
      .values({
        name,
        username,
        passwordHash: await hashPassword(input.password),
        email: input.email.trim(),
        role: input.role,
        active: input.active ? 1 : 0,
        lastLogin: "",
        createdAt: new Date(),
      })
      .returning();
    await addHistory(db, {
      action: "Create",
      entityType: "Staff",
      entityId: row?.id ?? null,
      description: `Added user ${name} (${input.role})`,
      actor: user.name,
      reference: username,
    });
  }
  return { ok: true as const };
}

export async function saveArea(name: string): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Area name is required.");
  const rows = await db.select().from(t.areas);
  if (!rows.some((a) => a.name.toLowerCase() === trimmed.toLowerCase())) {
    await db.insert(t.areas).values({ name: trimmed });
    await addHistory(db, {
      action: "Create",
      entityType: "Area",
      description: `Added storage area ${trimmed}`,
      actor: user.name,
      reference: trimmed,
    });
  }
  return { ok: true as const };
}

export async function deleteArea(name: string): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  await db.delete(t.areas).where(eq(t.areas.name, name.trim()));
  await addHistory(db, {
    action: "Delete",
    entityType: "Area",
    description: `Removed storage area ${name.trim()}`,
    actor: user.name,
    reference: name.trim(),
  });
  return { ok: true as const };
}
