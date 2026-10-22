import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export const SESSION_COOKIE = "ims_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export type SessionUser = {
  id: number;
  name: string;
  username: string;
  role: string;
};

function secret(): string {
  return process.env.SESSION_SECRET || "ims-dev-secret-change-me-in-production";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Creates the signed session cookie value for a signed-in staff member. */
export function createSessionValue(user: SessionUser): string {
  const body = {
    ...user,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function parseSessionValue(value: string | undefined): SessionUser | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as
      SessionUser & { exp: number };
    if (!body.exp || body.exp < Date.now()) return null;
    return { id: body.id, name: body.name, username: body.username, role: body.role };
  } catch {
    return null;
  }
}

/** Reads and verifies the current session from the request cookies. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return parseSessionValue(store.get(SESSION_COOKIE)?.value);
}

/** Throws when there is no valid session — used at the top of every action. */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new Error("Your session has expired. Please log in again.");
  return user;
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionValue(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plain, hash).catch(() => false);
}
