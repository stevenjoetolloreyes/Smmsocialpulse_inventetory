import { eq } from "drizzle-orm";
import type { DB } from "./db";
import * as t from "./schema";

/**
 * Social sign-in (Google / Facebook) configuration.
 *
 * The platform operator pastes the provider app credentials in
 * /admin → Social Login; they are stored in the `platform_settings`
 * table so they take effect immediately, with no redeploy. The
 * matching environment variables (GOOGLE_CLIENT_ID etc.) are only a
 * fallback for values the operator has not set in the console.
 */

export type SocialProvider = "google" | "facebook";

export type SocialProviderConfig = {
  clientId: string;
  clientSecret: string;
  /** True when both the id and the secret are present. */
  configured: boolean;
};

export type SocialConfig = {
  google: SocialProviderConfig;
  facebook: SocialProviderConfig;
};

export const SOCIAL_SETTING_KEYS = {
  googleClientId: "google_client_id",
  googleClientSecret: "google_client_secret",
  facebookAppId: "facebook_app_id",
  facebookAppSecret: "facebook_app_secret",
} as const;

export async function getPlatformSetting(db: DB, key: string): Promise<string> {
  const rows = await db
    .select()
    .from(t.platformSettings)
    .where(eq(t.platformSettings.key, key));
  return rows[0]?.value?.trim() ?? "";
}

export async function setPlatformSetting(
  db: DB,
  key: string,
  value: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(t.platformSettings)
    .where(eq(t.platformSettings.key, key));
  if (existing.length > 0) {
    await db
      .update(t.platformSettings)
      .set({ value })
      .where(eq(t.platformSettings.key, key));
  } else {
    await db.insert(t.platformSettings).values({ key, value });
  }
}

export async function getSocialConfig(db: DB): Promise<SocialConfig> {
  const [gId, gSecret, fId, fSecret] = await Promise.all([
    getPlatformSetting(db, SOCIAL_SETTING_KEYS.googleClientId),
    getPlatformSetting(db, SOCIAL_SETTING_KEYS.googleClientSecret),
    getPlatformSetting(db, SOCIAL_SETTING_KEYS.facebookAppId),
    getPlatformSetting(db, SOCIAL_SETTING_KEYS.facebookAppSecret),
  ]);
  const googleId = gId || process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const googleSecret =
    gSecret || process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  const facebookId = fId || process.env.FACEBOOK_APP_ID?.trim() || "";
  const facebookSecret =
    fSecret || process.env.FACEBOOK_APP_SECRET?.trim() || "";
  return {
    google: {
      clientId: googleId,
      clientSecret: googleSecret,
      configured: Boolean(googleId && googleSecret),
    },
    facebook: {
      clientId: facebookId,
      clientSecret: facebookSecret,
      configured: Boolean(facebookId && facebookSecret),
    },
  };
}

/**
 * Public base URL the OAuth redirect URIs are built from: APP_URL when
 * set, otherwise the platform's production origin. This exact origin
 * must be registered in the Google / Facebook app dashboards.
 */
export function socialBaseUrl(): string {
  const raw = process.env.APP_URL?.trim() || "https://tienda-one-xi.vercel.app";
  return raw.replace(/\/+$/, "");
}

export function socialRedirectUri(provider: SocialProvider): string {
  return `${socialBaseUrl()}/auth/social/${provider}/callback`;
}

export function providerLabel(provider: SocialProvider): string {
  return provider === "google" ? "Google" : "Facebook";
}
