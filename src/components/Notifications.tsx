"use client";

import { useMemo, useState } from "react";
import { useStore } from "./store";
import { Card, EmptyState, Icon } from "./ui";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/actions";
import type { NotificationCategory, NotificationDTO } from "@/lib/types";

export const NOTIFICATION_TABS: { key: NotificationCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "inventory", label: "Inventory" },
  { key: "sales", label: "Sales" },
  { key: "billing", label: "Billing" },
  { key: "system", label: "System" },
];

const CATEGORY_ICON: Record<NotificationCategory, string> = {
  inventory: "boxes-stacked",
  sales: "cash-register",
  billing: "crown",
  system: "gear",
};

const CATEGORY_TILE: Record<NotificationCategory, string> = {
  inventory: "bg-amber-100 text-amber-700",
  sales: "bg-emerald-100 text-emerald-700",
  billing: "bg-violet-100 text-violet-700",
  system: "bg-sky-100 text-sky-700",
};

/** Compact relative time ("just now", "5m ago", "3h ago", "2d ago", date). */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
}

function NotificationRow({
  n,
  onOpen,
}: {
  n: NotificationDTO;
  onOpen: (n: NotificationDTO) => void;
}) {
  return (
    <button
      onClick={() => onOpen(n)}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-stone-50 ${
        n.read ? "" : "bg-emerald-50/50"
      }`}
    >
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${CATEGORY_TILE[n.category]}`}
      >
        <Icon name={CATEGORY_ICON[n.category]} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={`truncate text-sm ${n.read ? "font-medium text-stone-600" : "font-bold text-stone-800"}`}
          >
            {n.title}
          </span>
          <span className="shrink-0 text-[11px] text-stone-400">{timeAgo(n.createdAt)}</span>
        </span>
        {n.body && (
          <span className="mt-0.5 block text-sm leading-snug text-stone-500">{n.body}</span>
        )}
      </span>
      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
    </button>
  );
}

function TabBar({
  tab,
  setTab,
  counts,
}: {
  tab: NotificationCategory | "all";
  setTab: (t: NotificationCategory | "all") => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="nice-scroll flex gap-1 overflow-x-auto px-3 py-2">
      {NOTIFICATION_TABS.map((t) => {
        const active = tab === t.key;
        const count = counts[t.key] ?? 0;
        return (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-[var(--brand)] text-white"
                : "bg-stone-100 text-stone-500 hover:bg-stone-200"
            }`}
          >
            {t.label}
            {count > 0 && (
              <span
                className={`rounded-full px-1.5 text-[10px] font-bold ${
                  active ? "bg-white/25 text-white" : "bg-red-500 text-white"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Shared list logic for the bell dropdown and the full view. */
function useNotificationList() {
  const { data, run, setView } = useStore();
  const [tab, setTab] = useState<NotificationCategory | "all">("all");
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data.unreadNotifications };
    for (const cat of ["inventory", "sales", "billing", "system"]) {
      c[cat] = data.notifications.filter((n) => n.category === cat && !n.read).length;
    }
    return c;
  }, [data.notifications, data.unreadNotifications]);
  const visible = useMemo(
    () =>
      tab === "all"
        ? data.notifications
        : data.notifications.filter((n) => n.category === tab),
    [data.notifications, tab],
  );
  const open = async (n: NotificationDTO) => {
    if (!n.read) {
      try {
        await run(() => markNotificationReadAction(n.id));
      } catch {
        /* toasted by run() */
      }
    }
  };
  const markAll = async () => {
    try {
      await run(() => markAllNotificationsReadAction());
    } catch {
      /* toasted by run() */
    }
  };
  return { tab, setTab, counts, visible, open, markAll, setView, unread: data.unreadNotifications };
}

/**
 * Topbar bell: red unread badge, dropdown panel with category tabs,
 * mark-all-read, and a footer that opens the full Notifications view.
 */
export function NotificationBell() {
  const [openPanel, setOpenPanel] = useState(false);
  const { tab, setTab, counts, visible, open, markAll, setView, unread } =
    useNotificationList();

  return (
    <div className="relative">
      <button
        onClick={() => setOpenPanel((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition hover:bg-stone-200"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        title="Notifications"
      >
        <Icon name="bell" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {openPanel && (
        <>
          <button
            className="fixed inset-0 z-40 cursor-default"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpenPanel(false)}
          />
          <div className="absolute right-0 z-50 mt-2 flex max-h-[min(70vh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <p className="font-bold text-stone-800">Notifications</p>
              <button
                onClick={() => void markAll()}
                disabled={unread === 0}
                className="text-xs font-semibold text-[var(--brand)] hover:underline disabled:cursor-not-allowed disabled:text-stone-300 disabled:no-underline"
              >
                Mark all as read
              </button>
            </div>
            <div className="border-b border-stone-100">
              <TabBar tab={tab} setTab={setTab} counts={counts} />
            </div>
            <div className="nice-scroll flex-1 overflow-y-auto">
              {visible.length === 0 ? (
                <EmptyState
                  icon="bell-slash"
                  title="You're all caught up"
                  hint="No notifications to show."
                />
              ) : (
                <ul className="divide-y divide-stone-50">
                  {visible.map((n) => (
                    <li key={n.id}>
                      <NotificationRow n={n} onOpen={(x) => void open(x)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={() => {
                setOpenPanel(false);
                setView("notifications");
              }}
              className="border-t border-stone-100 px-4 py-3 text-center text-sm font-semibold text-[var(--brand)] transition hover:bg-stone-50"
            >
              See All Notifications <Icon name="arrow-right" className="text-xs" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Full-page notifications view (reached via "See All Notifications"). */
export function NotificationsView() {
  const { tab, setTab, counts, visible, open, markAll, unread } = useNotificationList();
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
        <h2 className="flex items-center gap-2 font-bold text-stone-800">
          <span className="text-[var(--brand)]">
            <Icon name="bell" />
          </span>
          Notifications
          {unread > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
              {unread} unread
            </span>
          )}
        </h2>
        <button
          onClick={() => void markAll()}
          disabled={unread === 0}
          className="text-xs font-semibold text-[var(--brand)] hover:underline disabled:cursor-not-allowed disabled:text-stone-300 disabled:no-underline"
        >
          Mark all as read
        </button>
      </div>
      <div className="border-b border-stone-100">
        <TabBar tab={tab} setTab={setTab} counts={counts} />
      </div>
      {visible.length === 0 ? (
        <EmptyState
          icon="bell-slash"
          title="You're all caught up"
          hint="No notifications to show."
        />
      ) : (
        <ul className="divide-y divide-stone-50">
          {visible.map((n) => (
            <li key={n.id}>
              <NotificationRow n={n} onOpen={(x) => void open(x)} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
