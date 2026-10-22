import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Database schema for the Inventory Management System.
 * One row per product in `items`; physical stock lives in `batches`
 * (FIFO by earliest expiry) and `items.quantity` is always kept in sync
 * with the sum of counted batches (statuses: active / expired / recalled).
 */

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
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
});

export const movements = sqliteTable("movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
});

export const productUnits = sqliteTable("product_units", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemId: integer("item_id").notNull(),
  name: text("name").notNull(),
  conversionFactor: real("conversion_factor").notNull().default(1),
  sellingPrice: real("selling_price").notNull().default(0),
  barcode: text("barcode").notNull().default(""),
  isBase: integer("is_base").notNull().default(0),
});

export const batches = sqliteTable("batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
});

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
});

export const receivings = sqliteTable("receivings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
});

export const sales = sqliteTable("sales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orNumber: text("or_number").notNull().unique(),
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
});

export const saleItems = sqliteTable("sale_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
});

export const saleAllocations = sqliteTable("sale_allocations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleItemId: integer("sale_item_id").notNull(),
  batchId: integer("batch_id").notNull(),
  qty: integer("qty").notNull().default(0),
  returnedQty: integer("returned_qty").notNull().default(0),
});

export const saleReturns = sqliteTable("returns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleId: integer("sale_id").notNull(),
  saleItemId: integer("sale_item_id").notNull(),
  batchId: integer("batch_id").notNull(),
  qty: integer("qty").notNull().default(0),
  actor: text("actor").notNull().default(""),
  note: text("note").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const history = sqliteTable("history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull().default(""),
  entityId: integer("entity_id"),
  description: text("description").notNull().default(""),
  actor: text("actor").notNull().default(""),
  reference: text("reference").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const areas = sqliteTable("areas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  storeName: text("store_name").notNull().default("My Store"),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  email: text("email").notNull().default(""),
  logoText: text("logo_text").notNull().default("MS"),
  storeCode: text("store_code").notNull().default(""),
  primaryColor: text("primary_color").notNull().default("#14532d"),
  theme: text("theme").notNull().default("system"),
  dateFormat: text("date_format").notNull().default("mdy"),
  securityJson: text("security_json").notNull().default("{}"),
});

export const staff = sqliteTable("staff", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  username: text("username").notNull().default(""),
  passwordHash: text("password_hash").notNull().default(""),
  email: text("email").notNull().default(""),
  role: text("role").notNull().default("Cashier"),
  active: integer("active").notNull().default(1),
  lastLogin: text("last_login").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
