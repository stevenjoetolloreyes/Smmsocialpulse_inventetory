import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import * as t from "@/lib/schema";
import { loadStore } from "@/server/helpers";
import { getStoreData } from "@/server/data";
import { StoreProvider } from "@/components/store";
import { AppShell } from "@/components/AppShell";
import { AuthBackground } from "@/components/AuthShell";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // The platform admin runs the platform, not a store.
  if (session.isPlatformAdmin) redirect("/admin");

  const db = await getDb();
  if (session.storeId == null) redirect("/login");
  const store = await loadStore(db, session.storeId);
  if (!store) redirect("/login");

  if (store.status === "suspended") {
    return (
      <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <AuthBackground />
        <div className="relative w-full max-w-md rounded-[24px] bg-white/95 p-8 text-center shadow-xl ring-1 ring-black/5">
          <h1 className="text-xl font-extrabold text-stone-800">Store suspended</h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            <strong className="text-stone-700">{store.name}</strong> has been suspended by
            the platform owner, so signing in is paused for everyone in this store.
            Please contact the platform owner if you think this is a mistake.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <LogoutButton />
            <Link href="/login" className="text-sm font-semibold text-[#15803d] hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Owners finish the store-setup wizard before using the app.
  if (store.setupCompleted !== 1) redirect("/setup");

  const data = await getStoreData(db, session.storeId, session.id);
  return (
    <StoreProvider user={session} initialData={data}>
      <AppShell />
    </StoreProvider>
  );
}
