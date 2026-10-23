import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import * as t from "@/lib/schema";
import { setSessionCookie, type SessionUser } from "@/lib/auth";
import {
  getSocialConfig,
  socialRedirectUri,
  type SocialProvider,
} from "@/lib/social";
import { addHistory, loadStore } from "@/server/helpers";
import { SOCIAL_STATE_COOKIE } from "../start/route";

export const dynamic = "force-dynamic";

/**
 * OAuth callback. Every failure lands back on /login (or /register for
 * the no-account case) with a notice flag the pages render as plain
 * text — this handler never throws a 500 at the visitor and never
 * mints a session except on a fully matched store owner.
 *
 * Account matching is owner-only and deterministic: the social email
 * must belong to the staff row that OWNS a store (stores.owner_staff_id).
 * Staff accounts and the platform admin are never matched socially.
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
  const fail = (flag: string) =>
    NextResponse.redirect(new URL(`/login?social=${flag}`, req.url));

  const q = req.nextUrl.searchParams;
  const code = q.get("code");
  const stateParam = q.get("state");

  // Validate the state cookie first (CSRF guard for the whole flow).
  const store = await cookies();
  const rawState = store.get(SOCIAL_STATE_COOKIE)?.value;
  store.delete(SOCIAL_STATE_COOKIE);
  let stateOk = false;
  if (rawState && stateParam) {
    try {
      const parsed = JSON.parse(rawState) as {
        state?: string;
        provider?: string;
      };
      stateOk = parsed.state === stateParam && parsed.provider === p;
    } catch {
      stateOk = false;
    }
  }
  if (!stateOk || !code || q.get("error")) {
    return fail("error");
  }

  try {
    const db = await getDb();
    const config = await getSocialConfig(db);
    const cfg = config[p];
    if (!cfg.configured) return fail("error");
    const redirectUri = socialRedirectUri(p);

    let email = "";
    if (p === "google") {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        // Bounded wait: an unreachable provider must land on the error
        // notice below, never hang the sign-in request.
        signal: AbortSignal.timeout(10_000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenRes.ok) return fail("error");
      const token = (await tokenRes.json()) as { access_token?: string };
      if (!token.access_token) return fail("error");
      const infoRes = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: `Bearer ${token.access_token}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!infoRes.ok) return fail("error");
      const info = (await infoRes.json()) as {
        email?: string;
        email_verified?: boolean;
      };
      // Only a Google-verified email may activate/sign in an account.
      if (!info.email || info.email_verified !== true) return fail("error");
      email = info.email;
    } else {
      const tokenUrl =
        "https://graph.facebook.com/v19.0/oauth/access_token?" +
        new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: redirectUri,
          code,
        }).toString();
      const tokenRes = await fetch(tokenUrl, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!tokenRes.ok) return fail("error");
      const token = (await tokenRes.json()) as { access_token?: string };
      if (!token.access_token) return fail("error");
      const meRes = await fetch(
        "https://graph.facebook.com/v19.0/me?" +
          new URLSearchParams({
            fields: "id,name,email",
            access_token: token.access_token,
          }).toString(),
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!meRes.ok) return fail("error");
      const me = (await meRes.json()) as { email?: string };
      if (!me.email) {
        return NextResponse.redirect(new URL("/login?social=noemail", req.url));
      }
      email = me.email;
    }

    // Owner-only matching: the staff row that owns a store.
    const needle = email.trim().toLowerCase();
    const storeRows = await db.select().from(t.stores);
    const staffRows = await db.select().from(t.staff);
    const staffById = new Map(staffRows.map((s) => [s.id, s]));
    let owner: (typeof staffRows)[number] | null = null;
    let ownerStore: (typeof storeRows)[number] | null = null;
    for (const s of storeRows) {
      if (s.ownerStaffId == null) continue;
      const candidate = staffById.get(s.ownerStaffId);
      if (
        candidate &&
        candidate.isPlatformAdmin !== 1 &&
        candidate.storeId === s.id &&
        candidate.email !== "" &&
        candidate.email.toLowerCase() === needle
      ) {
        owner = candidate;
        ownerStore = s;
        break;
      }
    }
    if (!owner || !ownerStore) {
      return NextResponse.redirect(new URL("/register?social=nouser", req.url));
    }
    if (ownerStore.status === "suspended") {
      return fail("suspended");
    }

    // The provider proved ownership of the email: activate + verify the
    // owner account (same effect as clicking the verification link).
    const nowIso = new Date().toISOString();
    await db
      .update(t.staff)
      .set({ emailVerified: 1, active: 1, lastLogin: nowIso })
      .where(eq(t.staff.id, owner.id));
    const session: SessionUser = {
      id: owner.id,
      name: owner.name,
      username: owner.username,
      role: owner.role,
      storeId: owner.storeId ?? ownerStore.id,
      isPlatformAdmin: false,
    };
    await setSessionCookie(session, false);
    const storeRow = await loadStore(db, ownerStore.id);
    if (storeRow) {
      await addHistory(db, ownerStore.id, {
        action: "Login",
        entityType: "Staff",
        entityId: owner.id,
        description: `${owner.name} logged in with ${p === "google" ? "Google" : "Facebook"}`,
        actor: owner.name,
        reference: owner.username,
      });
    }
    return NextResponse.redirect(new URL("/", req.url));
  } catch {
    return fail("error");
  }
}
