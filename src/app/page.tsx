import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getStoreData } from "@/server/data";
import { StoreProvider } from "@/components/store";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const db = await getDb();
  const data = await getStoreData(db);
  return (
    <StoreProvider user={session} initialData={data}>
      <AppShell />
    </StoreProvider>
  );
}
