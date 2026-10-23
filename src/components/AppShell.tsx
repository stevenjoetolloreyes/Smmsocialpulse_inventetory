"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useStore, type ViewKey } from "./store";
import { Icon } from "./ui";
import { LOGO_SRC } from "@/lib/logo";
import { Dashboard } from "./Dashboard";
import { Pos } from "./Pos";
import { Inventory } from "./Inventory";
import { ScanView } from "./ScanView";
import { Receiving } from "./Receiving";
import { BulkRestock } from "./BulkRestock";
import { ProductStatus } from "./ProductStatus";
import { Suppliers } from "./Suppliers";
import { SalesReport } from "./SalesReport";
import { InventoryReport } from "./InventoryReport";
import { HistoryLog } from "./HistoryLog";
import { LabelsView } from "./LabelsView";
import { SettingsView } from "./SettingsView";
import { SubscriptionView } from "./SubscriptionView";
import { NotificationsView, NotificationBell, NotificationPrefs } from "./Notifications";
import { HelpButton } from "./HelpButton";
import { PrintHost } from "./PrintHost";

/**
 * ONE navigation model shared by the desktop sidebar and the mobile
 * drawer: direct items first, then collapsible groups (chevron toggles,
 * multiple groups may be open at once). QR Labels stays under Reports,
 * where it has always lived.
 *
 * Presentation: a floating "edge" panel — deep-green brand
 * gradient with a violet tail, 30px corners, glass border and soft
 * shadow — as an off-canvas drawer on mobile and a persistent,
 * collapsible (icon-only) rail on desktop.
 */
const NAV_DIRECT: { key: ViewKey; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "gauge-high" },
  { key: "pos", label: "Cashier (POS)", icon: "cash-register" },
  { key: "scan", label: "Scan", icon: "qrcode" },
];

const NAV_GROUPS: {
  name: string;
  icon: string;
  items: { key: ViewKey; label: string; icon: string }[];
}[] = [
  {
    name: "Inventory",
    icon: "boxes-stacked",
    items: [
      { key: "inventory", label: "Inventory", icon: "boxes-stacked" },
      { key: "receiving", label: "Receiving", icon: "truck-ramp-box" },
      { key: "bulk", label: "Bulk Restock", icon: "layer-group" },
      { key: "status", label: "Product Status", icon: "clipboard-check" },
      { key: "suppliers", label: "Suppliers", icon: "truck-field" },
    ],
  },
  {
    name: "Reports",
    icon: "chart-line",
    items: [
      { key: "sales-report", label: "Sales Report", icon: "chart-line" },
      { key: "inventory-report", label: "Inventory Reports", icon: "file-lines" },
      { key: "labels", label: "QR Labels", icon: "tags" },
    ],
  },
  {
    name: "System",
    icon: "gear",
    items: [
      { key: "subscription", label: "Subscription", icon: "crown" },
      { key: "history", label: "History Log", icon: "clock-rotate-left" },
      { key: "settings", label: "Settings", icon: "gear" },
    ],
  },
];

function groupOfView(view: ViewKey): string | null {
  for (const g of NAV_GROUPS) {
    if (g.items.some((i) => i.key === view)) return g.name;
  }
  return null;
}

const TITLES: Record<ViewKey, string> = {
  dashboard: "Dashboard",
  pos: "Cashier (POS)",
  scan: "Scan QR Code",
  inventory: "Inventory",
  receiving: "Receiving",
  bulk: "Bulk Restock",
  status: "Product Status",
  suppliers: "Suppliers",
  "sales-report": "Sales Report",
  "inventory-report": "Inventory Reports",
  history: "History Log",
  labels: "QR Labels",
  settings: "Settings",
  subscription: "Subscription",
  notifications: "Notifications",
};

/** Floating tooltip shown beside icon-only (collapsed) rail buttons. */
function RailTip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#12291b] px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-xl ring-1 ring-white/20 transition-opacity duration-150 group-hover:opacity-100">
      {label}
    </span>
  );
}

const itemBase =
  "ims-item flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.98]";
const itemActive =
  "bg-white text-[#12291b] shadow-lg shadow-green-950/30 ring-1 ring-white/70";
const itemIdle = "text-white/85 hover:bg-white/10 hover:text-white";

/** The grouped navigation list — identical in the sidebar and the drawer. */
function NavList({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { data, view, setView } = useStore();
  const lowCount = data.products.filter(
    (p) => p.quantity > 0 && p.quantity <= p.reorderLevel,
  ).length;
  const outCount = data.products.filter((p) => p.quantity <= 0).length;

  // The group holding the active view starts expanded; navigating into a
  // collapsed group expands it. Each group's state is independent.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const g = groupOfView(view);
    return g ? { [g]: true } : {};
  });
  useEffect(() => {
    const g = groupOfView(view);
    if (g) setOpenGroups((prev) => (prev[g] ? prev : { ...prev, [g]: true }));
  }, [view]);

  const go = (key: ViewKey) => {
    setView(key);
    onNavigate?.();
  };

  const alertFor = (key: ViewKey) =>
    key === "inventory" ? lowCount + outCount : 0;

  if (collapsed) {
    // Icon-only rail: every destination stays reachable, groups flatten
    // into their items under a thin divider, each with a tooltip.
    const railItem = (item: { key: ViewKey; label: string; icon: string }) => {
      const active = view === item.key;
      const alert = alertFor(item.key);
      return (
        <li key={item.key} className="group relative">
          <button
            onClick={() => go(item.key)}
            className={`ims-item relative flex w-full items-center justify-center rounded-2xl py-2.5 transition-all duration-200 active:scale-95 ${
              active
                ? "bg-white text-[#12291b] shadow-lg shadow-green-950/30 ring-1 ring-white/70"
                : "text-white/85 hover:bg-white/10 hover:text-white"
            }`}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={item.icon} className="text-base" />
            {alert > 0 && (
              <span className="ims-alert-dot absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </button>
          <RailTip label={item.label} />
        </li>
      );
    };
    return (
      <nav className="nice-scroll flex-1 overflow-y-auto px-2.5 pb-4" aria-label="Main">
        <ul className="space-y-1 pt-1">{NAV_DIRECT.map(railItem)}</ul>
        {NAV_GROUPS.map((group) => (
          <div key={group.name}>
            <div className="mx-2 my-3 border-t border-white/12" aria-hidden="true" />
            <ul className="space-y-1">{group.items.map(railItem)}</ul>
          </div>
        ))}
      </nav>
    );
  }

  const renderItem = (item: { key: ViewKey; label: string; icon: string }) => {
    const active = view === item.key;
    const alert = alertFor(item.key);
    return (
      <li key={item.key}>
        <button
          onClick={() => go(item.key)}
          className={`${itemBase} ${active ? itemActive : itemIdle}`}
          aria-current={active ? "page" : undefined}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <Icon name={item.icon} />
          </span>
          <span className="flex-1 text-left">{item.label}</span>
          {alert > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {alert}
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <nav className="nice-scroll flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
      <ul className="space-y-0.5 pt-1">
        {NAV_DIRECT.map((item) => renderItem(item))}
      </ul>
      {NAV_GROUPS.map((group) => {
        const open = !!openGroups[group.name];
        return (
          <div key={group.name} className="mt-3">
            <button
              onClick={() =>
                setOpenGroups((prev) => ({ ...prev, [group.name]: !prev[group.name] }))
              }
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-bold text-white/90 transition hover:bg-white/10"
              aria-expanded={open}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                <Icon name={group.icon} />
              </span>
              <span className="flex-1 text-left">{group.name}</span>
              <Icon
                name="chevron-down"
                className={`ims-chevron text-xs text-white/50 ${open ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`ims-acc grid ${
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <ul className="space-y-0.5 pt-0.5">
                  {group.items.map((item) => renderItem(item))}
                </ul>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/** Pinned bottom rows shared by the sidebar and the drawer. */
function NavBottom({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { user, logout } = useStore();

  if (collapsed) {
    return (
      <div className="border-t border-white/12 px-2.5 py-3">
        <div className="group relative">
          <button
            onClick={() => {
              onNavigate?.();
              window.dispatchEvent(new CustomEvent("ims:open-help"));
            }}
            className="ims-item flex w-full items-center justify-center rounded-2xl py-2.5 text-white/85 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-95"
            aria-label="Help & Support"
          >
            <Icon name="circle-question" className="text-base" />
          </button>
          <RailTip label="Help & Support" />
        </div>
        <div className="group relative mt-1">
          <div
            className="flex items-center justify-center py-1.5"
            aria-label={`${user.name} · ${user.role}`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
          <RailTip label={`${user.name} · ${user.role}`} />
        </div>
        <div className="group relative mt-1">
          <button
            onClick={() => void logout()}
            className="ims-item flex w-full items-center justify-center rounded-2xl py-2.5 text-white/85 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-95"
            aria-label="Log out"
          >
            <Icon name="arrow-right-from-bracket" className="text-base" />
          </button>
          <RailTip label="Log out" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-white/12 px-3 py-3">
      <button
        onClick={() => {
          onNavigate?.();
          window.dispatchEvent(new CustomEvent("ims:open-help"));
        }}
        className="ims-item flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-white/85 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-[0.98]"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          <Icon name="circle-question" />
        </span>
        <span className="flex-1 text-left">Help &amp; Support</span>
      </button>
      <div className="mt-1 flex items-center gap-3 px-3 py-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-white/60">{user.role}</p>
        </div>
        <button
          onClick={() => void logout()}
          className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/20"
          aria-label="Log out"
          title="Log out"
        >
          <Icon name="arrow-right-from-bracket" /> Log out
        </button>
      </div>
    </div>
  );
}

function StoreLogo({ size = "h-11 w-11", rounded = "rounded-2xl" }: { size?: string; rounded?: string }) {
  const { data } = useStore();
  const settings = data.settings;
  if (settings.logoData) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={settings.logoData}
        alt=""
        className={`${size} ${rounded} shrink-0 object-cover ring-1 ring-white/25`}
      />
    );
  }
  return (
    <span
      className={`flex ${size} ${rounded} shrink-0 items-center justify-center bg-white/12 text-lg font-bold ring-1 ring-white/15`}
    >
      {settings.logoText || "MS"}
    </span>
  );
}

/** Sidebar/drawer header: logo, WORKSPACE label, store name, optional close. */
function SideHeader({
  onClose,
  collapsed = false,
  closeRef,
}: {
  onClose?: () => void;
  collapsed?: boolean;
  closeRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const { data } = useStore();
  const settings = data.settings;
  if (collapsed) {
    return (
      <div className="flex flex-col items-center px-2 pb-2 pt-5">
        <StoreLogo />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 px-5 pb-3 pt-5">
      <StoreLogo />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
          Workspace
        </p>
        <p className="truncate font-bold leading-tight">{settings.storeName}</p>
      </div>
      {onClose && (
        <button
          ref={closeRef}
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85 ring-1 ring-white/15 transition hover:bg-white/20 active:scale-95"
          aria-label="Close menu"
        >
          <Icon name="xmark" />
        </button>
      )}
    </div>
  );
}

/** Topbar avatar chip with the user menu (identity + log out). */
function UserMenu() {
  const { user, logout } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-stone-100 py-1 pl-1 pr-2.5 transition hover:bg-stone-200"
        aria-label="User menu"
        title={`${user.name} · ${user.role}`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-white">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-32 truncate text-xs font-semibold text-stone-600 sm:block">
          {user.name}
        </span>
        <Icon name="chevron-down" className="text-[10px] text-stone-400" />
      </button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-40 cursor-default"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
            <div className="border-b border-stone-100 px-4 py-3">
              <p className="truncate text-sm font-bold text-stone-800">{user.name}</p>
              <p className="truncate text-xs text-stone-400">
                {user.role} · @{user.username}
              </p>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-stone-700 transition hover:bg-stone-50"
            >
              <Icon name="arrow-right-from-bracket" className="w-4 text-center text-stone-400" />
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Branded splash shown briefly on every full app load — right after
 * sign-in and on every page refresh — while the workspace settles.
 * Purely presentational: the data is already loaded by the server.
 */
function SplashGate() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("fade"), 900);
    const t2 = setTimeout(() => setPhase("gone"), 1380);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  if (phase === "gone") return null;
  return (
    <div
      className={`ims-splash fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#f6f8f6] transition-opacity duration-[480ms] ${
        phase === "fade" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <img
        src={LOGO_SRC}
        alt=""
        className="ims-splash-logo h-24 w-24 rounded-[26px] object-cover shadow-2xl shadow-green-900/25 ring-1 ring-black/5"
      />
      <p className="mt-5 px-4 text-center text-xl font-extrabold tracking-tight text-stone-800">
        Inventory Management System
      </p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.22em] text-stone-400">
        Store Workspace
      </p>
      <div className="mt-7 h-1.5 w-44 overflow-hidden rounded-full bg-stone-200">
        <div className="ims-splash-bar h-full w-16 rounded-full bg-[var(--brand)]" />
      </div>
    </div>
  );
}

/**
 * "Welcome back!" banner shown once per sign-in: the login page leaves
 * an `ims_welcome` flag in sessionStorage, and this banner appears as
 * the splash fades, then auto-dismisses (or via its close button).
 */
function WelcomeBanner() {
  const { user } = useStore();
  const [state, setState] = useState<"wait" | "show" | "gone">("wait");
  useEffect(() => {
    let flagged = false;
    try {
      flagged = sessionStorage.getItem("ims_welcome") === "1";
      if (flagged) sessionStorage.removeItem("ims_welcome");
    } catch {
      /* private mode */
    }
    if (!flagged) {
      setState("gone");
      return;
    }
    const t1 = setTimeout(() => setState("show"), 1450);
    const t2 = setTimeout(() => setState("gone"), 6400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  if (state !== "show") return null;
  return (
    <div
      className="ims-welcome no-print fixed inset-x-0 top-4 z-[90] mx-auto w-[min(92vw,430px)]"
      role="status"
    >
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-2xl shadow-stone-900/25 ring-1 ring-white/25"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in srgb, var(--brand) 72%, white), var(--brand))",
        }}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Icon name="check" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">Welcome back!</p>
          <p className="truncate text-xs text-white/80">
            {user.name} · signed in successfully
          </p>
        </div>
        <button
          onClick={() => setState("gone")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85 transition hover:bg-white/20"
          aria-label="Dismiss"
        >
          <Icon name="xmark" />
        </button>
      </div>
    </div>
  );
}

export function AppShell() {
  const { data, view, setView, toast, busy } = useStore();
  const settings = data.settings;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("ims_sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    document.documentElement.style.setProperty("--brand", settings.primaryColor);
  }, [settings.primaryColor]);

  // Appearance (light | dark | system): persisted per user on the
  // server, mirrored to localStorage so the anti-flash script in the
  // root layout can apply it before first paint.
  const [themeMode, setThemeModeState] = useState<string>(() => {
    try {
      return localStorage.getItem("ims_theme_mode") || data.themeMode || "system";
    } catch {
      return data.themeMode || "system";
    }
  });
  useEffect(() => {
    // Keep in sync if the saved preference changes elsewhere.
    if (data.themeMode && data.themeMode !== themeMode) {
      setThemeModeState(data.themeMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.themeMode]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark =
        themeMode === "dark" || (themeMode === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    try {
      localStorage.setItem("ims_theme_mode", themeMode);
    } catch {
      /* private mode */
    }
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [themeMode]);
  // Appearance changes are made in Settings → General; this effect only
  // APPLIES the saved preference (state syncs from data.themeMode).

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // Escape closes the drawer; focus lands on its close button on open.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    closeBtnRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      try {
        localStorage.setItem("ims_sidebar_collapsed", prev ? "0" : "1");
      } catch {
        /* private mode */
      }
      return !prev;
    });
  };

  const plan = data.plan;
  const paidPlan = plan.id !== "free";

  return (
    <div
      className="flex min-h-screen"
      style={{ "--brand": settings.primaryColor } as CSSProperties}
    >
      <SplashGate />
      <WelcomeBanner />

      {/* Sidebar — desktop (≥1024px): floating, persistent, collapsible */}
      <aside
        className={`ims-side no-print sticky ml-3 hidden shrink-0 flex-col text-white transition-[width] duration-300 lg:flex ${
          collapsed ? "w-[84px]" : "w-64"
        }`}
        style={{
          top: "max(12px, env(safe-area-inset-top))",
          height: "calc(100dvh - 24px)",
        }}
        aria-label="Sidebar"
      >
        <SideHeader collapsed={collapsed} />
        {!collapsed && (
          <div className="flex justify-end px-4 pb-1">
            <button
              onClick={toggleCollapsed}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs text-white/75 ring-1 ring-white/15 transition hover:bg-white/20"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <Icon name="chevron-left" />
            </button>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center pb-1">
            <button
              onClick={toggleCollapsed}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs text-white/75 ring-1 ring-white/15 transition hover:bg-white/20"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <Icon name="chevron-right" />
            </button>
          </div>
        )}
        <NavList collapsed={collapsed} />
        <NavBottom collapsed={collapsed} />
      </aside>

      {/* Mobile drawer (<1024px): floating off-canvas, same navigation */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${drawerOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!drawerOpen}
      >
        <div
          onClick={() => setDrawerOpen(false)}
          className={`ims-backdrop absolute inset-0 bg-[#04120a]/55 backdrop-blur-[3px] ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          className={`ims-drawer no-print absolute flex flex-col text-white ${
            drawerOpen ? "ims-drawer-open" : "ims-drawer-closed"
          }`}
          style={{
            left: "max(10px, env(safe-area-inset-left))",
            top: "max(10px, env(safe-area-inset-top))",
            bottom: "max(10px, env(safe-area-inset-bottom))",
            width: "min(88vw, 340px)",
          }}
          aria-label="Menu"
        >
          <SideHeader onClose={() => setDrawerOpen(false)} closeRef={closeBtnRef} />
          <NavList onNavigate={() => setDrawerOpen(false)} />
          <NavBottom onNavigate={() => setDrawerOpen(false)} />
        </aside>
      </div>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center gap-2 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur sm:gap-3 lg:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200 lg:hidden"
            aria-label="Open menu"
            title="Menu"
          >
            <Icon name="bars" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-stone-800">
            {TITLES[view]}
          </h1>
          {busy && (
            <span className="text-sm text-stone-400">
              <Icon name="circle-notch" className="animate-spin" />
            </span>
          )}
          <button
            onClick={() => setView("subscription")}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${
              paidPlan
                ? "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100"
                : "bg-stone-100 text-stone-600 ring-stone-200 hover:bg-stone-200"
            }`}
            title={`Current plan: ${plan.name} — view subscription`}
          >
            <Icon name="crown" />
            <span className="hidden sm:inline">{plan.name}</span>
          </button>
          <NotificationBell />
          <UserMenu />
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-8 pt-4 lg:px-6">
          <div key={view} className="ims-view-in">
            {view === "dashboard" && <Dashboard />}
            {view === "pos" && <Pos />}
            {view === "scan" && <ScanView />}
            {view === "inventory" && <Inventory />}
            {view === "receiving" && <Receiving />}
            {view === "bulk" && <BulkRestock />}
            {view === "status" && <ProductStatus />}
            {view === "suppliers" && <Suppliers />}
            {view === "sales-report" && <SalesReport />}
            {view === "inventory-report" && <InventoryReport />}
            {view === "history" && <HistoryLog />}
            {view === "labels" && <LabelsView />}
            {view === "settings" && <SettingsView />}
            {view === "subscription" && <SubscriptionView />}
            {view === "notifications" && (
              <div className="space-y-4">
                <NotificationsView />
                <NotificationPrefs />
              </div>
            )}
          </div>
        </main>

        <HelpButton />
      </div>

      <PrintHost />

      {toast && (
        <div className="no-print fixed bottom-6 left-1/2 z-[60] w-auto max-w-[92vw] -translate-x-1/2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
