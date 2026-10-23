import { desc, eq } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as t from "@/lib/schema";
import type { NotificationCategory, NotificationDTO } from "@/lib/types";
import {
  effectivePlanId,
  fmtDateLong,
  loadPlans,
  loadStore,
  todayStr,
} from "./helpers";

/**
 * In-app notifications (store-scoped, real events only — never seeded).
 *
 * Every creation path here is failure-isolated: helpers swallow their own
 * errors, and callers additionally wrap the call, so a notification can
 * never break the sale / stock / plan action that triggered it.
 */

type NewNotification = {
  category: NotificationCategory;
  title: string;
  body?: string;
  dedupeKey?: string | null;
};

/** Plain insert (no dedupe). Internal use only — no client action creates. */
export async function createNotification(
  db: DB,
  storeId: number,
  n: NewNotification,
): Promise<void> {
  try {
    await db.insert(t.notifications).values({
      storeId,
      category: n.category,
      title: n.title,
      body: n.body ?? "",
      dedupeKey: n.dedupeKey ?? null,
      createdAt: new Date(),
    });
  } catch {
    /* notifications must never break the action that triggered them */
  }
}

/**
 * Deduped insert, two modes:
 * - "unread" (low/out-of-stock): skipped while a copy with the same key
 *   is still fully unread (no read rows at all). Once someone has seen
 *   the earlier alert, a later stock event may alert again.
 * - "exists" (daily sweep keys — the key itself embeds the date, e.g.
 *   exp:{batch}:{day}, planexp:{store}:{day}): skipped when ANY copy
 *   with the key exists, read or not. The sweep runs on every snapshot
 *   load, so read-based dedupe here would re-create the alert on the
 *   very refresh that follows marking it read — "at most one per day"
 *   must be absolute.
 */
export async function createDedupedNotification(
  db: DB,
  storeId: number,
  n: NewNotification & { dedupeKey: string },
  mode: "unread" | "exists" = "unread",
): Promise<void> {
  try {
    const mine = (
      await db.select().from(t.notifications).where(eq(t.notifications.storeId, storeId))
    ).filter((x) => x.dedupeKey === n.dedupeKey);
    if (mine.length > 0) {
      if (mode === "exists") return; // today's copy already created
      const reads = await db.select().from(t.notificationReads);
      const readIds = new Set(
        reads
          .filter((r) => mine.some((m) => m.id === r.notificationId))
          .map((r) => r.notificationId),
      );
      if (mine.some((m) => !readIds.has(m.id))) return; // an unread copy exists
    }
    await db.insert(t.notifications).values({
      storeId,
      category: n.category,
      title: n.title,
      body: n.body ?? "",
      dedupeKey: n.dedupeKey,
      createdAt: new Date(),
    });
  } catch {
    /* failure-isolated, as above */
  }
}

/**
 * Low / out-of-stock alerts for the given items, evaluated against each
 * item's CURRENT synced quantity. Called after every stock-changing
 * action (sale, stock in/out/adjust, batch adjust/status, receiving,
 * bulk restock, return).
 */
export async function notifyStockLevels(
  db: DB,
  storeId: number,
  itemIds: number[],
): Promise<void> {
  try {
    const unique = Array.from(new Set(itemIds));
    for (const itemId of unique) {
      const [item] = await db.select().from(t.items).where(eq(t.items.id, itemId));
      if (!item || item.storeId !== storeId || item.deletedAt) continue;
      if (item.quantity <= 0) {
        await createDedupedNotification(db, storeId, {
          category: "inventory",
          title: `Out of stock: ${item.name}`,
          body: `${item.name} has no stock left. Restock soon so it can be sold again.`,
          dedupeKey: `out:${item.id}`,
        });
      } else if (item.quantity <= item.reorderLevel) {
        await createDedupedNotification(db, storeId, {
          category: "inventory",
          title: `Low stock: ${item.name}`,
          body: `${item.quantity} ${item.unit} left — the reorder level is ${item.reorderLevel}.`,
          dedupeKey: `low:${item.id}`,
        });
      }
    }
  } catch {
    /* failure-isolated */
  }
}

/** Whole days from a YYYY-MM-DD "today" to another YYYY-MM-DD date. */
function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T00:00:00Z`).getTime();
  const b = new Date(`${toYmd}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * Time-driven alerts, evaluated whenever a store snapshot loads:
 * - batches expiring within 7 days / already expired (once per batch/day)
 * - paid plan expiring within 7 days / expired paid plan (once per day)
 */
export async function generateSnapshotNotifications(
  db: DB,
  storeId: number,
): Promise<void> {
  try {
    const today = todayStr();

    /* ---- inventory: batch expiries ---- */
    const batches = await db
      .select()
      .from(t.batches)
      .where(eq(t.batches.storeId, storeId));
    const itemRows = await db
      .select()
      .from(t.items)
      .where(eq(t.items.storeId, storeId));
    const itemName = new Map(itemRows.map((i) => [i.id, i.name]));
    for (const b of batches) {
      if (!b.expiryDate || b.qtyRemaining <= 0) continue;
      if (b.status !== "active" && b.status !== "expired") continue;
      const diff = daysBetween(today, b.expiryDate);
      const name = itemName.get(b.itemId) ?? "A product";
      const expiryLong = fmtDateLong(new Date(`${b.expiryDate}T00:00:00`));
      if (diff < 0) {
        await createDedupedNotification(db, storeId, {
          category: "inventory",
          title: `Expired batch: ${name}`,
          body: `Batch ${b.batchNo} of ${name} expired on ${expiryLong}.`,
          dedupeKey: `exp:${b.id}:${today}`,
        }, "exists");
      } else if (diff <= 7) {
        await createDedupedNotification(db, storeId, {
          category: "inventory",
          title: `Expiring soon: ${name}`,
          body: `Batch ${b.batchNo} of ${name} expires on ${expiryLong} (${diff === 0 ? "today" : `in ${diff} day${diff === 1 ? "" : "s"}`}).`,
          dedupeKey: `exp:${b.id}:${today}`,
        }, "exists");
      }
    }

    /* ---- billing: plan expiry ---- */
    const store = await loadStore(db, storeId);
    if (store && store.planId !== "free" && store.planExpiresAt) {
      const plans = await loadPlans(db);
      const planName = plans.find((p) => p.id === store.planId)?.name ?? store.planId;
      const expiryYmd = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
      }).format(store.planExpiresAt);
      const diff = daysBetween(today, expiryYmd);
      if (effectivePlanId(store) === "free") {
        await createDedupedNotification(db, storeId, {
          category: "billing",
          title: "Your plan has expired — your store is now on the Free plan",
          body: `The ${planName} plan ended on ${fmtDateLong(store.planExpiresAt)}. Ask the platform owner to renew it to restore the paid limits.`,
          // Same daily pattern as the expiring-soon key, state-qualified:
          // an "expires soon" alert sent earlier the same day must not
          // suppress the (different) expired alert.
          dedupeKey: `planexp-expired:${storeId}:${today}`,
        }, "exists");
      } else if (diff >= 0 && diff <= 7) {
        await createDedupedNotification(db, storeId, {
          category: "billing",
          title: `Your ${planName} plan expires on ${fmtDateLong(store.planExpiresAt)}`,
          body: `Renew with the platform owner before ${fmtDateLong(store.planExpiresAt)} so the store keeps its ${planName} limits without interruption.`,
          dedupeKey: `planexp:${storeId}:${today}`,
        }, "exists");
      }
    }
  } catch {
    /* failure-isolated */
  }
}

/**
 * The current user's notification feed: latest 50 (newest first) with this
 * staff member's read state, plus the total unread count for the store.
 */
export async function loadNotifications(
  db: DB,
  storeId: number,
  staffId: number,
): Promise<{ notifications: NotificationDTO[]; unreadCount: number }> {
  const rows = await db
    .select()
    .from(t.notifications)
    .where(eq(t.notifications.storeId, storeId))
    .orderBy(desc(t.notifications.id));
  const reads = await db
    .select()
    .from(t.notificationReads)
    .where(eq(t.notificationReads.staffId, staffId));
  const readIds = new Set(reads.map((r) => r.notificationId));
  const unreadCount = rows.filter((n) => !readIds.has(n.id)).length;
  const notifications = rows.slice(0, 50).map((n) => ({
    id: n.id,
    category: n.category as NotificationCategory,
    title: n.title,
    body: n.body,
    read: readIds.has(n.id),
    createdAt: n.createdAt.toISOString(),
  }));
  return { notifications, unreadCount };
}

/** Marks one notification read for a staff member (idempotent). */
export async function markNotificationRead(
  db: DB,
  notificationId: number,
  staffId: number,
): Promise<void> {
  await db
    .insert(t.notificationReads)
    .values({ notificationId, staffId, readAt: new Date() })
    .onConflictDoNothing();
}

/** Marks every notification of a store read for a staff member. */
export async function markAllNotificationsRead(
  db: DB,
  storeId: number,
  staffId: number,
): Promise<void> {
  const rows = await db
    .select({ id: t.notifications.id })
    .from(t.notifications)
    .where(eq(t.notifications.storeId, storeId));
  const reads = await db
    .select()
    .from(t.notificationReads)
    .where(eq(t.notificationReads.staffId, staffId));
  const readIds = new Set(reads.map((r) => r.notificationId));
  const now = new Date();
  for (const row of rows) {
    if (readIds.has(row.id)) continue;
    await db
      .insert(t.notificationReads)
      .values({ notificationId: row.id, staffId, readAt: now })
      .onConflictDoNothing();
  }
}
