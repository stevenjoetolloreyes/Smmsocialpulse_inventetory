"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "./store";
import {
  Badge, Card, EmptyState, Icon, Modal, SectionTitle,
  btnGhost, btnPrimary, inputCls, labelCls,
} from "./ui";
import { ProductThumb } from "./Qr";
import { fmtDateTime } from "@/lib/format";
import { permanentDeleteProduct, restoreProduct, saveCategory, saveSettings, saveStaff } from "@/server/actions";
import type { SettingsDTO, StaffDTO } from "@/lib/types";

const COLOR_PRESETS = ["#14532d", "#1d4ed8", "#7c3aed", "#b91c1c", "#0f766e", "#b45309", "#111827"];

type SettingsTab = "general" | "users" | "security" | "deleted";

/** Searchable index of the settings this page actually contains. */
const SETTINGS_INDEX: { tab: SettingsTab; label: string; hint: string; keywords: string }[] = [
  { tab: "general", label: "Store profile", hint: "Store name, phone, email, address, city, province, ZIP", keywords: "store name phone email address city province zip profile" },
  { tab: "general", label: "Store logo & initials", hint: "Logo image shown on receipts and the sidebar", keywords: "logo image upload initials receipt sidebar branding" },
  { tab: "general", label: "Store code (staff sign-in)", hint: "The code staff enter with their username and password", keywords: "store code staff sign in login access" },
  { tab: "general", label: "Date format", hint: "How dates are shown across the app", keywords: "date format mdy dmy iso" },
  { tab: "general", label: "Primary color & appearance", hint: "Brand color for the sidebar, buttons and highlights", keywords: "primary color theme appearance brand dark light" },
  { tab: "general", label: "Product categories", hint: "Add and review product categories", keywords: "categories products add" },
  { tab: "users", label: "User management", hint: "Add, edit, activate or deactivate store users", keywords: "users staff accounts roles password manager cashier add user" },
  { tab: "security", label: "Sign-in activity", hint: "Recent successful and failed sign-ins for this store", keywords: "security login activity failed sign in attempts history" },
  { tab: "security", label: "Security & POS rules", hint: "Amount tendered, returns, stock alerts", keywords: "security pos rules tendered returns stock alerts" },
  { tab: "deleted", label: "Recently deleted", hint: "Restore or permanently delete removed products", keywords: "deleted restore trash products permanently" },
];

export function SettingsView() {
  const { data } = useStore();
  const [tab, setTab] = useState<SettingsTab>("general");
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SETTINGS_INDEX.filter(
      (e) => e.label.toLowerCase().includes(q) || e.keywords.includes(q),
    );
  }, [query]);

  return (
    <div className="space-y-4">
      {/* Settings search */}
      <div className="relative max-w-md">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-stone-400">
          <Icon name="magnifying-glass" />
        </span>
        <input
          className={`${inputCls} pl-10 pr-9`}
          placeholder="Search settings…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search settings"
        />
        {query && (
          <button
            className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            <Icon name="xmark" />
          </button>
        )}
      </div>

      {query.trim() !== "" ? (
        <Card className="max-w-2xl p-3">
          {matches.length === 0 ? (
            <EmptyState
              icon="magnifying-glass"
              title={`No settings match "${query.trim()}"`}
              hint="Try a different word — for example “logo”, “users” or “security”."
            />
          ) : (
            <ul className="divide-y divide-stone-100">
              {matches.map((m) => (
                <li key={m.label}>
                  <button
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-stone-50"
                    onClick={() => {
                      setTab(m.tab);
                      setQuery("");
                    }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                      <Icon name="gear" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-stone-700">{m.label}</span>
                      <span className="block truncate text-xs text-stone-400">{m.hint}</span>
                    </span>
                    <Icon name="chevron-right" className="text-xs text-stone-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["general", "General", "store"],
                ["users", "User Management", "users"],
                ["security", "Security", "shield-halved"],
                ["deleted", "Recently Deleted", "trash-can-arrow-up"],
              ] as const
            ).map(([key, label, icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${
                  tab === key ? "bg-[var(--brand)] text-white" : "bg-white text-stone-600 shadow-sm"
                }`}
              >
                <Icon name={icon} /> {label}
                {key === "deleted" && data.deletedProducts.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {data.deletedProducts.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === "general" && <GeneralTab />}
          {tab === "users" && <UsersTab />}
          {tab === "security" && <SecurityTab />}
          {tab === "deleted" && <DeletedTab />}
        </>
      )}
    </div>
  );
}

function GeneralTab() {
  const { data, run, showToast } = useStore();
  const s = data.settings;
  const [form, setForm] = useState<SettingsDTO>({ ...s, security: { ...s.security } });
  const [saved, setSaved] = useState<SettingsDTO>({ ...s, security: { ...s.security } });
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">("idle");

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  // Warn before leaving with unsaved changes (refresh / close / navigate).
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const set = <K extends keyof SettingsDTO>(k: K, v: SettingsDTO[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!/^#[0-9a-fA-F]{6}$/.test(form.primaryColor)) {
      showToast("Primary color must be a valid hex color, like #14532d.");
      setSaveState("failed");
      return;
    }
    setSaving(true);
    try {
      await run(() => saveSettings(form));
      setSaved({ ...form, security: { ...form.security } });
      setSaveState("saved");
      showToast("Settings saved.");
    } catch {
      setSaveState("failed");
      /* error toasted by run(); the form keeps the entered values */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="p-5">
        <SectionTitle icon="store" title="Store Profile" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Store name</label>
            <input className={inputCls} value={form.storeName} onChange={(e) => set("storeName", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input className={inputCls} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Address</label>
            <textarea className={inputCls} rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>City</label>
            <input className={inputCls} value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Province</label>
            <input className={inputCls} value={form.province} onChange={(e) => set("province", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>ZIP code</label>
            <input className={inputCls} value={form.zip} onChange={(e) => set("zip", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Store logo image (optional)</label>
            <div className="flex items-center gap-2.5">
              {form.logoData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoData} alt="" className="h-9 w-9 rounded-lg object-cover ring-1 ring-stone-200" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-400">
                  <Icon name="image" />
                </span>
              )}
              <label className={`${btnGhost} cursor-pointer`}>
                <Icon name="upload" /> Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 200 * 1024) {
                      showToast("Logo image must be under 200 KB.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () =>
                      set("logoData", typeof reader.result === "string" ? reader.result : "");
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {form.logoData && (
                <button className={btnGhost} onClick={() => set("logoData", "")}>
                  Remove
                </button>
              )}
            </div>
          </div>
          <div>
            <label className={labelCls}>Logo initials (receipts & sidebar)</label>
            <input className={inputCls} maxLength={3} value={form.logoText} onChange={(e) => set("logoText", e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className={labelCls}>Store code (staff sign-in)</label>
            <input className={inputCls} value={form.storeCode} onChange={(e) => set("storeCode", e.target.value)} placeholder="e.g. STR-A1B2C3" />
            <p className="mt-1 text-xs text-stone-400">
              Required. Every staff member must enter this code together with their
              username and password to sign in. It identifies your store — share it
              only with your own staff.
            </p>
          </div>
          <div>
            <label className={labelCls}>Date format</label>
            <select className={inputCls} value={form.dateFormat} onChange={(e) => set("dateFormat", e.target.value as SettingsDTO["dateFormat"])}>
              <option value="mdy">Oct 22, 2026 (Month Day, Year)</option>
              <option value="dmy">22 Oct 2026 (Day Month Year)</option>
              <option value="iso">2026-10-22 (ISO)</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className={labelCls}>Primary color</label>
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                className={`h-9 w-9 rounded-full border-2 ${form.primaryColor === c ? "border-stone-800" : "border-transparent"}`}
                style={{ background: c }}
                onClick={() => set("primaryColor", c)}
                aria-label={`Primary color ${c}`}
              />
            ))}
            <input
              type="color"
              className="h-9 w-12 cursor-pointer rounded-lg border border-stone-300 bg-white p-1"
              value={form.primaryColor}
              onChange={(e) => set("primaryColor", e.target.value)}
              aria-label="Custom primary color"
            />
            <span className="text-sm font-medium text-stone-500">{form.primaryColor}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className={btnPrimary} onClick={() => void save()} disabled={saving}>
            <Icon name="floppy-disk" /> {saving ? "Saving…" : "Save settings"}
          </button>
          {saving ? (
            <span className="text-xs font-semibold text-stone-400">Saving…</span>
          ) : dirty ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Unsaved changes
            </span>
          ) : saveState === "failed" ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
              <Icon name="triangle-exclamation" /> Save failed — your entries are kept, try again
            </span>
          ) : saveState === "saved" ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <Icon name="check" /> Saved
            </span>
          ) : null}
        </div>
      </Card>

      <Card className="h-fit p-5">
        <SectionTitle icon="list" title="Product Categories" />
        {data.categories.length === 0 ? (
          <p className="text-sm text-stone-400">
            No categories yet. Categories are created automatically when you add a product, or add one here.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {data.categories.map((c) => (
              <span key={c} className="rounded-full bg-stone-100 px-3 py-1 text-sm font-medium text-stone-600">
                {c}
                <span className="ml-1.5 text-xs text-stone-400">
                  ({data.products.filter((p) => p.category === c).length})
                </span>
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input
            className={inputCls}
            placeholder="New category name"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <button
            className={btnGhost}
            disabled={!newCategory.trim()}
            onClick={async () => {
              await run(() => saveCategory(newCategory));
              showToast(`Category "${newCategory.trim()}" added.`);
              setNewCategory("");
            }}
          >
            <Icon name="plus" /> Add
          </button>
        </div>
        <p className="mt-3 text-xs text-stone-400">
          The primary color drives the sidebar, buttons, links and highlights across the
          app. The login and registration screens keep the platform&apos;s own identity.
        </p>
      </Card>
    </div>
  );
}

type StaffForm = {
  id: number | null;
  name: string;
  username: string;
  password: string;
  email: string;
  role: string;
  active: boolean;
};

function UsersTab() {
  const { data, run, showToast, user } = useStore();
  const [form, setForm] = useState<StaffForm | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await run(() => saveStaff(form));
      showToast(form.id ? "User updated." : "User added.");
      setForm(null);
    } catch {
      /* toasted */
    } finally {
      setSaving(false);
    }
  };

  const edit = (s: StaffDTO) =>
    setForm({
      id: s.id,
      name: s.name,
      username: s.username,
      password: "",
      email: s.email,
      role: s.role,
      active: s.active,
    });

  return (
    <Card className="p-5">
      <SectionTitle
        icon="users"
        title={`Users (${data.staff.length})`}
        right={
          <button
            className={btnPrimary}
            onClick={() => setForm({ id: null, name: "", username: "", password: "", email: "", role: "Cashier", active: true })}
          >
            <Icon name="user-plus" /> Add User
          </button>
        }
      />
      <div className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-900 ring-1 ring-emerald-100">
        <span className="font-semibold">Your Store Code:</span>{" "}
        <span className="font-mono font-bold tracking-wide">{data.settings.storeCode || "—"}</span>
        {" "}— give this to every staff member (manager, cashier, staff). They must enter it
        together with their username and password to sign in.
      </div>
      <div className="nice-scroll overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-xs uppercase text-stone-400">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Username</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Last login</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {data.staff.map((s) => (
              <tr key={s.id}>
                <td className="py-2.5 pr-3 font-medium text-stone-700">
                  {s.name}
                  {s.username === user.username && (
                    <span className="ml-1.5 text-xs text-stone-400">(you)</span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-stone-500">{s.username || "—"}</td>
                <td className="py-2.5 pr-3">{s.role}</td>
                <td className="py-2.5 pr-3 text-stone-500">{s.email || "—"}</td>
                <td className="py-2.5 pr-3 text-stone-500">
                  {s.lastLogin ? fmtDateTime(s.lastLogin, data.settings) : "Never"}
                </td>
                <td className="py-2.5 pr-3">
                  <Badge tone={s.active ? "green" : "red"}>{s.active ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="py-2.5">
                  <button className={btnGhost} onClick={() => edit(s)}>
                    <Icon name="pen" /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-stone-400">
        Passwords are stored hashed (bcrypt) and checked on the server at login. Leave the
        password field blank when editing to keep the current one. Deactivating a user blocks
        their login immediately.
      </p>

      <Modal open={form !== null} onClose={() => setForm(null)} title={form?.id ? "Edit User" : "Add User"} icon="user-gear">
        {form && (
          <div className="space-y-3">
            <div className="rounded-xl bg-stone-50 px-3.5 py-2.5 text-xs leading-relaxed text-stone-500">
              This user signs in with your Store Code:{" "}
              <span className="font-mono font-bold tracking-wide text-stone-700">
                {data.settings.storeCode || "—"}
              </span>{" "}
              — share it with them; they must enter it together with their username and
              password on the Branch Staff sign-in tab.
            </div>
            <div>
              <label className={labelCls}>Full name *</label>
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Username *</label>
                <input className={inputCls} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Role</label>
                <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option>Administrator</option>
                  <option>Manager</option>
                  <option>Cashier</option>
                  <option>Staff</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>{form.id ? "New password (blank = keep current)" : "Password *"}</label>
              <input className={inputCls} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-800"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Account active (can log in)
            </label>
            <div className="flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setForm(null)}>
                Cancel
              </button>
              <button className={btnPrimary} onClick={() => void submit()} disabled={saving || !form.name.trim()}>
                <Icon name="floppy-disk" /> {saving ? "Saving…" : "Save user"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function SecurityTab() {
  const { data, run, showToast, user } = useStore();
  const s = data.settings;
  const [security, setSecurity] = useState({ ...s.security });
  const [saving, setSaving] = useState(false);

  const events = data.loginEvents;
  const successCount = events.filter((e) => e.success).length;
  const failedCount = events.length - successCount;
  const lastSuccess = events.find((e) => e.success);

  const toggles: { key: keyof typeof security; label: string; hint: string; icon: string }[] = [
    {
      key: "requireTendered",
      label: "Require amount tendered for cash sales",
      hint: "Cash checkouts must enter an amount that covers the total before completing.",
      icon: "money-bill-wave",
    },
    {
      key: "allowReturns",
      label: "Allow returns & exchanges",
      hint: "Shows the return controls on sale details in the Sales Report.",
      icon: "rotate-left",
    },
    {
      key: "showStockAlerts",
      label: "Show stock alerts",
      hint: "Low / out-of-stock badges on the sidebar and dashboard.",
      icon: "bell",
    },
  ];

  const save = async () => {
    setSaving(true);
    try {
      await run(() => saveSettings({ ...s, security }));
      showToast("Security settings saved.");
    } catch {
      /* toasted */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid max-w-2xl gap-4">
      {/* Security Center — real sign-in activity recorded by the login actions */}
      <Card className="p-5">
        <SectionTitle icon="shield-halved" title="Security Center" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-stone-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">
              Successful sign-ins
            </p>
            <p className="mt-1 text-xl font-extrabold text-stone-800">{successCount}</p>
            <p className="text-xs text-stone-400">in recent activity</p>
          </div>
          <div className="rounded-2xl bg-stone-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">
              Failed attempts
            </p>
            <p className={`mt-1 text-xl font-extrabold ${failedCount > 0 ? "text-red-600" : "text-stone-800"}`}>
              {failedCount}
            </p>
            <p className="text-xs text-stone-400">in recent activity</p>
          </div>
          <div className="rounded-2xl bg-stone-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">
              Last successful login
            </p>
            <p className="mt-1 truncate text-sm font-extrabold leading-7 text-stone-800">
              {lastSuccess ? lastSuccess.username : "—"}
            </p>
            <p className="text-xs text-stone-400">
              {lastSuccess ? fmtDateTime(lastSuccess.createdAt, s) : "No record yet"}
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          Recent sign-in activity (latest {events.length || 30})
        </p>
        {events.length === 0 ? (
          <EmptyState
            icon="shield-halved"
            title="No sign-in activity recorded yet."
            hint="Successful and failed sign-ins for this store are recorded from now on and will appear here."
          />
        ) : (
          <ul className="mt-1 divide-y divide-stone-100">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs ${
                    e.success ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                  }`}
                >
                  <Icon name={e.success ? "check" : "xmark"} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-stone-700">
                    {e.username || "Unknown user"}
                    <span className="ml-2 text-xs font-medium capitalize text-stone-400">{e.kind}</span>
                  </span>
                  <span className="block text-xs text-stone-400">
                    {fmtDateTime(e.createdAt, s)}{e.ip ? ` · IP ${e.ip}` : ""}
                  </span>
                </span>
                {e.success ? (
                  <Badge tone="green">Success</Badge>
                ) : (
                  <Badge tone="red">Failed</Badge>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 rounded-2xl bg-stone-50 px-4 py-3 text-sm leading-relaxed text-stone-500">
          <p>
            <span className="font-semibold text-stone-700">This session:</span>{" "}
            {user.name} ({user.role}) — signed in through the{" "}
            {user.isPlatformAdmin ? "platform admin" : "store"} door.
          </p>
          <p className="mt-1">
            Sessions are secure signed cookies (30 days with “Remember me”, otherwise
            until the browser closes). There is no per-device session list to revoke —
            signing out on a device ends that device&apos;s session.
          </p>
        </div>
      </Card>

      <Card className="p-5">
      <SectionTitle icon="shield-halved" title="Security & POS Rules" />
      <div className="space-y-3">
        {toggles.map((t) => (
          <div key={t.key} className="flex items-start gap-3 rounded-2xl bg-stone-50 px-4 py-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-stone-500 shadow-sm">
              <Icon name={t.icon} />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-stone-700">{t.label}</p>
              <p className="text-sm text-stone-500">{t.hint}</p>
            </div>
            <button
              role="switch"
              aria-checked={security[t.key]}
              onClick={() => setSecurity((v) => ({ ...v, [t.key]: !v[t.key] }))}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${security[t.key] ? "bg-[var(--brand)]" : "bg-stone-300"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${security[t.key] ? "left-[22px]" : "left-0.5"}`}
              />
            </button>
          </div>
        ))}
      </div>
      <button className={`${btnPrimary} mt-4`} onClick={() => void save()} disabled={saving}>
        <Icon name="floppy-disk" /> {saving ? "Saving…" : "Save security settings"}
      </button>
      </Card>
    </div>
  );
}

function DeletedTab() {
  const { data, run, showToast } = useStore();
  return (
    <Card className="p-5">
      <SectionTitle icon="trash-can-arrow-up" title={`Recently Deleted (${data.deletedProducts.length})`} />
      {data.deletedProducts.length === 0 ? (
        <EmptyState
          icon="trash-can"
          title="Nothing here"
          hint="Products you delete from Inventory land here first, with their batches and history intact, until you restore or permanently delete them."
        />
      ) : (
        <ul className="divide-y divide-stone-100">
          {data.deletedProducts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
              <ProductThumb name={p.name} imageUrl={p.imageUrl} size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-stone-700">{p.name}</p>
                <p className="text-xs text-stone-400">
                  {p.code} · deleted {p.deletedAt ? fmtDateTime(p.deletedAt, data.settings) : ""} · {p.batchCount} batch(es) kept
                </p>
              </div>
              <button
                className={btnPrimary}
                onClick={async () => {
                  await run(() => restoreProduct(p.id));
                  showToast(`${p.name} restored to Inventory.`);
                }}
              >
                <Icon name="trash-can-arrow-up" /> Restore
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                onClick={async () => {
                  if (!window.confirm(`Permanently delete ${p.name}? This removes the product, its units, batches, receivings and movements. Sales history keeps the product name and OR numbers.`)) return;
                  await run(() => permanentDeleteProduct(p.id));
                  showToast(`${p.name} permanently deleted.`);
                }}
              >
                <Icon name="trash" /> Delete forever
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
