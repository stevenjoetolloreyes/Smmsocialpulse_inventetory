import { permanentRedirect } from "next/navigation";

/**
 * The platform-owner console lives at /admin now. This page stays so old
 * links and bookmarks keep working — it permanently redirects to /admin.
 */
export default function PlatformRedirectPage() {
  permanentRedirect("/admin");
}
