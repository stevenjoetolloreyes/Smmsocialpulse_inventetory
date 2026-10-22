import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { loadSettings, loadStore } from "@/server/helpers";
import { SetupWizard } from "@/components/SetupWizard";

export const dynamic = "force-dynamic";

/**
 * Store-setup wizard gate. Only a signed-in store user whose store has
 * setup_completed = 0 belongs here; everyone else is sent on their way.
 */
export default async function SetupPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.isPlatformAdmin) redirect("/admin");
  if (session.storeId == null) redirect("/login");
  const db = await getDb();
  const store = await loadStore(db, session.storeId);
  if (!store) redirect("/login");
  if (store.status === "suspended") redirect("/");
  if (store.setupCompleted === 1) redirect("/");
  const settings = await loadSettings(db, session.storeId);
  return (
    <SetupWizard
      username={session.username}
      storeName={store.name}
      initial={{
        storeName: settings.storeName || store.name,
        address: settings.address,
        city: settings.city,
        province: settings.province,
        zip: settings.zip,
        phone: settings.phone,
      }}
    />
  );
}
