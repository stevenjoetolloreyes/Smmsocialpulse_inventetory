/** Shared data shapes exchanged between the server and the client UI. */

export type UnitDTO = {
  id: number;
  itemId: number;
  name: string;
  conversionFactor: number;
  sellingPrice: number;
  barcode: string;
  isBase: boolean;
};

export type BatchDTO = {
  id: number;
  itemId: number;
  batchNo: string;
  qtyReceived: number;
  qtyRemaining: number;
  costPrice: number;
  expiryDate: string | null;
  receivedDate: string;
  status: string; // active | expired | recalled | damaged | archived
  supplierId: number | null;
  invoiceNo: string;
  note: string;
  area: string;
  placed: boolean;
  defectiveQty: number;
  boxStatus: string; // Full | Partial
};

export type ProductDTO = {
  id: number;
  name: string;
  code: string;
  category: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  reorderLevel: number;
  location: string;
  notes: string;
  imageUrl: string;
  supplierId: number | null;
  barcode: string;
  productStatus: string;
  area: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  units: UnitDTO[];
  batches: BatchDTO[];
  batchCount: number;
  lastStockedAt: string | null;
};

export type SupplierDTO = {
  id: number;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
  updatedAt: string;
};

export type ReceivingDTO = {
  id: number;
  batchId: number;
  itemId: number;
  itemName: string;
  sku: string;
  supplierId: number | null;
  supplierName: string;
  invoiceNo: string;
  qty: number;
  totalCost: number;
  receivedAs: string;
  status: string;
  pendingQty: number;
  batchNo: string;
  expiryDate: string | null;
  createdAt: string;
};

export type AllocationDTO = {
  id: number;
  batchId: number;
  batchNo: string;
  qty: number;
  returnedQty: number;
};

export type SaleItemDTO = {
  id: number;
  saleId: number;
  itemId: number;
  productName: string;
  sku: string;
  unitName: string;
  conversionFactor: number;
  qtyUnits: number;
  qtyBase: number;
  unitPrice: number;
  lineTotal: number;
  returnedQtyBase: number;
  allocations: AllocationDTO[];
};

export type SaleDTO = {
  id: number;
  orNumber: string;
  subtotal: number;
  discountRate: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  customerType: string;
  cashier: string;
  amountTendered: number;
  changeDue: number;
  status: string;
  createdAt: string;
  items: SaleItemDTO[];
};

export type ReturnDTO = {
  id: number;
  saleId: number;
  orNumber: string;
  saleItemId: number;
  productName: string;
  batchId: number;
  batchNo: string;
  qty: number;
  actor: string;
  note: string;
  createdAt: string;
};

export type MovementDTO = {
  id: number;
  itemId: number;
  itemName: string;
  itemCode: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  note: string;
  batchId: number | null;
  reference: string;
  actor: string;
  createdAt: string;
};

export type HistoryDTO = {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  description: string;
  actor: string;
  reference: string;
  createdAt: string;
};

export type SecuritySettings = {
  requireTendered: boolean;
  allowReturns: boolean;
  showStockAlerts: boolean;
};

export type SettingsDTO = {
  storeName: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  zip: string;
  email: string;
  logoText: string;
  logoData: string; // optional logo image (data URL), set in setup / settings
  storeCode: string;
  primaryColor: string;
  theme: string;
  dateFormat: string; // mdy | dmy | iso
  security: SecuritySettings;
};

export type PlanDTO = {
  id: string; // free | pro | business
  name: string;
  priceMonthly: number;
  /** Yearly term price (monthly × 10 — two months free). */
  priceYearly: number;
  maxUsers: number; // 0 = unlimited
  imageUpload: boolean;
  reportExport: boolean;
};

export type NotificationCategory = "inventory" | "sales" | "billing" | "system";

export type NotificationDTO = {
  id: number;
  category: NotificationCategory;
  title: string;
  body: string;
  /** True when the CURRENT user has read this notification. */
  read: boolean;
  createdAt: string;
};

export type StoreMetaDTO = {
  id: number;
  name: string;
  slug: string;
  planId: string; // the plan on record
  effectivePlanId: string; // after expiry fallback (expired paid plan → free)
  planExpiresAt: string | null;
  setupCompleted: boolean;
  status: string; // active | suspended
};

export type StaffDTO = {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  active: boolean;
  lastLogin: string;
  createdAt: string;
};

export type StoreData = {
  products: ProductDTO[];
  deletedProducts: ProductDTO[];
  suppliers: SupplierDTO[];
  receivings: ReceivingDTO[];
  sales: SaleDTO[];
  returns: ReturnDTO[];
  movements: MovementDTO[];
  history: HistoryDTO[];
  settings: SettingsDTO;
  staff: StaffDTO[];
  categories: string[];
  areas: string[];
  /** The signed-in user's store + its effective plan (multi-store SaaS). */
  store: StoreMetaDTO;
  plan: PlanDTO;
  plans: PlanDTO[];
  /** Latest notifications for the store, read state for the signed-in user. */
  notifications: NotificationDTO[];
  /** Store notifications with no read row for the signed-in user. */
  unreadNotifications: number;
};

export type PlatformStoreDTO = {
  id: number;
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  planId: string;
  planExpiresAt: string | null;
  usersCount: number;
  status: string;
  setupCompleted: boolean;
  createdAt: string;
};

export type FeedbackDTO = {
  id: number;
  storeId: number | null;
  storeName: string;
  staffName: string;
  type: string; // issue | feature | feedback
  message: string;
  createdAt: string;
};

export type PlatformDataDTO = {
  totalStores: number;
  totalUsers: number;
  perPlan: { planId: string; count: number }[];
  stores: PlatformStoreDTO[];
  feedback: FeedbackDTO[];
};

/**
 * Social sign-in configuration as the platform console may see it:
 * client/app IDs and configured flags only — stored secrets are NEVER
 * sent to the client, only whether one exists.
 */
export type SocialConfigDTO = {
  google: { clientId: string; hasSecret: boolean; configured: boolean };
  facebook: { appId: string; hasSecret: boolean; configured: boolean };
  googleRedirectUri: string;
  facebookRedirectUri: string;
};

export type UnitInput = {
  name: string;
  conversionFactor: number;
  sellingPrice: number;
  barcode: string;
};

export type ImportRow = {
  productName: string;
  category: string;
  sku: string;
  reorderPoint: number;
  batchNumber: string;
  qtyOnHand: number;
  costPrice: number;
  expiryDate: string;
  unitType: string;
  sellingPrice: number;
  barcode: string;
};
