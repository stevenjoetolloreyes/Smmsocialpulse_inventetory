import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as t from "@/lib/schema";
import { addHistory, consumeEmailToken, peekEmailToken } from "@/server/helpers";

/**
 * Email verification link target: /auth/verify?token=…
 * On success the owner account is verified AND activated, and the user is
 * sent to /login with a success notice. Tokens are single-use, 24h expiry.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const fail = NextResponse.redirect(new URL("/login?verify_error=1", req.url));
  if (!token) return fail;
  try {
    const db = await getDb();
    const staffId = await peekEmailToken(db, token, "verify");
    if (staffId == null) return fail;
    const [user] = await db.select().from(t.staff).where(eq(t.staff.id, staffId));
    if (!user) return fail;
    await db
      .update(t.staff)
      .set({ emailVerified: 1, active: 1 })
      .where(eq(t.staff.id, staffId));
    await consumeEmailToken(db, token);
    if (user.storeId != null) {
      await addHistory(db, user.storeId, {
        action: "Verify",
        entityType: "Staff",
        entityId: user.id,
        description: `${user.name} verified their email and the account was activated`,
        actor: user.name,
        reference: user.username,
      });
    }
    return NextResponse.redirect(new URL("/login?verified=1", req.url));
  } catch {
    return fail;
  }
}
