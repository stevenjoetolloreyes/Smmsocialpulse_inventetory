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
  email: string;
  logoText: string;
  primaryColor: string;
  theme: string;
  dateFormat: string; // mdy | dmy | iso
  security: SecuritySettings;
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
