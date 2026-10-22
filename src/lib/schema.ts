import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Database schema for the Inventory Management System (multi-store SaaS).
 * One row per product in `items`; physical stock lives in `batches`
 * (FIFO by earliest expiry) and `items.quantity` is always kept in sync
 * with the sum of counted batches (statuses: active / expired / recalled).
 *
 * Tenancy: every tenant table carries `store_id`. All server queries are
 * scoped by the signed-in user's store — the single exception is the
 * platform admin (staff.is_platform_admin = 1, store_id NULL), who manages
 * stores and plans from /admin and never sees store data.
 */

/* ---------------- platform tables ---------------- */

export const stores = sqliteTable("stores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().default("My Store"),
  slug: text("slug").notNull().unique(),
  ownerStaffId: integer("owner_staff_id"),
  planId: text("plan_id").notNull().default("free"),
  planExpiresAt: integer("plan_expires_at", { mode: "timestamp_ms" }),
  setupCompleted: integer("setup_completed").notNull().default(0),
  status: text("status").notNull().default("active"), // active | suspended
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(), // free | pro | business
  name: text("name").notNull(),
  priceMonthly: real("price_monthly").notNull().default(0),
  maxUsers: integer("max_users").notNull().default(2), // 0 = unlimited
  productImageUpload: integer("product_image_upload").notNull().default(0),
  reportExport: integer("report_export").notNull().default(0),
});

export const emailTokens = sqliteTable("email_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffId: integer("staff_id").notNull(),
  type: text("type").notNull(), // verify | reset
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const feedback = sqliteTable("feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storeId: integer("store_id"),
  staffId: integer("staff_id"),
  type: text("type").notNull(), // issue | feature | feedback
  message: text("message").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/* ---------------- tenant tables ---------------- */

export const items = sqliteTable(
  "items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().default(0),
    name: text("name").notNull(),
    code: text("code").notNull(),
    category: text("category").notNull().default("General"),
    unit: text("unit").notNull().default("pcs"),
    costPrice: real("cost_price").notNull().default(0),
    sellingPrice: real("selling_price").notNull().default(0),
    quantity: integer("quantity").notNull().default(0),
    reorderLevel: integer("reorder_level").notNull().default(5),
    location: text("location").notNull().default(""),
    notes: text("notes").notNull().default(""),
    imageUrl: text("image_url").notNull().default(""),
    supplierId: integer("supplier_id"),
    barcode: text("barcode").notNull().default(""),
    productStatus: text("product_status").notNull().default("active"),
    area: text("area").notNull().default(""),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("items_store_code_unique").on(t.storeId, t.code),
    index("items_store_idx").on(t.storeId),
  ],
);

export const movements = sqliteTable(
  "movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().default(0),
    itemId: integer("item_id").notNull(),
    itemName: text("item_name").notNull(),
    itemCode: text("item_code").notNull(),
    type: text("type", { enum: ["in", "out", "adjust"] }).notNull(),
    quantity: integer("quantity").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    note: text("note").notNull().default(""),
    batchId: integer("batch_id"),
    reference: text("reference").notNull().default(""),
    actor: text("actor").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("movements_store_idx").on(t.storeId)],
);

export const productUnits = sqliteTable(
  "product_units",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().default(0),
    itemId: integer("item_id").notNull(),
    name: text("name").notNull(),
    conversionFactor: real("conversion_factor").notNull().default(1),
    sellingPrice: real("selling_price").notNull().default(0),
    barcode: text("barcode").notNull().default(""),
    isBase: integer("is_base").notNull().default(0),
  },
  (t) => [index("product_units_store_idx").on(t.storeId)],
);

export const batches = sqliteTable(
  "batches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().default(0),
    itemId: integer("item_id").notNull(),
    batchNo: text("batch_no").notNull(),
    qtyReceived: integer("qty_received").notNull().default(0),
    qtyRemaining: integer("qty_remaining").notNull().default(0),
    costPrice: real("cost_price").notNull().default(0),
    expiryDate: text("expiry_date"),
    receivedDate: integer("received_date", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    status: text("status").notNull().default("active"),
    supplierId: integer("supplier_id"),
    invoiceNo: text("invoice_no").notNull().default(""),
    note: text("note").notNull().default(""),
    area: text("area").notNull().default(""),
    placed: integer("placed").notNull().default(0),
    defectiveQty: integer("defective_qty").notNull().default(0),
    boxStatus: text("box_status").notNull().default("Full"),
  },
  (t) => [index("batches_store_idx").on(t.storeId)],
);

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().default(0),
    name: text("name").notNull(),
    contactPerson: text("contact_person").notNull().default(""),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("suppliers_store_idx").on(t.storeId)],
);

export const receivings = sqliteTable(
  "receivings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().default(0),
    batchId: integer("batch_id").notNull(),
    itemId: integer("item_id").notNull(),
    supplierId: integer("supplier_id"),
    invoiceNo: text("invoice_no").notNull().default(""),
    qty: integer("qty").notNull().default(0),
    totalCost: real("total_cost").notNull().default(0),
    receivedAs: text("received_as").notNull().default(""),
    status: text("status").notNull().default("Released"),
    pendingQty: integer("pending_qty").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("receivings_store_idx").on(t.storeId)],
);

export const sales = sqliteTable(
  "sales",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().default(0),
    orNumber: text("or_number").notNull(),
    subtotal: real("subtotal").notNull().default(0),
    discountRate: real("discount_rate").notNull().default(0),
    discountAmount: real("discount_amount").notNull().default(0),
    total: real("total").notNull().default(0),
    paymentMethod: text("payment_method").notNull().default("Cash"),
    customerType: text("customer_type").notNull().default("Regular"),
    cashier: text("cashier").notNull().default(""),
    amountTendered: real("amount_tendered").notNull().default(0),
    changeDue: real("change_due").notNull().default(0),
    status: text("status").notNull().default("Completed"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("sales_store_or_unique").on(t.storeId, t.orNumber),
    index("sales_store_idx").on(t.storeId),
  ],
);

export const saleItems = sqliteTable(
  "sale_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().default(0),
    saleId: integer("sale_id").notNull(),
    itemId: integer("item_id").notNull(),
    productName: text("product_name").notNull(),
    sku: text("sku").notNull(),
    unitName: text("unit_name").notNull(),
    conversionFactor: real("conversion_factor").notNull().default(1),
    qtyUnits: integer("qty_units").notNull().default(0),
    qtyBase: integer("qty_base").notNull().default(0),
    unitPrice: real("unit_price").notNull().default(0),
    lineTotal: real("line_total").notNull().default(0),
  },
  (t) => [index("sale_items_store_idx").on(t.storeId)],
);

export const saleAllocations = sqliteTable(
  "sale_allocations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().default(0),
    saleItemId: integer("sale_item_id").notNull(),
    batchId: integer("batch_id").notNull(),
    qty: integer("qty").notNull().default(0),
    returnedQty: integer("returned_qty").notNull().default(0),
  },
  (t) => [index("sale_allocations_store_idx").on(t.storeId)],
);

export const saleReturns = sqliteTable(
  "returns",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().default(0),
    saleId: integer("sale_id").notNull(),
    saleItemId: integer("sale_item_id").notNull(),
    batchId: integer("batch_id").notNull(),
    qty: integer("qty").notNull().default(0),
    actor: text("actor").notNull().default(""),
    note: text("note").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("returns_store_idx").on(t.storeId)],
);

export const history = sqliteTable(
  "history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().default(0),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull().default(""),
    entityId: integer("entity_id"),
    description: text("description").notNull().default(""),
    actor: text("actor").notNull().default(""),
    reference: text("reference").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("history_store_idx").on(t.storeId)],
);

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().default(0),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("categories_store_name_unique").on(t.storeId, t.name)],
);

export const areas = sqliteTable(
  "areas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().default(0),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("areas_store_name_unique").on(t.storeId, t.name)],
);

export const settings = sqliteTable(
  "settings",
  {
    id: integer("id").primaryKey(),
    storeId: integer("store_id").notNull().default(0),
    storeName: text("store_name").notNull().default("My Store"),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    city: text("city").notNull().default(""),
    province: text("province").notNull().default(""),
    zip: text("zip").notNull().default(""),
    email: text("email").notNull().default(""),
    logoText: text("logo_text").notNull().default("MS"),
    logoData: text("logo_data").notNull().default(""),
    storeCode: text("store_code").notNull().default(""),
    primaryColor: text("primary_color").notNull().default("#14532d"),
    theme: text("theme").notNull().default("system"),
    dateFormat: text("date_format").notNull().default("mdy"),
    securityJson: text("security_json").notNull().default("{}"),
  },
  (t) => [uniqueIndex("settings_store_unique").on(t.storeId)],
);

export const staff = sqliteTable(
  "staff",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // NULL only for the platform admin; every store user belongs to a store.
    storeId: integer("store_id"),
    name: text("name").notNull(),
    username: text("username").notNull().default(""),
    passwordHash: text("password_hash").notNull().default(""),
    email: text("email").notNull().default(""),
    role: text("role").notNull().default("Cashier"),
    active: integer("active").notNull().default(1),
    emailVerified: integer("email_verified").notNull().default(0),
    isPlatformAdmin: integer("is_platform_admin").notNull().default(0),
    lastLogin: text("last_login").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("staff_store_idx").on(t.storeId)],
);
