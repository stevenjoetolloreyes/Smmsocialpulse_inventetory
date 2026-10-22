import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fetchPlatformData } from "@/server/actions";
import { PlatformView } from "@/components/PlatformView";
import { AdminLoginForm } from "@/components/AdminLoginForm";

export const dynamic = "force-dynamic";

/**
 * Platform-owner console, in its own area at /admin with its own door:
 * signed-out visitors get a dedicated admin sign-in form (platform-admin
 * accounts only); store users are sent back to their store app.
 */
export default async function AdminPage() {
  const session = await getSession();
  if (!session) return <AdminLoginForm />;
  if (!session.isPlatformAdmin) redirect("/");
  const data = await fetchPlatformData();
  return <PlatformView userName={session.name} initialData={data} />;
}
