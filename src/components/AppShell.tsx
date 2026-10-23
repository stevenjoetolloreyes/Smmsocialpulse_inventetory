"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useStore, type ViewKey } from "./store";
import { Icon } from "./ui";
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
import { NotificationsView, NotificationBell } from "./Notifications";
import { HelpButton } from "./HelpButton";
import { PrintHost } from "./PrintHost";

/**
 * ONE navigation model shared by the desktop sidebar and the mobile
 * drawer: direct items first, then collapsible groups (chevron toggles,
 * multiple groups may be open at once). QR Labels stays under Reports,
 * where it has always lived.
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

/** The grouped navigation list — identical in the sidebar and the drawer. */
function NavList({ onNavigate }: { onNavigate?: () => void }) {
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

  const itemCls = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
      active ? "bg-white text-[#12291b] shadow" : "text-white/85 hover:bg-white/10"
    }`;

  const renderItem = (item: { key: ViewKey; label: string; icon: string }, nested = false) => {
    const active = view === item.key;
    const alert = item.key === "inventory" ? lowCount + outCount : 0;
    return (
      <li key={item.key}>
        <button onClick={() => go(item.key)} className={`${itemCls(active)} ${nested ? "pl-11" : ""}`}>
          {!nested && <Icon name={item.icon} className="w-5 text-center" />}
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
    <nav className="nice-scroll flex-1 overflow-y-auto px-3 pb-4">
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
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-white/90 transition hover:bg-white/10"
              aria-expanded={open}
            >
              <Icon name={group.icon} className="w-5 text-center" />
              <span className="flex-1 text-left">{group.name}</span>
              <Icon
                name="chevron-down"
                className={`text-xs text-white/50 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <ul className="space-y-0.5 pt-0.5">
                  {group.items.map((item) => renderItem(item, true))}
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
function NavBottom({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useStore();
  return (
    <div className="border-t border-white/10 px-3 py-3">
      <button
        onClick={() => {
          onNavigate?.();
          window.dispatchEvent(new CustomEvent("ims:open-help"));
        }}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10"
      >
        <Icon name="circle-question" className="w-5 text-center" />
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

function StoreLogo({ size = "h-11 w-11", rounded = "rounded-xl" }: { size?: string; rounded?: string }) {
  const { data } = useStore();
  const settings = data.settings;
  if (settings.logoData) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={settings.logoData}
        alt=""
        className={`${size} ${rounded} shrink-0 object-cover ring-1 ring-white/20`}
      />
    );
  }
  return (
    <span
      className={`flex ${size} ${rounded} shrink-0 items-center justify-center bg-white/10 text-lg font-bold`}
    >
      {settings.logoText || "MS"}
    </span>
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

export function AppShell() {
  const { data, view, setView, toast, busy } = useStore();
  const settings = data.settings;
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty("--brand", settings.primaryColor);
  }, [settings.primaryColor]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const plan = data.plan;
  const paidPlan = plan.id !== "free";

  return (
    <div
      className="flex min-h-screen"
      style={{ "--brand": settings.primaryColor } as CSSProperties}
    >
      {/* Sidebar — desktop (≥1024px) */}
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[#12291b] text-white lg:flex">
        <div className="flex items-center gap-3 px-5 pb-4 pt-5">
          <StoreLogo />
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">{settings.storeName}</p>
            <p className="text-xs text-white/60">Inventory Management</p>
          </div>
        </div>
        <NavList />
        <NavBottom />
      </aside>

      {/* Mobile drawer (<1024px): same navigation, slid in from the left */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${drawerOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!drawerOpen}
      >
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          className={`no-print absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-[#12291b] text-white shadow-2xl transition-transform duration-300 ease-in-out ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center gap-3 px-4 pb-3 pt-4">
            <StoreLogo />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold leading-tight">{settings.storeName}</p>
              <p className="text-xs text-white/60">Inventory Management</p>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85 transition hover:bg-white/20"
              aria-label="Close menu"
            >
              <Icon name="xmark" />
            </button>
          </div>
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
          {view === "notifications" && <NotificationsView />}
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
