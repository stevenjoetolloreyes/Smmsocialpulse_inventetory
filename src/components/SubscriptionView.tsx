"use client";

import { useStore } from "./store";
import { Badge, Card, Icon, SectionTitle } from "./ui";
import { fmtDate, peso } from "@/lib/format";
import type { PlanDTO } from "@/lib/types";

function featureRows(plan: PlanDTO): { label: string; ok: boolean }[] {
  return [
    {
      label:
        plan.maxUsers === 0
          ? "Unlimited active users"
          : `Up to ${plan.maxUsers} active users`,
      ok: true,
    },
    { label: "Product image upload", ok: plan.imageUpload },
    { label: "Report CSV export", ok: plan.reportExport },
    { label: "POS, inventory, QR scanning, receiving & reports", ok: true },
  ];
}

/**
 * The store's subscription page: current plan + usage, the other plans
 * with prices, and an honest upgrade note — upgrades are activated by the
 * platform owner after payment; there is no in-app checkout.
 */
export function SubscriptionView() {
  const { data } = useStore();
  const { plan, plans, store } = data;
  const activeUsers = data.staff.filter((s) => s.active).length;
  const others = plans.filter((p) => p.id !== plan.id);
  const expiredPaid =
    store.planId !== "free" && store.effectivePlanId === "free";

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle icon="crown" title="Current plan" />
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-52 flex-1">
            <p className="flex items-center gap-2 text-2xl font-extrabold text-stone-800">
              {plan.name}
              <Badge tone="green">Active</Badge>
            </p>
            <p className="mt-1 text-lg font-bold text-[var(--brand)]">
              {plan.priceMonthly === 0 ? "₱0" : `${peso(plan.priceMonthly)}/month`}
            </p>
            {store.planExpiresAt && store.planId !== "free" && (
              <p className="mt-1 text-sm text-stone-500">
                Paid plan on record: <strong>{store.planId}</strong>, expires{" "}
                {fmtDate(store.planExpiresAt)}.
              </p>
            )}
            {expiredPaid && (
              <p className="mt-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
                Your paid plan expired on {fmtDate(store.planExpiresAt)} — the store is
                currently running on Free limits until the platform owner renews it.
              </p>
            )}
          </div>
          <div className="min-w-64 flex-1 rounded-2xl bg-stone-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Usage</p>
            <p className="mt-1.5 text-sm font-semibold text-stone-700">
              Users: {activeUsers} of {plan.maxUsers === 0 ? "unlimited" : plan.maxUsers} active
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-[var(--brand)]"
                style={{
                  width:
                    plan.maxUsers === 0
                      ? "12%"
                      : `${Math.min(100, (activeUsers / Math.max(plan.maxUsers, 1)) * 100)}%`,
                }}
              />
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {featureRows(plan).map((f) => (
                <li key={f.label} className="flex items-center gap-2">
                  <span className={f.ok ? "text-emerald-600" : "text-red-500"}>
                    <Icon name={f.ok ? "check" : "xmark"} />
                  </span>
                  <span className={f.ok ? "text-stone-700" : "text-stone-400"}>{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {others.map((p) => (
          <Card key={p.id} className="p-5">
            <p className="text-lg font-extrabold text-stone-800">{p.name}</p>
            <p className="mt-0.5 text-base font-bold text-[var(--brand)]">
              {p.priceMonthly === 0 ? "₱0" : `${peso(p.priceMonthly)}/month`}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {featureRows(p).map((f) => (
                <li key={f.label} className="flex items-center gap-2">
                  <span className={f.ok ? "text-emerald-600" : "text-red-500"}>
                    <Icon name={f.ok ? "check" : "xmark"} />
                  </span>
                  <span className={f.ok ? "text-stone-700" : "text-stone-400"}>{f.label}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <SectionTitle icon="circle-info" title="How upgrades work" />
        <p className="max-w-3xl text-sm leading-relaxed text-stone-600">
          Upgrades are activated by the <strong>platform owner</strong> after payment —
          there is no checkout inside this app. To move {store.name} to a paid plan, contact
          the platform owner, settle the plan fee with them, and they will switch your
          store&apos;s plan (and its expiry date) from the platform console. Your new limits
          apply immediately after that.
        </p>
      </Card>
    </div>
  );
}
