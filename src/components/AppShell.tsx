"use client";

import { useEffect, type CSSProperties } from "react";
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
import { PrintHost } from "./PrintHost";

const NAV: { group: string; items: { key: ViewKey; label: string; icon: string }[] }[] = [
  {
    group: "Operations",
    items: [
      { key: "dashboard", label: "Dashboard", icon: "gauge-high" },
      { key: "pos", label: "Cashier (POS)", icon: "cash-register" },
      { key: "scan", label: "Scan", icon: "qrcode" },
      { key: "inventory", label: "Inventory", icon: "boxes-stacked" },
      { key: "receiving", label: "Receiving", icon: "truck-ramp-box" },
      { key: "bulk", label: "Bulk Restock", icon: "layer-group" },
      { key: "status", label: "Product Status", icon: "clipboard-check" },
      { key: "suppliers", label: "Suppliers", icon: "truck-field" },
    ],
  },
  {
    group: "Reports",
    items: [
      { key: "sales-report", label: "Sales Report", icon: "chart-line" },
      { key: "inventory-report", label: "Inventory Reports", icon: "file-lines" },
      { key: "history", label: "History Log", icon: "clock-rotate-left" },
      { key: "labels", label: "QR Labels", icon: "tags" },
    ],
  },
  {
    group: "System",
    items: [{ key: "settings", label: "Settings", icon: "gear" }],
  },
];

const MOBILE_NAV: { key: ViewKey; label: string; icon: string }[] = [
  { key: "dashboard", label: "Home", icon: "gauge-high" },
  { key: "pos", label: "POS", icon: "cash-register" },
  { key: "scan", label: "Scan", icon: "qrcode" },
  { key: "inventory", label: "Items", icon: "boxes-stacked" },
  { key: "settings", label: "Settings", icon: "gear" },
];

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
};

export function AppShell() {
  const { data, user, view, setView, logout, toast, busy } = useStore();
  const settings = data.settings;
  const lowCount = data.products.filter(
    (p) => p.quantity > 0 && p.quantity <= p.reorderLevel,
  ).length;
  const outCount = data.products.filter((p) => p.quantity <= 0).length;

  useEffect(() => {
    document.documentElement.style.setProperty("--brand", settings.primaryColor);
  }, [settings.primaryColor]);

  return (
    <div
      className="flex min-h-screen"
      style={{ "--brand": settings.primaryColor } as CSSProperties}
    >
      {/* Sidebar — desktop */}
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[#12291b] text-white lg:flex">
        <div className="flex items-center gap-3 px-5 pb-4 pt-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-lg font-bold">
            {settings.logoText || "MS"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">{settings.storeName}</p>
            <p className="text-xs text-white/60">Inventory Management</p>
          </div>
        </div>
        <nav className="nice-scroll flex-1 overflow-y-auto px-3 pb-4">
          {NAV.map((section) => (
            <div key={section.group} className="mb-4">
              <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-widest text-white/40">
                {section.group}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = view === item.key;
                  const alert =
                    item.key === "inventory" ? lowCount + outCount : 0;
                  return (
                    <li key={item.key}>
                      <button
                        onClick={() => setView(item.key)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                          active
                            ? "bg-white text-[#12291b] shadow"
                            : "text-white/85 hover:bg-white/10"
                        }`}
                      >
                        <Icon name={item.icon} className="w-5 text-center" />
                        <span className="flex-1 text-left">{item.label}</span>
                        {alert > 0 && (
                          <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {alert}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-white/60">{user.role}</p>
            </div>
            <button
              onClick={() => void logout()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20"
              aria-label="Log out"
              title="Log out"
            >
              <Icon name="arrow-right-from-bracket" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand)] text-sm font-bold text-white lg:hidden">
            {settings.logoText || "MS"}
          </span>
          <h1 className="flex-1 truncate text-lg font-bold text-stone-800">
            {TITLES[view]}
          </h1>
          {busy && (
            <span className="text-sm text-stone-400">
              <Icon name="circle-notch" className="animate-spin" />
            </span>
          )}
          <span className="hidden items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600 sm:flex">
            <Icon name="user" /> {user.name} · {user.role}
          </span>
          <button
            onClick={() => void logout()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 lg:hidden"
            aria-label="Log out"
          >
            <Icon name="arrow-right-from-bracket" />
          </button>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-4 lg:px-6 lg:pb-8">
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
        </main>

        {/* Bottom nav — mobile */}
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur lg:hidden">
          <div className="mx-auto grid max-w-lg grid-cols-5">
            {MOBILE_NAV.map((item) => {
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${
                    active ? "text-[var(--brand)]" : "text-stone-400"
                  }`}
                >
                  <Icon name={item.icon} className="text-lg" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <PrintHost />

      {toast && (
        <div className="no-print fixed bottom-20 left-1/2 z-[60] w-auto max-w-[92vw] -translate-x-1/2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white shadow-xl lg:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
