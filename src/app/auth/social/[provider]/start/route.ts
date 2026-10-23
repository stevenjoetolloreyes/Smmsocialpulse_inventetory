import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import {
  getSocialConfig,
  SOCIAL_STATE_COOKIE,
  socialRedirectUri,
  type SocialProvider,
} from "@/lib/social";

export const dynamic = "force-dynamic";

/**
 * Starts the OAuth Authorization Code flow for a store owner. When the
 * platform operator has not configured the provider yet, the visitor is
 * sent straight back to the page they came from with a notice flag —
 * the buttons are always visible, never dead.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (provider !== "google" && provider !== "facebook") {
    return new NextResponse("Unknown provider", { status: 404 });
  }
  const p = provider as SocialProvider;
  const fromRegister = req.nextUrl.searchParams.get("from") === "register";
  const backPage = fromRegister ? "/register" : "/login";

  const db = await getDb();
  const config = await getSocialConfig(db);
  const cfg = config[p];
  if (!cfg.configured) {
    return NextResponse.redirect(
      new URL(`${backPage}?social=unconfigured&provider=${p}`, req.url),
    );
  }

  const state = randomBytes(24).toString("hex");
  const store = await cookies();
  store.set(
    SOCIAL_STATE_COOKIE,
    JSON.stringify({ state, provider: p, mode: fromRegister ? "register" : "login" }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10, // 10 minutes
    },
  );

  const redirectUri = socialRedirectUri(p);
  const authUrl =
    p === "google"
      ? "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams({
          client_id: cfg.clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: "openid email profile",
          access_type: "online",
          prompt: "select_account",
          state,
        }).toString()
      : "https://www.facebook.com/v19.0/dialog/oauth?" +
        new URLSearchParams({
          client_id: cfg.clientId,
          redirect_uri: redirectUri,
          scope: "email,public_profile",
          state,
        }).toString();

  // Explicit 302 to the provider's authorize URL (spec'd status).
  return NextResponse.redirect(authUrl, 302);
}
