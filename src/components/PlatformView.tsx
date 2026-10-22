"use client";

import { useState } from "react";
import {
  extendStorePlanAction,
  fetchPlatformData,
  logoutAction,
  platformSetPlan,
  platformSetStoreStatus,
} from "@/server/actions";
import type { PlatformDataDTO } from "@/lib/types";
import { fmtDate, fmtDateTime, peso } from "@/lib/format";
import { Badge, Card, EmptyState, Icon, Modal, SectionTitle, btnGhost, btnPrimary, inputCls, labelCls } from "./ui";

const PLAN_META: Record<string, { label: string; price: number }> = {
  free: { label: "Free", price: 0 },
  pro: { label: "Pro", price: 499 },
  business: { label: "Business", price: 1999 },
};

const FEEDBACK_LABEL: Record<string, string> = {
  issue: "Issue",
  feature: "Feature request",
  feedback: "Feedback",
};

/**
 * Platform-owner console: store stats, plan assignment, suspend/activate,
 * and the feedback inbox. Store sales/inventory are NOT shown here — each
 * store's data stays private to that store.
 */
export function PlatformView({
  userName,
  initialData,
}: {
  userName: string;
  initialData: PlatformDataDTO;
}) {
  const [data, setData] = useState(initialData);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [planEdit, setPlanEdit] = useState<{
    storeId: number;
    storeName: string;
    planId: string;
    expiresAt: string;
    /** The store's saved expiry (yyyy-mm-dd, "" when none) — the base
     *  the quick-extend chips count from. */
    currentExpiresAt: string;
  } | null>(null);

  const refresh = async () => setData(await fetchPlatformData());

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
      setToast(okMsg);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setTimeout(() => setToast(""), 3200);
    }
  };

  const logout = async () => {
    await logoutAction();
    window.location.href = "/login";
  };

  /**
   * Quick-extend for the Set Plan modal: fills the expiry field with the
   * store's current expiry + N months, or today + N months when the
   * current expiry has already passed (or none is set). The field stays
   * editable afterwards; nothing is saved until "Save plan" is clicked.
   */
  const applyExtend = (months: number) => {
    if (!planEdit) return;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let base = today;
    if (planEdit.currentExpiresAt) {
      const cur = new Date(`${planEdit.currentExpiresAt}T00:00:00`);
      if (!Number.isNaN(cur.getTime()) && cur.getTime() > today.getTime()) {
        base = cur;
      }
    }
    const next = new Date(base.getFullYear(), base.getMonth() + months, base.getDate());
    const iso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(
      next.getDate(),
    ).padStart(2, "0")}`;
    setPlanEdit({ ...planEdit, expiresAt: iso });
  };

  const statCards = [
    { icon: "store", label: "Total stores", value: String(data.totalStores) },
    { icon: "users", label: "Total users", value: String(data.totalUsers) },
    ...data.perPlan.map((p) => ({
      icon: "crown",
      label: `${PLAN_META[p.planId]?.label ?? p.planId} stores`,
      value: String(p.count),
    })),
  ];

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-stone-200 bg-[#12291b] px-4 py-3 text-white lg:px-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
          <Icon name="boxes-stacked" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">Platform Console</p>
          <p className="text-xs text-white/60">Inventory Management System — operator view</p>
        </div>
        <span className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold sm:flex">
          <Icon name="user-shield" /> {userName} · Platform Admin
        </span>
        <button
          onClick={() => void logout()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20"
          aria-label="Log out"
          title="Log out"
        >
          <Icon name="arrow-right-from-bracket" />
        </button>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 lg:px-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {statCards.map((c) => (
            <Card key={c.label} className="p-4">
              <span className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Icon name={c.icon} />
              </span>
              <p className="text-lg font-bold text-stone-800">{c.value}</p>
              <p className="text-xs font-semibold text-stone-500">{c.label}</p>
            </Card>
          ))}
        </div>

        <Card className="p-5">
          <SectionTitle icon="store" title={`Stores (${data.stores.length})`} />
          {data.stores.length === 0 ? (
            <EmptyState icon="store" title="No stores yet" hint="Stores appear here when owners register." />
          ) : (
            <div className="nice-scroll overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-xs uppercase text-stone-400">
                    <th className="py-2 pr-3">Store</th>
                    <th className="py-2 pr-3">Owner</th>
                    <th className="py-2 pr-3">Plan</th>
                    <th className="py-2 pr-3">Users</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Created</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {data.stores.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-stone-800">{s.name}</p>
                        <p className="text-xs text-stone-400">
                          /{s.slug}
                          {!s.setupCompleted && " · setup not finished"}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3 text-stone-500">
                        {s.ownerName || "—"}
                        {s.ownerEmail && <span className="block text-xs">{s.ownerEmail}</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={s.planId === "free" ? "stone" : "green"}>
                          {PLAN_META[s.planId]?.label ?? s.planId}
                        </Badge>
                        <span className="block text-xs text-stone-400">
                          {s.planId === "free"
                            ? "no expiry"
                            : s.planExpiresAt
                              ? `until ${fmtDate(s.planExpiresAt)}`
                              : "no expiry set"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-stone-600">{s.usersCount}</td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={s.status === "active" ? "green" : "red"}>
                          {s.status === "active" ? "Active" : "Suspended"}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-stone-500">{fmtDate(s.createdAt)}</td>
                      <td className="py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            className={btnGhost}
                            disabled={busy}
                            onClick={() =>
                              setPlanEdit({
                                storeId: s.id,
                                storeName: s.name,
                                planId: s.planId,
                                expiresAt: s.planExpiresAt ? s.planExpiresAt.slice(0, 10) : "",
                                currentExpiresAt: s.planExpiresAt
                                  ? s.planExpiresAt.slice(0, 10)
                                  : "",
                              })
                            }
                          >
                            <Icon name="crown" /> Set plan
                          </button>
                          {s.planId !== "free" && (
                            <button
                              className={btnGhost}
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  () => extendStorePlanAction({ storeId: s.id }),
                                  `${s.name} extended by 1 month.`,
                                )
                              }
                            >
                              <Icon name="calendar-plus" /> Extend
                            </button>
                          )}
                          {s.status === "active" ? (
                            <button
                              className={btnGhost}
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  () => platformSetStoreStatus({ storeId: s.id, status: "suspended" }),
                                  `${s.name} suspended — its users can no longer sign in.`,
                                )
                              }
                            >
                              <Icon name="ban" /> Suspend
                            </button>
                          ) : (
                            <button
                              className={btnGhost}
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  () => platformSetStoreStatus({ storeId: s.id, status: "active" }),
                                  `${s.name} reactivated.`,
                                )
                              }
                            >
                              <Icon name="circle-check" /> Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-stone-400">
            Plan changes take effect immediately. An expired paid plan behaves as Free until
            renewed here. Store sales and inventory are private to each store and are never
            shown in this console.
          </p>
        </Card>

        <Card className="p-5">
          <SectionTitle icon="inbox" title={`Feedback inbox (${data.feedback.length})`} />
          {data.feedback.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="No feedback yet"
              hint="Messages from the in-app help button (Report an issue / Suggest a feature / Share feedback) land here."
            />
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.feedback.map((f) => (
                <li key={f.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={f.type === "issue" ? "red" : f.type === "feature" ? "amber" : "stone"}>
                      {FEEDBACK_LABEL[f.type] ?? f.type}
                    </Badge>
                    <span className="text-sm font-semibold text-stone-700">
                      {f.storeName || "Platform"}
                    </span>
                    <span className="text-xs text-stone-400">
                      {f.staffName} · {fmtDateTime(f.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
                    {f.message}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>

      <Modal
        open={planEdit !== null}
        onClose={() => setPlanEdit(null)}
        title={planEdit ? `Set plan — ${planEdit.storeName}` : "Set plan"}
        icon="crown"
      >
        {planEdit && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Plan</label>
              <select
                className={inputCls}
                value={planEdit.planId}
                onChange={(e) => setPlanEdit({ ...planEdit, planId: e.target.value })}
              >
                {Object.entries(PLAN_META).map(([id, m]) => (
                  <option key={id} value={id}>
                    {m.label} — {m.price === 0 ? "₱0" : `${peso(m.price)}/month`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Plan expiry (optional)</label>
              <input
                className={inputCls}
                type="date"
                value={planEdit.expiresAt}
                onChange={(e) => setPlanEdit({ ...planEdit, expiresAt: e.target.value })}
                disabled={planEdit.planId === "free"}
              />
              <p className="mt-1 text-xs text-stone-400">
                Leave blank for no expiry. After this date the store falls back to the Free
                plan until you renew it here. Free plans ignore expiry.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-stone-400">Quick extend:</span>
                {[
                  { months: 1, label: "+1 month" },
                  { months: 3, label: "+3 months" },
                  { months: 12, label: "+12 months" },
                ].map((c) => (
                  <button
                    key={c.months}
                    type="button"
                    className={btnGhost}
                    disabled={planEdit.planId === "free"}
                    onClick={() => applyExtend(c.months)}
                  >
                    <Icon name="calendar-plus" /> {c.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-stone-400">
                Quick extend counts from the store&apos;s current expiry, or from today
                when that expiry has already passed. You can still adjust the date
                afterwards before saving.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setPlanEdit(null)}>
                Cancel
              </button>
              <button
                className={btnPrimary}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await platformSetPlan({
                      storeId: planEdit.storeId,
                      planId: planEdit.planId,
                      expiresAt: planEdit.expiresAt
                        ? new Date(`${planEdit.expiresAt}T23:59:59`).toISOString()
                        : null,
                    });
                    setPlanEdit(null);
                  }, `Plan updated for ${planEdit.storeName}.`)
                }
              >
                <Icon name="floppy-disk" /> Save plan
              </button>
            </div>
          </div>
        )}
      </Modal>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] w-auto max-w-[92vw] -translate-x-1/2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
