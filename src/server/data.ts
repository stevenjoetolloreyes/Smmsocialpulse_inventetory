import { asc, desc, eq } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as t from "@/lib/schema";
import type { StoreData } from "@/lib/types";
import {
  loadEffectivePlan,
  loadPlans,
  loadProducts,
  loadSettings,
  loadStore,
  toPlanDTO,
  toStoreMeta,
} from "./helpers";

/** Loads everything one store's client UI needs in one snapshot. */
export async function getStoreData(db: DB, storeId: number): Promise<StoreData> {
  const allProducts = await loadProducts(db, storeId);
  const products = allProducts.filter((p) => !p.deletedAt);
  const deletedProducts = allProducts.filter((p) => p.deletedAt);

  const supplierRows = await db
    .select()
    .from(t.suppliers)
    .where(eq(t.suppliers.storeId, storeId))
    .orderBy(asc(t.suppliers.name));
  const suppliers = supplierRows.map((s) => ({
    id: s.id,
    name: s.name,
    contactPerson: s.contactPerson,
    email: s.email,
    phone: s.phone,
    address: s.address,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  const productById = new Map(allProducts.map((p) => [p.id, p]));
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const batchById = new Map(
    allProducts.flatMap((p) => p.batches.map((b) => [b.id, b] as const)),
  );

  const recRows = await db
    .select()
    .from(t.receivings)
    .where(eq(t.receivings.storeId, storeId))
    .orderBy(desc(t.receivings.id));
  const receivings = recRows.map((r) => {
    const batch = batchById.get(r.batchId);
    // Display status is derived from how much of the batch is still on hand.
    const status = !batch
      ? r.status
      : batch.qtyRemaining > 0 && batch.qtyRemaining < batch.qtyReceived
        ? "Partial"
        : "Released";
    return {
      id: r.id,
      batchId: r.batchId,
      itemId: r.itemId,
      itemName: productById.get(r.itemId)?.name ?? "Unknown product",
      sku: productById.get(r.itemId)?.code ?? "",
      supplierId: r.supplierId ?? null,
      supplierName: r.supplierId ? (supplierById.get(r.supplierId)?.name ?? "") : "",
      invoiceNo: r.invoiceNo,
      qty: r.qty,
      totalCost: r.totalCost,
      receivedAs: r.receivedAs,
      status,
      pendingQty: batch ? batch.qtyReceived - batch.qtyRemaining : r.pendingQty,
      batchNo: batch?.batchNo ?? "",
      expiryDate: batch?.expiryDate ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  });

  const saleRows = await db
    .select()
    .from(t.sales)
    .where(eq(t.sales.storeId, storeId))
    .orderBy(desc(t.sales.id));
  const saleItemRows = await db
    .select()
    .from(t.saleItems)
    .where(eq(t.saleItems.storeId, storeId));
  const allocRows = await db
    .select()
    .from(t.saleAllocations)
    .where(eq(t.saleAllocations.storeId, storeId));
  const sales = saleRows.map((s) => ({
    id: s.id,
    orNumber: s.orNumber,
    subtotal: s.subtotal,
    discountRate: s.discountRate,
    discountAmount: s.discountAmount,
    total: s.total,
    paymentMethod: s.paymentMethod,
    customerType: s.customerType,
    cashier: s.cashier,
    amountTendered: s.amountTendered,
    changeDue: s.changeDue,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    items: saleItemRows
      .filter((si) => si.saleId === s.id)
      .map((si) => {
        const allocs = allocRows.filter((a) => a.saleItemId === si.id);
        return {
          id: si.id,
          saleId: si.saleId,
          itemId: si.itemId,
          productName: si.productName,
          sku: si.sku,
          unitName: si.unitName,
          conversionFactor: si.conversionFactor,
          qtyUnits: si.qtyUnits,
          qtyBase: si.qtyBase,
          unitPrice: si.unitPrice,
          lineTotal: si.lineTotal,
          returnedQtyBase: allocs.reduce((sum, a) => sum + a.returnedQty, 0),
          allocations: allocs.map((a) => ({
            id: a.id,
            batchId: a.batchId,
            batchNo: batchById.get(a.batchId)?.batchNo ?? "",
            qty: a.qty,
            returnedQty: a.returnedQty,
          })),
        };
      }),
  }));

  const saleById = new Map(sales.map((s) => [s.id, s]));
  const saleItemById = new Map(sales.flatMap((s) => s.items.map((i) => [i.id, i] as const)));
  const returnRows = await db
    .select()
    .from(t.saleReturns)
    .where(eq(t.saleReturns.storeId, storeId))
    .orderBy(desc(t.saleReturns.id));
  const returns = returnRows.map((r) => ({
    id: r.id,
    saleId: r.saleId,
    orNumber: saleById.get(r.saleId)?.orNumber ?? "",
    saleItemId: r.saleItemId,
    productName: saleItemById.get(r.saleItemId)?.productName ?? "",
    batchId: r.batchId,
    batchNo: batchById.get(r.batchId)?.batchNo ?? "",
    qty: r.qty,
    actor: r.actor,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }));

  const movementRows = await db
    .select()
    .from(t.movements)
    .where(eq(t.movements.storeId, storeId))
    .orderBy(desc(t.movements.id))
    .limit(500);
  const movements = movementRows.map((m) => ({
    id: m.id,
    itemId: m.itemId,
    itemName: m.itemName,
    itemCode: m.itemCode,
    type: m.type,
    quantity: m.quantity,
    balanceAfter: m.balanceAfter,
    note: m.note,
    batchId: m.batchId ?? null,
    reference: m.reference,
    actor: m.actor,
    createdAt: m.createdAt.toISOString(),
  }));

  const histRows = await db
    .select()
    .from(t.history)
    .where(eq(t.history.storeId, storeId))
    .orderBy(desc(t.history.id))
    .limit(1000);
  const history = histRows.map((h) => ({
    id: h.id,
    action: h.action,
    entityType: h.entityType,
    entityId: h.entityId ?? null,
    description: h.description,
    actor: h.actor,
    reference: h.reference,
    createdAt: h.createdAt.toISOString(),
  }));

  const settings = await loadSettings(db, storeId);

  const staffRows = await db
    .select()
    .from(t.staff)
    .where(eq(t.staff.storeId, storeId))
    .orderBy(asc(t.staff.name));
  const staffList = staffRows.map((s) => ({
    id: s.id,
    name: s.name,
    username: s.username,
    email: s.email,
    role: s.role,
    active: s.active === 1,
    lastLogin: s.lastLogin,
    createdAt: s.createdAt.toISOString(),
  }));

  const catSet = new Set<string>();
  for (const c of await db.select().from(t.categories).where(eq(t.categories.storeId, storeId))) {
    catSet.add(c.name);
  }
  for (const p of allProducts) if (p.category) catSet.add(p.category);

  const areaSet = new Set<string>();
  for (const a of await db.select().from(t.areas).where(eq(t.areas.storeId, storeId))) {
    areaSet.add(a.name);
  }
  for (const p of allProducts) if (p.area) areaSet.add(p.area);
  for (const b of allProducts.flatMap((p) => p.batches)) if (b.area) areaSet.add(b.area);

  const store = await loadStore(db, storeId);
  if (!store) throw new Error("Store not found.");
  const plan = await loadEffectivePlan(db, store);
  const plans = (await loadPlans(db)).map(toPlanDTO);

  return {
    products,
    deletedProducts,
    suppliers,
    receivings,
    sales,
    returns,
    movements,
    history,
    settings,
    staff: staffList,
    categories: Array.from(catSet).sort(),
    areas: Array.from(areaSet).sort(),
    store: toStoreMeta(store),
    plan,
    plans,
  };
}
