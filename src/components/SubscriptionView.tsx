"use client";

import { useState } from "react";
import { useStore } from "./store";
import { Badge, Card, EmptyState, Icon, SectionTitle } from "./ui";
import { fmtDate, fmtDateTime, peso } from "@/lib/format";
import { submitFeedbackAction } from "@/server/actions";
import type { PlanDTO } from "@/lib/types";

/** Short original tier captions (this platform's own words). */
const PLAN_CAPTION: Record<string, string> = {
  free: "The essentials for a small store that is just getting started.",
  pro: "More room for a growing team, with every feature switched on.",
  business: "Our highest tier — no user cap for larger operations.",
};

const PLAN_BLURB: Record<string, string> = {
  free: "Start selling and tracking stock with the core tools, at no cost.",
  pro: "For stores with a bigger team that need product images and report exports.",
  business: "For busy operations that never want to count user seats.",
};

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

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I upgrade my plan?",
    a: "Plans are switched on by the platform owner. Send a request from a plan card below (or through the help button), settle the plan fee with the owner directly, and the new plan is applied to your store right away — no restart, no waiting period.",
  },
  {
    q: "What happens when my plan expires?",
    a: "Your store keeps working, but the Free plan's limits apply — fewer active users, and no product image uploads or report exports — until the owner renews you. Your products, sales and history are never deleted.",
  },
  {
    q: "Can I change plans at any time?",
    a: "Yes. Ask the platform owner whenever you need a different plan. Changes take effect immediately, and paid plans get a fresh expiry date when they are set or renewed.",
  },
  {
    q: "Is there a checkout inside the app?",
    a: "No — there is no card payment in this app. All plan payments are arranged with the platform owner outside the app, and the owner then updates your plan here.",
  },
];

/**
 * The store's subscription page: current-plan strip, account overview,
 * Monthly/Yearly pricing for all three plans, a compare table, plan
 * status, billing history, and an FAQ. Upgrades are granted by the
 * platform owner — the plan cards file a real request through the
 * feedback inbox instead of pretending to check out.
 */
export function SubscriptionView() {
  const { data, run, showToast } = useStore();
  const { plan, plans, store, settings } = data;
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [sendingId, setSendingId] = useState<string | null>(null);

  const activeUsers = data.staff.filter((s) => s.active).length;
  const expiredPaid = store.planId !== "free" && store.effectivePlanId === "free";
  const paidOnRecord = store.planId !== "free";
  const expiry = store.planExpiresAt ? new Date(store.planExpiresAt) : null;
  const daysLeft = expiry
    ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000))
    : null;

  const planHistory = data.history.filter((h) => h.entityType === "Plan");

  const requestPlan = async (p: PlanDTO) => {
    setSendingId(p.id);
    try {
      await run(() =>
        submitFeedbackAction(
          "feature",
          p.priceMonthly > plan.priceMonthly
            ? `I'd like to upgrade to ${p.name}`
            : `I'd like to switch to the ${p.name} plan`,
        ),
      );
      showToast(`Request sent — the platform owner will see it in their console.`);
    } catch {
      /* toasted by run() */
    } finally {
      setSendingId(null);
    }
  };

  const priceFor = (p: PlanDTO): { amount: string; period: string } => {
    if (p.priceMonthly === 0) return { amount: "₱0", period: "forever" };
    return cycle === "monthly"
      ? { amount: peso(p.priceMonthly), period: "/ month" }
      : { amount: peso(p.priceYearly), period: "/ year" };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-stone-800">Subscription</h2>
        <p className="mt-0.5 text-sm text-stone-500">
          Your store&apos;s plan, what it includes, and how to change it.
        </p>
      </div>

      {/* Current plan strip */}
      <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
          Current plan
        </p>
        <p className="text-sm font-extrabold text-emerald-900">{plan.name}</p>
        {expiredPaid && (
          <span className="text-xs font-medium text-emerald-700">
            (paid plan on record expired — Free limits apply)
          </span>
        )}
      </div>

      {/* Account overview */}
      <div>
        <SectionTitle icon="gauge-high" title="Account overview" />
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Icon name="crown" />
            </span>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
              Current Plan
            </p>
            <p className="mt-1 text-lg font-extrabold text-stone-800">{plan.name}</p>
            <p className="mt-0.5 text-sm leading-snug text-stone-500">
              {PLAN_CAPTION[plan.id] ?? ""}
            </p>
          </Card>

          <Card className="p-5">
            <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <Icon name="calendar-days" />
            </span>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
              Billing Period
            </p>
            {!paidOnRecord ? (
              <>
                <p className="mt-1 text-lg font-extrabold text-stone-800">
                  No renewal required
                </p>
                <p className="mt-0.5 text-sm leading-snug text-stone-500">
                  Lifetime free access
                </p>
              </>
            ) : expiredPaid ? (
              <>
                <p className="mt-1 text-lg font-extrabold text-amber-700">
                  Expired — now on Free
                </p>
                <p className="mt-0.5 text-sm leading-snug text-stone-500">
                  The paid plan ended {fmtDate(store.planExpiresAt, settings)}. Ask the
                  platform owner to renew it.
                </p>
              </>
            ) : expiry ? (
              <>
                <p className="mt-1 text-lg font-extrabold text-stone-800">
                  {fmtDate(store.planExpiresAt, settings)}
                </p>
                <p className="mt-0.5 text-sm leading-snug text-stone-500">
                  {daysLeft === 0
                    ? "Expires today"
                    : `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-lg font-extrabold text-stone-800">No expiry set</p>
                <p className="mt-0.5 text-sm leading-snug text-stone-500">
                  Active until the platform owner changes it
                </p>
              </>
            )}
          </Card>

          <Card className="p-5">
            <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Icon name="peso-sign" />
            </span>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
              Plan Price
            </p>
            <p className="mt-1 text-lg font-extrabold text-stone-800">
              {plan.priceMonthly === 0 ? "₱0" : `${peso(plan.priceMonthly)} / month`}
            </p>
            <p className="mt-0.5 text-sm leading-snug text-stone-500">
              {plan.priceMonthly === 0
                ? "Free forever"
                : `or ${peso(plan.priceYearly)} / year on the yearly term`}
            </p>
          </Card>
        </div>
      </div>

      {/* Monthly / Yearly toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full bg-stone-200/70 p-1">
          {(
            [
              { key: "monthly", label: "Monthly" },
              { key: "yearly", label: "Yearly" },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              onClick={() => setCycle(o.key)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                cycle === o.key
                  ? "bg-white text-stone-800 shadow"
                  : "text-stone-500 hover:text-stone-700"
              }`}
              aria-pressed={cycle === o.key}
            >
              {o.label}
              {o.key === "yearly" && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    cycle === "yearly"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-stone-300/70 text-stone-500"
                  }`}
                >
                  Save 17%
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-400">
          Yearly billing costs ten monthly payments — two months free.
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.id === plan.id;
          const isRecorded = p.id === store.planId;
          const price = priceFor(p);
          return (
            <Card
              key={p.id}
              className={`flex flex-col p-5 ${isCurrent ? "ring-2 ring-[var(--brand)]" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-lg font-extrabold text-stone-800">{p.name}</p>
                {isCurrent ? (
                  <Badge tone="green">Current plan</Badge>
                ) : isRecorded && expiredPaid ? (
                  <Badge tone="amber">Expired</Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm leading-snug text-stone-500">
                {PLAN_BLURB[p.id] ?? ""}
              </p>
              <p className="mt-3 text-2xl font-extrabold text-stone-800">
                {price.amount}
                <span className="ml-1 text-sm font-semibold text-stone-400">
                  {price.period === "forever" ? "· free forever" : price.period}
                </span>
              </p>
              {cycle === "yearly" && p.priceMonthly > 0 && (
                <p className="mt-0.5 text-xs font-semibold text-emerald-600">
                  Save 17% compared with paying monthly.
                </p>
              )}
              <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                {featureRows(p).map((f) => (
                  <li key={f.label} className="flex items-center gap-2">
                    <span className={f.ok ? "text-emerald-600" : "text-red-500"}>
                      <Icon name={f.ok ? "check" : "xmark"} />
                    </span>
                    <span className={f.ok ? "text-stone-700" : "text-stone-400"}>
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-stone-100 pt-3">
                {isCurrent ? (
                  <p className="text-center text-xs font-semibold text-stone-400">
                    This is the plan your store is running on now.
                  </p>
                ) : (
                  <button
                    onClick={() => void requestPlan(p)}
                    disabled={sendingId === p.id}
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icon name="paper-plane" className="mr-1.5 text-xs" />
                    {sendingId === p.id
                      ? "Sending…"
                      : p.priceMonthly > plan.priceMonthly
                        ? `Ask to upgrade to ${p.name}`
                        : `Ask about switching to ${p.name}`}
                  </button>
                )}
                {!isCurrent && (
                  <p className="mt-1.5 text-center text-[11px] leading-snug text-stone-400">
                    Plans are granted by the platform owner — this sends them a request.
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Compare features */}
      <Card className="p-5">
        <SectionTitle icon="table-columns" title="Compare features" />
        <div className="nice-scroll overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-xs uppercase text-stone-400">
                <th className="py-2 pr-3">Feature</th>
                {plans.map((p) => (
                  <th key={p.id} className="py-2 pr-3">
                    {p.name}
                    {p.id === plan.id && (
                      <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold normal-case text-emerald-700">
                        Current
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              <tr>
                <td className="py-2.5 pr-3 font-medium text-stone-600">Users</td>
                {plans.map((p) => (
                  <td key={p.id} className="py-2.5 pr-3 text-stone-700">
                    {p.maxUsers === 0 ? "Unlimited" : `Up to ${p.maxUsers} active users`}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-3 font-medium text-stone-600">
                  Product image upload
                </td>
                {plans.map((p) => (
                  <td key={p.id} className="py-2.5 pr-3">
                    <span className={p.imageUpload ? "text-emerald-600" : "text-red-500"}>
                      <Icon name={p.imageUpload ? "check" : "xmark"} />
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-3 font-medium text-stone-600">
                  Report export (CSV)
                </td>
                {plans.map((p) => (
                  <td key={p.id} className="py-2.5 pr-3">
                    <span className={p.reportExport ? "text-emerald-600" : "text-red-500"}>
                      <Icon name={p.reportExport ? "check" : "xmark"} />
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-3 font-medium text-stone-600">Support level</td>
                {plans.map((p) => (
                  <td key={p.id} className="py-2.5 pr-3 text-stone-700">
                    In-app help &amp; feedback
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Current plan status */}
      <Card className="p-5">
        <SectionTitle icon="circle-info" title="Current plan status" />
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 border-b border-stone-50 py-1.5">
            <dt className="text-stone-500">Active plan</dt>
            <dd className="font-semibold text-stone-800">{plan.name}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-stone-50 py-1.5">
            <dt className="text-stone-500">Status</dt>
            <dd>
              {expiredPaid ? (
                <Badge tone="amber">Expired — running on Free</Badge>
              ) : (
                <Badge tone="green">Active</Badge>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-stone-50 py-1.5">
            <dt className="text-stone-500">Plan on record</dt>
            <dd className="font-semibold text-stone-800">
              {plans.find((p) => p.id === store.planId)?.name ?? store.planId}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-stone-50 py-1.5">
            <dt className="text-stone-500">Current term ends</dt>
            <dd className="font-semibold text-stone-800">
              {paidOnRecord && store.planExpiresAt
                ? fmtDate(store.planExpiresAt, settings)
                : "Not applicable"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-stone-50 py-1.5">
            <dt className="text-stone-500">Term started</dt>
            <dd className="font-semibold text-stone-800">Not applicable</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-stone-50 py-1.5">
            <dt className="text-stone-500">Users</dt>
            <dd className="font-semibold text-stone-800">
              {activeUsers} of {plan.maxUsers === 0 ? "unlimited" : plan.maxUsers} active
            </dd>
          </div>
        </dl>
      </Card>

      {/* Billing & payment history */}
      <Card className="p-5">
        <SectionTitle icon="receipt" title="Billing & payment history" />
        {planHistory.length === 0 ? (
          <EmptyState
            icon="receipt"
            title="No subscription payments recorded yet."
            hint="When the platform owner sets, renews or extends your plan, the change is recorded here."
          />
        ) : (
          <ul className="divide-y divide-stone-100">
            {planHistory.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-700">{h.description}</p>
                  <p className="text-xs text-stone-400">by {h.actor || "Platform admin"}</p>
                </div>
                <span className="shrink-0 text-xs text-stone-400">
                  {fmtDateTime(h.createdAt, settings)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* FAQ */}
      <Card className="p-5">
        <SectionTitle icon="circle-question" title="Frequently asked questions" />
        <div className="space-y-2">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-xl bg-stone-50 px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-stone-700 [&::-webkit-details-marker]:hidden">
                {f.q}
                <Icon
                  name="chevron-down"
                  className="text-xs text-stone-400 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">{f.a}</p>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
