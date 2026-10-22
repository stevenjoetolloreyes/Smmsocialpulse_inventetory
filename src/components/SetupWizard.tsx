"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { completeStoreSetup, logoutAction } from "@/server/actions";
import { Icon } from "./ui";
import { AuthBackground, AuthError } from "./AuthShell";

type SetupForm = {
  storeName: string;
  address: string;
  city: string;
  province: string;
  zip: string;
  phone: string;
};

const MAX_LOGO_BYTES = 200 * 1024;

/**
 * Two-step store onboarding, mirroring the reference flow:
 * left dark panel (greeting + step list), right the form.
 * Step 1 collects the store profile; Step 2 reviews it next to the Free
 * plan summary and launches the store.
 */
export function SetupWizard({
  username,
  storeName,
  initial,
}: {
  username: string;
  storeName: string;
  initial: SetupForm;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<SetupForm>(initial);
  const [logoData, setLogoData] = useState("");
  const [logoName, setLogoName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof SetupForm>(k: K, v: SetupForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("The store logo must be an image file.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("The store logo must be under 200 KB. Pick a smaller image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoData(typeof reader.result === "string" ? reader.result : "");
      setLogoName(file.name);
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const next = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.storeName.trim()) return setError("Store name is required.");
    if (!form.address.trim()) return setError("Store address is required.");
    if (!form.city.trim()) return setError("City is required.");
    if (!form.province.trim()) return setError("Province is required.");
    if (!form.zip.trim()) return setError("ZIP code is required.");
    setStep(2);
  };

  const launch = async () => {
    setError("");
    setBusy(true);
    try {
      await completeStoreSetup({ ...form, logoData });
      router.push("/?setup=done");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed.");
      setBusy(false);
    }
  };

  const logout = async () => {
    await logoutAction();
    window.location.href = "/login";
  };

  const inputCls =
    "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/25";
  const labelCls = "mb-1.5 block text-[13px] font-bold text-stone-600";

  const steps = [
    { n: 1, label: "Store Setup", icon: "store" },
    { n: 2, label: "Review & Launch", icon: "rocket" },
  ];

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <AuthBackground />
      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-[24px] bg-white/95 shadow-[0_24px_60px_-16px_rgba(20,83,45,0.35)] ring-1 ring-black/5 backdrop-blur md:grid-cols-[300px_1fr]">
        {/* Left dark panel */}
        <div className="flex flex-col bg-[#12291b] p-7 text-white">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-xl">
            <Icon name="boxes-stacked" />
          </span>
          <h1 className="text-xl font-extrabold leading-snug">
            Hi {username}, let&apos;s build your store
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-white/60">
            Two quick steps and <strong className="text-white/85">{storeName}</strong> is
            ready for its first sale.
          </p>
          <ol className="mt-7 space-y-3">
            {steps.map((s) => {
              const active = step === s.n;
              const done = step > s.n;
              return (
                <li
                  key={s.n}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                    active ? "bg-white text-[#12291b]" : "text-white/75"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      active ? "bg-[#14532d] text-white" : done ? "bg-emerald-500 text-white" : "bg-white/15 text-white"
                    }`}
                  >
                    {done ? <Icon name="check" /> : s.n}
                  </span>
                  <Icon name={s.icon} className="w-4 text-center" />
                  {s.label}
                </li>
              );
            })}
          </ol>
          <div className="mt-auto pt-8">
            <p className="rounded-xl bg-white/5 px-3.5 py-3 text-xs leading-relaxed text-white/55">
              You are on the <strong className="text-white/85">Free plan</strong> — 2 users,
              core POS &amp; inventory included. The platform owner can upgrade your store
              anytime from the Subscription page terms.
            </p>
            <button
              onClick={() => void logout()}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"
            >
              <Icon name="arrow-right-from-bracket" /> Log out
            </button>
          </div>
        </div>

        {/* Right: the form */}
        <div className="p-7 sm:p-9">
          {step === 1 ? (
            <form onSubmit={next} autoComplete="off">
              <h2 className="text-lg font-extrabold text-stone-800">Store Setup</h2>
              <p className="mt-0.5 text-sm text-stone-500">
                These details appear on receipts and your store profile.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="su-name">Store Name *</label>
                  <input id="su-name" className={inputCls} value={form.storeName} onChange={(e) => set("storeName", e.target.value)} required />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="su-address">Address *</label>
                  <input id="su-address" className={inputCls} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street / barangay" required />
                </div>
                <div>
                  <label className={labelCls} htmlFor="su-city">City *</label>
                  <input id="su-city" className={inputCls} value={form.city} onChange={(e) => set("city", e.target.value)} required />
                </div>
                <div>
                  <label className={labelCls} htmlFor="su-province">Province *</label>
                  <input id="su-province" className={inputCls} value={form.province} onChange={(e) => set("province", e.target.value)} required />
                </div>
                <div>
                  <label className={labelCls} htmlFor="su-zip">ZIP Code *</label>
                  <input id="su-zip" className={inputCls} value={form.zip} onChange={(e) => set("zip", e.target.value)} required />
                </div>
                <div>
                  <label className={labelCls} htmlFor="su-phone">Phone Number</label>
                  <input id="su-phone" className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="09xx xxx xxxx" />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Store Logo (optional, max 200 KB)</label>
                  <div className="flex items-center gap-3">
                    {logoData ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoData} alt="Store logo preview" className="h-12 w-12 rounded-xl object-cover ring-1 ring-stone-200" />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
                        <Icon name="image" />
                      </span>
                    )}
                    <button
                      type="button"
                      className="rounded-xl bg-stone-100 px-3.5 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-200"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Icon name="upload" /> {logoName ? "Change image" : "Upload image"}
                    </button>
                    {logoName && <span className="truncate text-xs text-stone-400">{logoName}</span>}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => pickLogo(e.target.files?.[0])}
                    />
                  </div>
                </div>
              </div>
              <AuthError message={error} />
              <button
                type="submit"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#16a34a] to-[#15803d] py-3 text-[15px] font-bold text-white shadow-md transition hover:brightness-105"
              >
                Continue <Icon name="arrow-right" />
              </button>
            </form>
          ) : (
            <div>
              <h2 className="text-lg font-extrabold text-stone-800">Review &amp; Launch</h2>
              <p className="mt-0.5 text-sm text-stone-500">
                Check everything, then launch your store.
              </p>
              <dl className="mt-5 space-y-2.5 rounded-2xl bg-stone-50 p-5 text-sm">
                {(
                  [
                    ["Store Name", form.storeName],
                    ["Address", form.address],
                    ["City", form.city],
                    ["Province", form.province],
                    ["ZIP Code", form.zip],
                    ["Phone Number", form.phone || "—"],
                    ["Store Logo", logoName || "Not set"],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <dt className="w-28 shrink-0 font-semibold text-stone-500">{k}</dt>
                    <dd className="min-w-0 flex-1 font-medium text-stone-800">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Your plan</p>
                <p className="mt-1 text-lg font-extrabold text-emerald-900">
                  Free — ₱0/month
                </p>
                <ul className="mt-2 space-y-1 text-sm text-emerald-900/80">
                  <li><Icon name="check" className="mr-1.5" /> Up to 2 active users</li>
                  <li><Icon name="check" className="mr-1.5" /> Full POS, inventory, QR scanning &amp; reports on screen</li>
                  <li><Icon name="xmark" className="mr-1.5" /> Product image upload (Pro &amp; Business)</li>
                  <li><Icon name="xmark" className="mr-1.5" /> Report CSV export (Pro &amp; Business)</li>
                </ul>
              </div>
              <AuthError message={error} />
              <div className="mt-6 flex gap-2.5">
                <button
                  type="button"
                  className="rounded-full bg-stone-100 px-5 py-3 text-sm font-bold text-stone-600 hover:bg-stone-200"
                  onClick={() => setStep(1)}
                  disabled={busy}
                >
                  <Icon name="arrow-left" /> Back
                </button>
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#16a34a] to-[#15803d] py-3 text-[15px] font-bold text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
                  onClick={() => void launch()}
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <Icon name="circle-notch" className="animate-spin" /> Launching…
                    </>
                  ) : (
                    <>
                      <Icon name="rocket" /> Launch Store
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
