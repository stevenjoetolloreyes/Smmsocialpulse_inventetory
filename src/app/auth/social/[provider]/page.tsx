import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AuthCard,
  FacebookMark,
  GoogleMark,
  authPrimaryBtnCls,
} from "@/components/AuthShell";

const PROVIDERS: Record<string, { label: string }> = {
  google: { label: "Google" },
  facebook: { label: "Facebook" },
};

export default async function SocialPlaceholderPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider } = await params;
  const info = PROVIDERS[provider];
  if (!info) notFound();

  return (
    <AuthCard
      heading="Inventory Management System"
      subtitle="Smart POS & Inventory for Sari-Sari Stores"
    >
      <div className="text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
          {provider === "google" ? (
            <span className="scale-[1.6]">
              <GoogleMark />
            </span>
          ) : (
            <span className="scale-[1.6]">
              <FacebookMark />
            </span>
          )}
        </span>
        <h2 className="text-lg font-bold text-stone-800">
          {info.label} sign-in is not connected yet
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-stone-500">
          The store owner has added the {info.label} button, but the {info.label}{" "}
          sign-in connection has not been finished. For now, please sign in with
          your username and password instead.
        </p>
        <Link href="/login" className={`${authPrimaryBtnCls} mt-5`}>
          Back to Sign in
        </Link>
      </div>
    </AuthCard>
  );
}
