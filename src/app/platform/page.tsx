import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fetchPlatformData } from "@/server/actions";
import { PlatformView } from "@/components/PlatformView";

export const dynamic = "force-dynamic";

/**
 * Platform-owner console. Only the platform admin (the seeded admin
 * account) can see it; store users are sent back to their store.
 */
export default async function PlatformPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isPlatformAdmin) redirect("/");
  const data = await fetchPlatformData();
  return <PlatformView userName={session.name} initialData={data} />;
}
