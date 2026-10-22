import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";

export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="relative min-h-screen bg-gradient-to-b from-[#dff3e4] via-[#eef6e9] to-[#fdf3d8] px-4 py-10">
      <div className="relative mx-auto w-full max-w-2xl rounded-[24px] bg-white/95 p-7 shadow-[0_24px_60px_-16px_rgba(20,83,45,0.35)] ring-1 ring-black/5 sm:p-9">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#16a34a] to-[#14532d] text-lg text-white shadow-md">
            <Icon name="boxes-stacked" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold leading-tight text-[#14532d]">{title}</h1>
            <p className="text-xs text-stone-400">Inventory Management System · Last updated {updated}</p>
          </div>
        </div>
        <div className="space-y-4 text-sm leading-relaxed text-stone-600 [&_h2]:pt-2 [&_h2]:text-[15px] [&_h2]:font-bold [&_h2]:text-stone-800">
          {children}
        </div>
        <div className="mt-7 border-t border-stone-200 pt-4 text-center text-xs font-medium">
          <Link href="/login" className="text-[#15803d] hover:underline">
            Back to Sign in
          </Link>
          <span className="mx-2 text-stone-300">·</span>
          <Link href="/privacy" className="text-[#15803d] hover:underline">
            Privacy Policy
          </Link>
          <span className="mx-2 text-stone-300">·</span>
          <Link href="/terms" className="text-[#15803d] hover:underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </main>
  );
}
