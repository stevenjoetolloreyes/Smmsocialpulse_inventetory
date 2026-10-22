"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as t from "@/lib/schema";
import {
  clearSessionCookie,
  hashPassword,
  requirePlatformAdmin,
  requireSession,
  requireStoreSession,
  setSessionCookie,
  verifyPassword,
  type SessionUser,
} from "@/lib/auth";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/mail";
import { csvEscape } from "@/lib/format";
import type {
  ImportRow,
  PlatformDataDTO,
  SettingsDTO,
  UnitInput,
} from "@/lib/types";
import { getStoreData } from "./data";
import {
  addHistory,
  addMovement,
  assertUserCapacity,
  consumeEmailToken,
  countedQty,
  createBatch,
  createEmailToken,
  createStoreSettings,
  deductFIFO,
  fifoOrder,
  getStoreBatch,
  getStoreItem,
  isSellable,
  loadEffectivePlan,
  loadPlans,
  loadProducts,
  loadStore,
  nextItemCode,
  nextOrNumber,
  peekEmailToken,
  requirePlanFeature,
  round2,
  slugify,
  syncItemQty,
  COUNTED_STATUSES,
  type BatchRow,
  type ItemRow,
  type StaffRow,
  type StoreRow,
} from "./helpers";

/* ---------------- auth ---------------- */

export type LoginMode = "owner" | "staff";

/** Roles allowed to sign in from the Owner / Main tab. */
const OWNER_ROLES = ["Administrator"];

const VERIFY_EMAIL_MESSAGE =
  "Please verify your email address before signing in. Check your inbox for the verification link.";

const USERNAME_LINK_MESSAGE =
  "Username cannot be a link or contain slashes — use letters, numbers, _ . - only.";
const USERNAME_CHARS = /^[A-Za-z0-9_.-]+$/;

/**
 * Username hygiene, applied everywhere a username is created or edited
 * (public registration and User Management): 3–30 characters of letters,
 * numbers, underscore, dot or hyphen only — never a link or URL, so a
 * pasted address can never become someone's username (and end up in
 * greetings like the setup wizard's "Hi <username>").
 */
function assertValidUsername(username: string): void {
  const lower = username.toLowerCase();
  if (
    !USERNAME_CHARS.test(username) ||
    username.includes("/") ||
    username.includes(":") ||
    lower.startsWith("www.") ||
    lower.startsWith("http")
  ) {
    throw new Error(USERNAME_LINK_MESSAGE);
  }
  if (username.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }
  if (username.length > 30) {
    throw new Error("Username must be at most 30 characters.");
  }
}

/**
 * Signs a user in. Two modes mirror the login page tabs:
 * - "owner": identifier is an email OR username; the account must hold an
 *   owner/admin role. Platform admin accounts are refused here — their
 *   only sign-in is the dedicated /admin page. Owner usernames/emails
 *   are unique platform-wide.
 * - "staff": identifier is a staff username, unique within its store.
 *   The Store Code identifies which store: it is matched against each
 *   store's own settings.store_code. Without a code, the username must
 *   resolve to exactly one account across stores.
 *
 * Unverified accounts (self-registered owners) are blocked until their
 * email is verified; suspended stores cannot sign in at all.
 */
export async function loginAction(
  identifier: string,
  password: string,
  mode: LoginMode = "owner",
  storeCode: string = "",
  rememberMe: boolean = false,
): Promise<{ user: SessionUser }> {
  const db = await getDb();
  const rows = await db.select().from(t.staff);
  const needle = identifier.trim().toLowerCase();

  let candidates: StaffRow[] = [];
  if (mode === "owner") {
    candidates = rows.filter(
      (s) =>
        s.username.toLowerCase() === needle ||
        (s.email !== "" && s.email.toLowerCase() === needle),
    );
  } else {
    const code = storeCode.trim();
    if (code) {
      const settingsRows = await db.select().from(t.settings);
      const match = settingsRows.find((s) => s.storeCode !== "" && s.storeCode === code);
      if (!match) {
        throw new Error("No store matches that store code. Check the code and try again.");
      }
      candidates = rows.filter(
        (s) => s.storeId === match.storeId && s.username.toLowerCase() === needle,
      );
    } else {
      candidates = rows.filter((s) => s.username.toLowerCase() === needle);
    }
  }

  let user: StaffRow | null = null;
  const matched: StaffRow[] = [];
  for (const c of candidates) {
    if (await verifyPassword(password, c.passwordHash)) matched.push(c);
  }
  if (matched.length > 1 && mode === "staff" && !storeCode.trim()) {
    throw new Error(
      "That username exists in more than one store. Enter your store code so we know which store to sign you into.",
    );
  }
  user = matched[0] ?? null;
  if (!user) {
    throw new Error(
      mode === "owner"
        ? "Invalid email or username or password."
        : "Invalid username or password.",
    );
  }

  const isPlatformAdmin = user.isPlatformAdmin === 1;
  if (isPlatformAdmin) {
    // The platform admin's only door is the dedicated /admin sign-in.
    // The store login never mints a session for this account.
    throw new Error(
      "This is the platform admin account. Please sign in at the Admin page instead.",
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
  if (user.emailVerified !== 1) {
    throw new Error(VERIFY_EMAIL_MESSAGE);
  }
  if (user.active !== 1) {
    throw new Error(
      "This account is not active. Ask your store owner to activate it in Settings → User Management.",
    );
  }

  let store: StoreRow | null = null;
  if (user.storeId != null) {
    store = await loadStore(db, user.storeId);
    if (!store) throw new Error("The store for this account no longer exists.");
    if (store.status === "suspended") {
      throw new Error(
        "This store has been suspended. Please contact the platform owner for help.",
      );
    }
  }

  const nowIso = new Date().toISOString();
  await db.update(t.staff).set({ lastLogin: nowIso }).where(eq(t.staff.id, user.id));
  const session: SessionUser = {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    storeId: user.storeId ?? null,
    isPlatformAdmin,
  };
  await setSessionCookie(session, rememberMe);
  if (user.storeId != null) {
    await addHistory(db, user.storeId, {
      action: "Login",
      entityType: "Staff",
      entityId: user.id,
      description: `${user.name} logged in`,
      actor: user.name,
      reference: user.username,
    });
  }
  return { user: session };
}

/**
 * Signs in at the dedicated platform-admin door (/admin). Only platform
 * admin accounts (is_platform_admin = 1) may pass: a store owner or staff
 * account is rejected even when its password is correct, so the admin
 * area never mixes with store accounts. Reuses the same session cookie
 * machinery as the store sign-in.
 */
export async function adminLoginAction(
  username: string,
  password: string,
): Promise<{ user: SessionUser }> {
  const db = await getDb();
  const needle = username.trim().toLowerCase();
  const rows = await db.select().from(t.staff);
  const candidates = rows.filter((s) => s.username.toLowerCase() === needle);

  const matched: StaffRow[] = [];
  for (const c of candidates) {
    if (await verifyPassword(password, c.passwordHash)) matched.push(c);
  }
  if (matched.length === 0) {
    throw new Error("Invalid username or password.");
  }
  const user = matched.find((s) => s.isPlatformAdmin === 1) ?? null;
  if (!user) {
    throw new Error("This account is not a platform admin.");
  }
  if (user.emailVerified !== 1) {
    throw new Error(VERIFY_EMAIL_MESSAGE);
  }
  if (user.active !== 1) {
    throw new Error("This account is not active.");
  }

  const nowIso = new Date().toISOString();
  await db.update(t.staff).set({ lastLogin: nowIso }).where(eq(t.staff.id, user.id));
  const session: SessionUser = {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    storeId: null,
    isPlatformAdmin: true,
  };
  await setSessionCookie(session, false);
  return { user: session };
}

/**
 * Public self-registration from /register (multi-store SaaS): creates a
 * NEW store (Free plan, setup not yet completed) plus its OWNER account
 * (role "Administrator", inactive + unverified). The owner activates the
 * account by clicking the emailed verification link; when no mailer is
 * configured the link is returned for on-screen display (setup mode).
 */
export async function registerAction(input: {
  storeName: string;
  username: string;
  email: string;
  password: string;
}): Promise<{ ok: true; emailSent: boolean; verifyUrl: string | null }> {
  const db = await getDb();
  const storeName = input.storeName.trim();
  const username = input.username.trim();
  const email = input.email.trim();
  if (storeName.length < 2) {
    throw new Error("Enter your store name (at least 2 characters).");
  }
  assertValidUsername(username);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const allStaff = await db.select().from(t.staff);
  // Owner usernames and emails are unique platform-wide.
  if (allStaff.some((s) => s.username.toLowerCase() === username.toLowerCase())) {
    throw new Error(`Username "${username}" is already taken.`);
  }
  if (allStaff.some((s) => s.email !== "" && s.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("An account with this email already exists.");
  }

  const existingStores = await db.select().from(t.stores);
  let slug = slugify(storeName);
  if (existingStores.some((s) => s.slug === slug)) {
    let n = 2;
    while (existingStores.some((s) => s.slug === `${slug}-${n}`)) n++;
    slug = `${slug}-${n}`;
  }

  const [store] = await db
    .insert(t.stores)
    .values({
      name: storeName,
      slug,
      ownerStaffId: null,
      planId: "free",
      planExpiresAt: null,
      setupCompleted: 0,
      status: "active",
      createdAt: new Date(),
    })
    .returning();
  if (!store) throw new Error("Failed to create the store.");

  const [owner] = await db
    .insert(t.staff)
    .values({
      storeId: store.id,
      name: username,
      username,
      email,
      passwordHash: await hashPassword(input.password),
      role: "Administrator",
      active: 0,
      emailVerified: 0,
      isPlatformAdmin: 0,
      lastLogin: "",
      createdAt: new Date(),
    })
    .returning();
  if (!owner) throw new Error("Failed to create the owner account.");
  await db.update(t.stores).set({ ownerStaffId: owner.id }).where(eq(t.stores.id, store.id));
  await createStoreSettings(db, store.id, storeName);
  await addHistory(db, store.id, {
    action: "Create",
    entityType: "Store",
    entityId: store.id,
    description: `Store "${storeName}" registered by ${username} — waiting for email verification`,
    actor: username,
    reference: slug,
  });

  const { url } = await createEmailToken(db, owner.id, "verify");
  const sent = await sendVerificationEmail(email, url);
  return { ok: true as const, emailSent: sent, verifyUrl: sent ? null : url };
}

/** Re-issues a verification email for an unverified account (login page). */
export async function resendVerificationAction(
  identifier: string,
): Promise<{ ok: true; emailSent: boolean; verifyUrl: string | null }> {
  const db = await getDb();
  const needle = identifier.trim().toLowerCase();
  if (!needle) throw new Error("Enter your email or username first.");
  const rows = await db.select().from(t.staff);
  const user = rows.find(
    (s) =>
      s.emailVerified !== 1 &&
      s.email !== "" &&
      (s.username.toLowerCase() === needle || s.email.toLowerCase() === needle),
  );
  if (!user) {
    throw new Error("No unverified account matches that email or username.");
  }
  const { url } = await createEmailToken(db, user.id, "verify");
  const sent = await sendVerificationEmail(user.email, url);
  return { ok: true as const, emailSent: sent, verifyUrl: sent ? null : url };
}

/** Starts the forgot-password flow for the account holding `email`. */
export async function requestPasswordResetAction(
  email: string,
): Promise<{ ok: true; emailSent: boolean; resetUrl: string | null }> {
  const db = await getDb();
  const needle = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(needle)) {
    throw new Error("Enter a valid email address.");
  }
  const rows = await db.select().from(t.staff);
  const matches = rows.filter((s) => s.email !== "" && s.email.toLowerCase() === needle);
  if (matches.length === 0) {
    throw new Error("No account uses that email address.");
  }
  // Prefer the owner account when several store accounts share an email.
  const target = matches.find((s) => OWNER_ROLES.includes(s.role)) ?? matches[0];
  const { url } = await createEmailToken(db, target.id, "reset");
  const sent = await sendPasswordResetEmail(target.email, url);
  return { ok: true as const, emailSent: sent, resetUrl: sent ? null : url };
}

/** Completes a password reset: token is single-use with a 1-hour expiry. */
export async function resetPasswordAction(
  token: string,
  newPassword: string,
): Promise<{ ok: true }> {
  const db = await getDb();
  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const staffId = await peekEmailToken(db, token, "reset");
  if (staffId == null) {
    throw new Error("This reset link is invalid or has expired. Request a new one.");
  }
  await db
    .update(t.staff)
    .set({ passwordHash: await hashPassword(newPassword), emailVerified: 1 })
    .where(eq(t.staff.id, staffId));
  await consumeEmailToken(db, token);
  return { ok: true as const };
}

/**
 * Public branding for the sign-in / register screens (no session needed):
 * whether the social sign-in buttons should be shown (only when the
 * platform operator configured the matching provider credentials). The
 * heading is generic now that many stores share one platform.
 */
export async function getAuthBranding(): Promise<{
  storeName: string;
  googleEnabled: boolean;
  facebookEnabled: boolean;
}> {
  return {
    storeName: "",
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
  const { storeId } = await requireStoreSession();
  const db = await getDb();
  return getStoreData(db, storeId);
}

export async function findByCode(code: string) {
  const { storeId } = await requireStoreSession();
  const db = await getDb();
  const needle = code.trim().toLowerCase();
  if (!needle) return null;
  const products = await loadProducts(db, storeId);
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
  const { storeId } = await requireStoreSession();
  const db = await getDb();
  const rows = await db
    .select({ code: t.items.code })
    .from(t.items)
    .where(eq(t.items.storeId, storeId));
  return { code: nextItemCode(rows.map((r) => r.code)) };
}

/* ---------------- feedback (floating help button) ---------------- */

export async function submitFeedbackAction(
  type: string,
  message: string,
): Promise<{ ok: true }> {
  const user = await requireSession();
  const db = await getDb();
  const kind = ["issue", "feature", "feedback"].includes(type) ? type : "feedback";
  const text = message.trim();
  if (!text) throw new Error("Write a message first.");
  if (text.length > 2000) throw new Error("Message is too long (max 2,000 characters).");
  await db.insert(t.feedback).values({
    storeId: user.storeId ?? null,
    staffId: user.id,
    type: kind,
    message: text,
    createdAt: new Date(),
  });
  return { ok: true as const };
}

/* ---------------- store setup wizard ---------------- */

export async function completeStoreSetup(input: {
  storeName: string;
  address: string;
  city: string;
  province: string;
  zip: string;
  phone: string;
  logoData: string;
}): Promise<{ ok: true }> {
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const store = await loadStore(db, storeId);
  if (!store) throw new Error("Store not found.");
  if (store.setupCompleted === 1) return { ok: true as const };

  const storeName = input.storeName.trim();
  const address = input.address.trim();
  const city = input.city.trim();
  const province = input.province.trim();
  const zip = input.zip.trim();
  if (!storeName) throw new Error("Store name is required.");
  if (!address) throw new Error("Store address is required.");
  if (!city) throw new Error("City is required.");
  if (!province) throw new Error("Province is required.");
  if (!zip) throw new Error("ZIP code is required.");
  const logoData = input.logoData.trim();
  if (logoData) {
    if (!logoData.startsWith("data:image/")) {
      throw new Error("The store logo must be an image file or an image URL.");
    }
    // ~200 KB of image data once base64 padding is accounted for.
    if (logoData.length > 280_000) {
      throw new Error("The store logo image is too large — keep it under about 200 KB.");
    }
  }

  await db
    .update(t.settings)
    .set({
      storeName,
      address,
      city,
      province,
      zip,
      phone: input.phone.trim(),
      ...(logoData ? { logoData } : {}),
      logoText: storeName.slice(0, 2).toUpperCase() || "MS",
    })
    .where(eq(t.settings.storeId, storeId));
  await db
    .update(t.stores)
    .set({ name: storeName, setupCompleted: 1 })
    .where(eq(t.stores.id, storeId));
  await addHistory(db, storeId, {
    action: "Setup",
    entityType: "Store",
    entityId: storeId,
    description: `Store setup completed for ${storeName} (${address}, ${city}, ${province} ${zip})`,
    actor: user.name,
    reference: store.slug,
  });
  return { ok: true as const };
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

/** The session store + its effective plan, for plan-gated actions. */
async function storeAndPlan(storeId: number) {
  const db = await getDb();
  const store = await loadStore(db, storeId);
  if (!store) throw new Error("Store not found.");
  const plan = await loadEffectivePlan(db, store);
  return { db, store, plan };
}

export async function saveProduct(input: ProductFormInput): Promise<{ ok: true; id: number }> {
  const { user, storeId } = await requireStoreSession();
  const { db, plan } = await storeAndPlan(storeId);
  const actor = user.name;
  const name = input.name.trim();
  if (!name) throw new Error("Product name is required.");
  const category = input.category.trim() || "General";
  const unitName = input.unit.trim() || "pcs";

  const existing = input.id ? await getStoreItem(db, storeId, input.id) : null;
  if (input.id && !existing) throw new Error("Product not found.");

  // Plan gate: a NEW product image requires the image-upload feature.
  // (Keeping an image that is already saved is not a new upload.)
  const imageUrl = input.imageUrl.trim();
  if (imageUrl && imageUrl !== (existing?.imageUrl ?? "")) {
    requirePlanFeature(plan, "imageUpload");
  }

  const allItems = await db.select().from(t.items).where(eq(t.items.storeId, storeId));
  let code = input.code.trim();
  if (!code) code = nextItemCode(allItems.map((i) => i.code));
  const dup = allItems.find((i) => i.code.toLowerCase() === code.toLowerCase());
  if (dup && dup.id !== input.id) {
    throw new Error(`SKU "${code}" is already used by another product.`);
  }
  if (input.supplierId != null) {
    const sup = await db.select().from(t.suppliers).where(eq(t.suppliers.id, input.supplierId));
    if (!sup[0] || sup[0].storeId !== storeId) throw new Error("Supplier not found.");
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
        imageUrl,
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
        storeId,
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
        imageUrl,
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
    storeId,
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
      storeId,
      itemId: row.id,
      name: u.name.trim(),
      conversionFactor: u.conversionFactor > 0 ? u.conversionFactor : 1,
      sellingPrice: Math.max(0, u.sellingPrice),
      barcode: u.barcode.trim(),
      isBase: 0,
    });
  }

  const catRows = await db.select().from(t.categories).where(eq(t.categories.storeId, storeId));
  if (!catRows.some((c) => c.name === category)) {
    await db.insert(t.categories).values({ storeId, name: category });
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

  await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const row = await getStoreItem(db, storeId, id);
  if (row) {
    await db
      .update(t.items)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(t.items.id, id));
    await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const row = await getStoreItem(db, storeId, id);
  if (!row) return { ok: true as const };
  // Remove the product's own operational records. Past sale lines keep their
  // stored product name / SKU snapshots, so sales history stays readable.
  const itemBatches = (await db.select().from(t.batches).where(eq(t.batches.storeId, storeId))).filter((b) => b.itemId === id);
  for (const b of itemBatches) {
    await db.delete(t.receivings).where(eq(t.receivings.batchId, b.id));
  }
  await db.delete(t.batches).where(eq(t.batches.itemId, id));
  await db.delete(t.productUnits).where(eq(t.productUnits.itemId, id));
  await db.delete(t.movements).where(eq(t.movements.itemId, id));
  await db.delete(t.items).where(eq(t.items.id, id));
  await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const row = await getStoreItem(db, storeId, id);
  if (row) {
    await db
      .update(t.items)
      .set({ deletedAt: null, productStatus: "active", updatedAt: new Date() })
      .where(eq(t.items.id, id));
    await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const row = await getStoreItem(db, storeId, id);
  if (!row) throw new Error("Product not found.");
  await db
    .update(t.items)
    .set({ productStatus: status, updatedAt: new Date() })
    .where(eq(t.items.id, id));
  await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required.");
  const rows = await db.select().from(t.categories).where(eq(t.categories.storeId, storeId));
  if (!rows.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
    await db.insert(t.categories).values({ storeId, name: trimmed });
    await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const actor = user.name;
  const item = await getStoreItem(db, storeId, input.itemId);
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
    const batches = (await db.select().from(t.batches).where(eq(t.batches.itemId, item.id)));
    const sellable = batches.filter((b) => isSellable(b)).reduce((s, b) => s + b.qtyRemaining, 0);
    if (qty > sellable) {
      throw new Error(`Cannot stock out ${qty} — only ${sellable} ${item.unit} sellable on hand.`);
    }
    const allocs = await deductFIFO(db, item.id, qty);
    batchId = allocs[0]?.batch.id ?? null;
    delta = -qty;
  } else {
    if (qty < 0) throw new Error("Adjusted quantity cannot be negative.");
    const batches = await db.select().from(t.batches).where(eq(t.batches.itemId, item.id));
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
    storeId,
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
  await addHistory(db, storeId, {
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

async function batchAndItem(db: Awaited<ReturnType<typeof getDb>>, storeId: number, batchId: number) {
  const batch = await getStoreBatch(db, storeId, batchId);
  if (!batch) throw new Error("Batch not found.");
  const item = await getStoreItem(db, storeId, batch.itemId);
  if (!item) throw new Error("Product not found.");
  return { batch, item };
}

export async function adjustBatch(input: {
  batchId: number;
  newQty: number;
  note: string;
}): Promise<{ ok: true }> {
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const { batch, item } = await batchAndItem(db, storeId, input.batchId);
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
  await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const { batch, item } = await batchAndItem(db, storeId, batchId);
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
  await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const { batch } = await batchAndItem(db, storeId, batchId);
  await db
    .update(t.batches)
    .set({ placed: placed ? 1 : 0 })
    .where(eq(t.batches.id, batch.id));
  await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const { batch } = await batchAndItem(db, storeId, input.batchId);
  await db
    .update(t.batches)
    .set({
      defectiveQty: Math.max(0, Math.trunc(input.defectiveQty)),
      boxStatus: input.boxStatus === "Partial" ? "Partial" : "Full",
      area: input.area.trim(),
    })
    .where(eq(t.batches.id, batch.id));
  await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const item = await getStoreItem(db, storeId, input.itemId);
  if (!item || item.deletedAt) throw new Error("Product not found.");
  if (input.supplierId != null) {
    const sup = await db.select().from(t.suppliers).where(eq(t.suppliers.id, input.supplierId));
    if (!sup[0] || sup[0].storeId !== storeId) throw new Error("Supplier not found.");
  }
  const qty = Math.trunc(input.qty);
  if (qty <= 0) throw new Error("Quantity must be greater than zero.");

  const units = (await db.select().from(t.productUnits).where(eq(t.productUnits.storeId, storeId))).filter((u) => u.itemId === item.id);
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
    storeId,
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
  await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  if (input.entries.length === 0) throw new Error("Select at least one product to restock.");
  for (const e of input.entries) {
    const qty = Math.trunc(e.qty);
    if (qty <= 0) continue;
    const item = await getStoreItem(db, storeId, e.itemId);
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
    await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const name = input.name.trim();
  if (!name) throw new Error("Supplier name is required.");
  const now = new Date();
  if (input.id) {
    const [existing] = await db.select().from(t.suppliers).where(eq(t.suppliers.id, input.id));
    if (!existing || existing.storeId !== storeId) throw new Error("Supplier not found.");
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
    await addHistory(db, storeId, {
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
      storeId,
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
  await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const [row] = await db.select().from(t.suppliers).where(eq(t.suppliers.id, id));
  if (row && row.storeId === storeId) {
    await db.delete(t.suppliers).where(eq(t.suppliers.id, id));
    await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const actor = user.name;
  if (input.lines.length === 0) throw new Error("The cart is empty.");

  const allItems = await db.select().from(t.items).where(eq(t.items.storeId, storeId));
  const allUnits = await db.select().from(t.productUnits).where(eq(t.productUnits.storeId, storeId));
  const allBatches = await db.select().from(t.batches).where(eq(t.batches.storeId, storeId));

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

  // OR numbers are sequenced per store.
  const storeSales = await db
    .select({ orNumber: t.sales.orNumber })
    .from(t.sales)
    .where(eq(t.sales.storeId, storeId));
  const orNumber = nextOrNumber(storeSales.map((s) => s.orNumber));
  const [sale] = await db
    .insert(t.sales)
    .values({
      storeId,
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
        storeId,
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
        storeId,
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

  await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const [sale] = await db.select().from(t.sales).where(eq(t.sales.id, input.saleId));
  if (!sale || sale.storeId !== storeId) throw new Error("Sale not found.");
  const allSaleItems = await db.select().from(t.saleItems).where(eq(t.saleItems.storeId, storeId));
  const allAllocs = await db.select().from(t.saleAllocations).where(eq(t.saleAllocations.storeId, storeId));

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
      const batch = await getStoreBatch(db, storeId, a.batchId);
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
        storeId,
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
    const item = await getStoreItem(db, storeId, prep.si.itemId);
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
    await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
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
      const allItems = await db.select().from(t.items).where(eq(t.items.storeId, storeId));
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
            storeId,
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
          storeId,
          itemId: item.id,
          name: item.unit,
          conversionFactor: 1,
          sellingPrice: Math.max(0, r.sellingPrice),
          barcode: r.barcode.trim(),
          isBase: 1,
        });
        const cats = await db.select().from(t.categories).where(eq(t.categories.storeId, storeId));
        if (!cats.some((c) => c.name === item!.category)) {
          await db.insert(t.categories).values({ storeId, name: item.category });
        }
        await addHistory(db, storeId, {
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
        const existingNos = (
          await db.select({ batchNo: t.batches.batchNo }).from(t.batches).where(eq(t.batches.storeId, storeId))
        ).map((x) => x.batchNo);
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

/* ---------------- report export (plan-gated, server-side) ---------------- */

/**
 * Builds the Inventory Report CSV on the server. Report export is a paid
 * plan feature, so the gate is enforced here — not just by hiding the
 * button in the UI.
 */
export async function exportInventoryReportCsvAction(): Promise<{ ok: true; csv: string }> {
  const { storeId } = await requireStoreSession();
  const { db, plan } = await storeAndPlan(storeId);
  requirePlanFeature(plan, "reportExport");
  const products = (await loadProducts(db, storeId)).filter((p) => !p.deletedAt);
  const header = ["Product", "SKU", "Category", "Status", "Qty On Hand", "Unit", "Cost Price", "Selling Price", "Stock Value (Cost)", "Reorder Level", "Batches", "Nearest Expiry"];
  const lines = products.map((p) => {
    const expiries = p.batches
      .filter((b) => b.expiryDate && b.qtyRemaining > 0)
      .map((b) => b.expiryDate!)
      .sort();
    return [
      p.name,
      p.code,
      p.category,
      p.productStatus,
      p.quantity,
      p.unit,
      p.costPrice.toFixed(2),
      p.sellingPrice.toFixed(2),
      (p.quantity * p.costPrice).toFixed(2),
      p.reorderLevel,
      p.batchCount,
      expiries[0] ?? "",
    ]
      .map(csvEscape)
      .join(",");
  });
  return { ok: true as const, csv: [header.join(","), ...lines].join("\n") };
}

/* ---------------- settings, staff, areas ---------------- */

export async function saveSettings(input: SettingsDTO): Promise<{ ok: true }> {
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const logoData = (input.logoData ?? "").trim();
  if (logoData && (!logoData.startsWith("data:image/") || logoData.length > 280_000)) {
    throw new Error("The store logo must be an image under about 200 KB.");
  }
  const values = {
    storeName: input.storeName.trim() || "My Store",
    phone: input.phone.trim(),
    address: input.address.trim(),
    city: (input.city ?? "").trim(),
    province: (input.province ?? "").trim(),
    zip: (input.zip ?? "").trim(),
    email: input.email.trim(),
    logoText:
      input.logoText.trim() || (input.storeName.trim().slice(0, 2).toUpperCase() || "MS"),
    logoData,
    storeCode: input.storeCode.trim(),
    primaryColor: input.primaryColor,
    theme: input.theme,
    dateFormat: input.dateFormat,
    securityJson: JSON.stringify(input.security),
  };
  const existing = await db.select().from(t.settings).where(eq(t.settings.storeId, storeId));
  if (existing.length > 0) {
    await db.update(t.settings).set(values).where(eq(t.settings.storeId, storeId));
  } else {
    await db.insert(t.settings).values({ id: storeId, storeId, ...values });
  }
  // Keep the store record's display name in sync with its settings.
  await db.update(t.stores).set({ name: values.storeName }).where(eq(t.stores.id, storeId));
  await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const { db, plan } = await storeAndPlan(storeId);
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  const username = input.username.trim();
  if (username) assertValidUsername(username);
  const email = input.email.trim();
  const storeStaff = await db.select().from(t.staff).where(eq(t.staff.storeId, storeId));

  // Staff usernames are unique WITHIN the store…
  if (
    username &&
    storeStaff.some((s) => s.username.toLowerCase() === username.toLowerCase() && s.id !== input.id)
  ) {
    throw new Error(`Username "${username}" is already taken by another user in this store.`);
  }
  // …but owner (Administrator) usernames and emails are unique platform-wide,
  // because owners sign in without a store code.
  if (input.role === "Administrator") {
    const all = await db.select().from(t.staff);
    if (
      username &&
      all.some((s) => s.username.toLowerCase() === username.toLowerCase() && s.id !== input.id)
    ) {
      throw new Error(`Username "${username}" is already taken. Owner usernames must be unique across all stores.`);
    }
    if (
      email &&
      all.some((s) => s.email !== "" && s.email.toLowerCase() === email.toLowerCase() && s.id !== input.id)
    ) {
      throw new Error("That email is already used by another account. Owner emails must be unique across all stores.");
    }
  }

  if (input.id) {
    const current = storeStaff.find((s) => s.id === input.id);
    if (!current) throw new Error("User not found.");
    // Plan gate: activating a user beyond the plan's max_users is rejected.
    if (input.active && current.active !== 1) {
      await assertUserCapacity(db, storeId, plan, current.id);
    }
    await db
      .update(t.staff)
      .set({
        name,
        username,
        email,
        role: input.role,
        active: input.active ? 1 : 0,
        passwordHash: input.password ? await hashPassword(input.password) : current.passwordHash,
      })
      .where(eq(t.staff.id, input.id));
    await addHistory(db, storeId, {
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
    if (input.active) {
      await assertUserCapacity(db, storeId, plan, null);
    }
    const [row] = await db
      .insert(t.staff)
      .values({
        storeId,
        name,
        username,
        passwordHash: await hashPassword(input.password),
        email,
        role: input.role,
        active: input.active ? 1 : 0,
        emailVerified: 1, // owner-created accounts are pre-verified
        isPlatformAdmin: 0,
        lastLogin: "",
        createdAt: new Date(),
      })
      .returning();
    await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Area name is required.");
  const rows = await db.select().from(t.areas).where(eq(t.areas.storeId, storeId));
  if (!rows.some((a) => a.name.toLowerCase() === trimmed.toLowerCase())) {
    await db.insert(t.areas).values({ storeId, name: trimmed });
    await addHistory(db, storeId, {
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
  const { user, storeId } = await requireStoreSession();
  const db = await getDb();
  const rows = await db.select().from(t.areas).where(eq(t.areas.storeId, storeId));
  const target = rows.find((a) => a.name === name.trim());
  if (target) {
    await db.delete(t.areas).where(eq(t.areas.id, target.id));
  }
  await addHistory(db, storeId, {
    action: "Delete",
    entityType: "Area",
    description: `Removed storage area ${name.trim()}`,
    actor: user.name,
    reference: name.trim(),
  });
  return { ok: true as const };
}

/* ---------------- platform admin ----------------
 * The ONLY actions allowed to read across stores. They expose store-level
 * metadata (plan, status, user counts) and the feedback inbox — never a
 * store's products, sales or inventory. */

export async function fetchPlatformData(): Promise<PlatformDataDTO> {
  await requirePlatformAdmin();
  const db = await getDb();
  const storeRows = await db.select().from(t.stores);
  const staffRows = await db.select().from(t.staff);
  const planRows = await loadPlans(db);
  const feedbackRows = await db.select().from(t.feedback);

  const staffById = new Map(staffRows.map((s) => [s.id, s]));
  const storeById = new Map(storeRows.map((s) => [s.id, s]));

  const stores = storeRows
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((s) => {
      const owner = s.ownerStaffId != null ? staffById.get(s.ownerStaffId) : undefined;
      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        ownerName: owner?.name ?? "",
        ownerEmail: owner?.email ?? "",
        planId: s.planId,
        planExpiresAt: s.planExpiresAt ? s.planExpiresAt.toISOString() : null,
        usersCount: staffRows.filter((u) => u.storeId === s.id).length,
        status: s.status,
        setupCompleted: s.setupCompleted === 1,
        createdAt: s.createdAt.toISOString(),
      };
    });

  const perPlan = planRows.map((p) => ({
    planId: p.id,
    count: storeRows.filter((s) => s.planId === p.id).length,
  }));

  const feedback = feedbackRows
    .slice()
    .sort((a, b) => b.id - a.id)
    .slice(0, 200)
    .map((f) => ({
      id: f.id,
      storeId: f.storeId ?? null,
      storeName: f.storeId != null ? (storeById.get(f.storeId)?.name ?? "") : "",
      staffName: f.staffId != null ? (staffById.get(f.staffId)?.name ?? "") : "",
      type: f.type,
      message: f.message,
      createdAt: f.createdAt.toISOString(),
    }));

  return {
    totalStores: storeRows.length,
    totalUsers: staffRows.filter((s) => s.isPlatformAdmin !== 1).length,
    perPlan,
    stores,
    feedback,
  };
}

export async function platformSetPlan(input: {
  storeId: number;
  planId: string;
  expiresAt: string | null; // ISO date or null = no expiry
}): Promise<{ ok: true }> {
  await requirePlatformAdmin();
  const db = await getDb();
  const plans = await loadPlans(db);
  if (!plans.some((p) => p.id === input.planId)) {
    throw new Error("Unknown plan.");
  }
  const store = await loadStore(db, input.storeId);
  if (!store) throw new Error("Store not found.");
  const expires =
    input.planId === "free" ? null : input.expiresAt ? new Date(input.expiresAt) : null;
  if (expires && Number.isNaN(expires.getTime())) {
    throw new Error("Invalid expiry date.");
  }
  await db
    .update(t.stores)
    .set({ planId: input.planId, planExpiresAt: expires })
    .where(eq(t.stores.id, input.storeId));
  return { ok: true as const };
}

/**
 * One-click plan extension from the platform console: adds one month to
 * a store's paid-plan expiry. The base is the current expiry when it is
 * still in the future, otherwise now — so extending an already-expired
 * plan restarts it from today, and because the effective plan is derived
 * from plan_expires_at the paid plan becomes active again. The plan
 * itself never changes here, only the expiry.
 */
export async function extendStorePlanAction(input: {
  storeId: number;
}): Promise<{ ok: true; planExpiresAt: string }> {
  await requirePlatformAdmin();
  const db = await getDb();
  const store = await loadStore(db, input.storeId);
  if (!store) throw new Error("Store not found.");
  if (store.planId === "free") {
    throw new Error(
      "Free plans have no expiry to extend. Set the store to a paid plan first.",
    );
  }
  const now = new Date();
  const base =
    store.planExpiresAt && store.planExpiresAt.getTime() > now.getTime()
      ? store.planExpiresAt
      : now;
  const next = new Date(base.getTime());
  next.setMonth(next.getMonth() + 1);
  await db
    .update(t.stores)
    .set({ planExpiresAt: next })
    .where(eq(t.stores.id, input.storeId));
  return { ok: true as const, planExpiresAt: next.toISOString() };
}

export async function platformSetStoreStatus(input: {
  storeId: number;
  status: "active" | "suspended";
}): Promise<{ ok: true }> {
  await requirePlatformAdmin();
  const db = await getDb();
  if (input.status !== "active" && input.status !== "suspended") {
    throw new Error("Invalid store status.");
  }
  const store = await loadStore(db, input.storeId);
  if (!store) throw new Error("Store not found.");
  await db
    .update(t.stores)
    .set({ status: input.status })
    .where(eq(t.stores.id, input.storeId));
  return { ok: true as const };
}
