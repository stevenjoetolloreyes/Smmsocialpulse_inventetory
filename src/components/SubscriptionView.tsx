"use client";

import { useState, type ReactNode } from "react";
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

/** One cell of the subscription-details summary grid. */
function DetailItem({
  icon,
  label,
  children,
  sub,
}: {
  icon: string;
  label: string;
  children: ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-sm text-stone-500">
        <Icon name={icon} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">
          {label}
        </p>
        <div className="mt-0.5 text-[15px] font-bold leading-snug text-stone-800">
          {children}
        </div>
        {sub && <p className="mt-0.5 text-xs leading-snug text-stone-400">{sub}</p>}
      </div>
    </div>
  );
}

/**
 * The store's subscription page: current-plan strip, an animated
 * Monthly/Yearly toggle, pricing cards for all three plans, a compact
 * subscription-details summary, a compare table, billing history, and
 * an FAQ accordion. All prices come from the plans table; upgrades are
 * granted by the platform owner — the plan cards file a real request
 * through the feedback inbox instead of pretending to check out.
 */
export function SubscriptionView() {
  const { data, run, showToast } = useStore();
  const { plan, plans, store, settings } = data;
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const activeUsers = data.staff.filter((s) => s.active).length;
  const expiredPaid = store.planId !== "free" && store.effectivePlanId === "free";
  const paidOnRecord = store.planId !== "free";
  const expiry = store.planExpiresAt ? new Date(store.planExpiresAt) : null;
  const daysLeft = expiry
    ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000))
    : null;

  // Savings from the real configured prices (yearly vs 12 monthly payments).
  const paidPlans = plans.filter((p) => p.priceMonthly > 0);
  const savePct = paidPlans.length
    ? Math.round(
        (1 - paidPlans[0].priceYearly / (paidPlans[0].priceMonthly * 12)) * 100,
      )
    : 0;
  const savedPerYear = (p: PlanDTO) => p.priceMonthly * 12 - p.priceYearly;

  const planHistory = data.history.filter((h) => h.entityType === "Plan");

  const requestPlan = async (p: PlanDTO) => {
    setSendingId(p.id);
    try {
      await run(() =>
        submitFeedbackAction(
          "feature",
          p.id === store.planId && expiredPaid
            ? `I'd like to renew my ${p.name} plan`
            : p.priceMonthly > plan.priceMonthly
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="ims-card" style={{ animationDelay: "0ms" }}>
        <h2 className="text-2xl font-extrabold tracking-tight text-stone-800">
          Subscription
        </h2>
        <p className="mt-0.5 text-sm text-stone-500">
          Your store&apos;s plan, what it includes, and how to change it.
        </p>
      </div>

      {/* Current plan strip */}
      <div
        className="ims-card flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[24px] bg-white px-5 py-3.5 shadow-[0_10px_36px_-16px_rgb(28_25_23/0.14)] ring-1 ring-stone-900/5"
        style={{ animationDelay: "60ms" }}
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
          Current plan
        </p>
        <p className="text-sm font-extrabold text-stone-800">{plan.name}</p>
        {expiredPaid ? (
          <span className="text-xs font-medium text-amber-600">
            Paid plan on record expired — Free limits apply
          </span>
        ) : paidOnRecord && expiry ? (
          <span className="text-xs font-medium text-stone-400">
            Term ends {fmtDate(store.planExpiresAt, settings)}
            {daysLeft !== null &&
              ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`}
          </span>
        ) : (
          <span className="text-xs font-medium text-stone-400">Free forever</span>
        )}
      </div>

      {/* Monthly / Yearly toggle */}
      <div
        className="ims-card flex flex-wrap items-center gap-x-4 gap-y-2"
        style={{ animationDelay: "120ms" }}
      >
        <div
          className="relative grid w-full grid-cols-2 rounded-full bg-stone-200/70 p-1 sm:w-[340px]"
          role="group"
          aria-label="Billing period"
        >
          <span
            aria-hidden="true"
            className={`ims-toggle-pill absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow ${
              cycle === "yearly" ? "translate-x-[calc(100%+4px)]" : "translate-x-0"
            }`}
          />
          {(
            [
              { key: "monthly", label: "Monthly" },
              { key: "yearly", label: "Yearly" },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              onClick={() => setCycle(o.key)}
              aria-pressed={cycle === o.key}
              className={`relative z-10 flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                cycle === o.key
                  ? "text-stone-800"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {o.label}
              {o.key === "yearly" && savePct > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    cycle === "yearly"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-stone-300/70 text-stone-500"
                  }`}
                >
                  Save {savePct}%
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-400">
          Yearly billing costs ten monthly payments — two months free ({savePct}%
          saved).
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.id === plan.id;
          const isRecorded = p.id === store.planId;
          return (
            <Card
              key={p.id}
              className={`ims-card ims-card-hover flex flex-col p-6 ${
                isCurrent ? "ring-2 ring-[var(--brand)]" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-lg font-extrabold text-stone-800">{p.name}</p>
                {isCurrent ? (
                  <Badge tone="green">Current Plan</Badge>
                ) : isRecorded && expiredPaid ? (
                  <Badge tone="amber">Expired</Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm leading-snug text-stone-500">
                {PLAN_BLURB[p.id] ?? ""}
              </p>

              <div key={cycle} className="ims-price-in mt-4">
                {p.priceMonthly === 0 ? (
                  <>
                    <p className="text-4xl font-extrabold tracking-tight text-stone-800">
                      ₱0
                      <span className="ml-1.5 text-sm font-semibold text-stone-400">
                        · free forever
                      </span>
                    </p>
                    <p className="mt-1 text-xs font-medium text-stone-400">
                      No billing, no expiry.
                    </p>
                  </>
                ) : cycle === "monthly" ? (
                  <>
                    <p className="text-4xl font-extrabold tracking-tight text-stone-800">
                      {peso(p.priceMonthly)}
                      <span className="ml-1.5 text-sm font-semibold text-stone-400">
                        / month
                      </span>
                    </p>
                    <p className="mt-1 text-xs font-medium text-stone-400">
                      or {peso(p.priceYearly)} / year — save {savePct}%
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-4xl font-extrabold tracking-tight text-stone-800">
                      {peso(p.priceYearly)}
                      <span className="ml-1.5 text-sm font-semibold text-stone-400">
                        / year
                      </span>
                    </p>
                    <p className="mt-1 text-xs font-semibold text-emerald-600">
                      Only {peso(p.priceYearly / 12)} / month — save{" "}
                      {peso(savedPerYear(p))} ({savePct}%) vs paying monthly
                    </p>
                  </>
                )}
              </div>

              <ul className="mt-4 flex-1 space-y-2 text-sm">
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

              <div className="mt-5 border-t border-stone-100 pt-4">
                {isCurrent ? (
                  <p className="py-1 text-center text-xs font-semibold text-stone-400">
                    This is the plan your store is running on now.
                  </p>
                ) : (
                  <>
                    <button
                      onClick={() => void requestPlan(p)}
                      disabled={sendingId === p.id}
                      className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                        p.priceMonthly > plan.priceMonthly
                          ? "bg-[var(--brand)] text-white hover:opacity-90"
                          : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                      }`}
                    >
                      <Icon name="paper-plane" className="mr-1.5 text-xs" />
                      {sendingId === p.id
                        ? "Sending…"
                        : isRecorded && expiredPaid
                          ? `Ask to renew ${p.name}`
                          : p.priceMonthly > plan.priceMonthly
                            ? `Ask to upgrade to ${p.name}`
                            : `Ask about switching to ${p.name}`}
                    </button>
                    <p className="mt-2 text-center text-[11px] leading-snug text-stone-400">
                      Plans are granted by the platform owner — this sends them a
                      request.
                    </p>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Subscription details */}
      <Card className="ims-card p-6">
        <SectionTitle icon="receipt" title="Subscription details" />
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem
            icon="crown"
            label="Current plan"
            sub={`${activeUsers} of ${plan.maxUsers === 0 ? "unlimited" : plan.maxUsers} user seats in use`}
          >
            {plan.name}
          </DetailItem>
          <DetailItem icon="circle-check" label="Status">
            {expiredPaid ? (
              <Badge tone="amber">Expired — running on Free</Badge>
            ) : (
              <Badge tone="green">Active</Badge>
            )}
          </DetailItem>
          <DetailItem
            icon="calendar-days"
            label="Billing period"
            sub={
              paidOnRecord
                ? `Plan on record: ${plans.find((x) => x.id === store.planId)?.name ?? store.planId}`
                : undefined
            }
          >
            {!paidOnRecord
              ? "No renewal required"
              : expiredPaid
                ? "Paid term ended"
                : "Prepaid term"}
          </DetailItem>
          <DetailItem icon="peso-sign" label="Subscription price">
            {plan.priceMonthly === 0
              ? "₱0 — free forever"
              : `${peso(plan.priceMonthly)} / month`}
          </DetailItem>
          <DetailItem icon="calendar-check" label="Renewal / expiration">
            {paidOnRecord && store.planExpiresAt
              ? fmtDate(store.planExpiresAt, settings)
              : paidOnRecord
                ? "No expiry set"
                : "Not applicable"}
          </DetailItem>
          <DetailItem icon="hourglass-half" label="Time remaining">
            {!paidOnRecord
              ? "Lifetime access"
              : expiredPaid
                ? "Expired"
                : daysLeft === null
                  ? "No expiry set"
                  : daysLeft === 0
                    ? "Expires today"
                    : `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`}
          </DetailItem>
        </div>
      </Card>

      {/* Compare features */}
      <Card className="ims-card p-6">
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
                <td className="py-2.5 pr-3 font-medium text-stone-600">
                  Price ({cycle === "monthly" ? "monthly" : "yearly"})
                </td>
                {plans.map((p) => (
                  <td key={p.id} className="py-2.5 pr-3 font-semibold text-stone-700">
                    {p.priceMonthly === 0
                      ? "₱0"
                      : cycle === "monthly"
                        ? `${peso(p.priceMonthly)} / mo`
                        : `${peso(p.priceYearly)} / yr`}
                  </td>
                ))}
              </tr>
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

      {/* Billing & payment history */}
      <Card className="ims-card p-6">
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

      {/* FAQ accordion */}
      <Card className="ims-card p-6">
        <SectionTitle icon="circle-question" title="Frequently asked questions" />
        <div className="space-y-2">
          {FAQS.map((f, i) => {
            const open = openFaq === i;
            return (
              <div key={f.q} className="overflow-hidden rounded-2xl bg-stone-50">
                <button
                  onClick={() => setOpenFaq(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-stone-700"
                >
                  {f.q}
                  <Icon
                    name="chevron-down"
                    className={`ims-chevron shrink-0 text-xs text-stone-400 ${open ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  className={`ims-acc grid ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="overflow-hidden">
                    <p className="px-4 pb-3.5 text-sm leading-relaxed text-stone-500">
                      {f.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
