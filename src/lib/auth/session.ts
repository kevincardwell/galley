import "server-only";
import { cookies } from "next/headers";
import { eq, lt } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { newToken } from "@/lib/ids";
import { getSettings } from "@/lib/settings";

export const SESSION_COOKIE = "galley_session";

export async function createSession(userId: string) {
  if (Math.random() < 0.05) db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, Math.floor(Date.now() / 1000))).run();
  const id = newToken();
  const days = getSettings().sessionDays || 30;
  const expiresAt = Math.floor(Date.now() / 1000) + days * 86400;
  db.insert(schema.sessions).values({ id, userId, expiresAt }).run();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    // Secure by default in production. Only an explicitly http:// GALLEY_URL turns it off, so a
    // site behind a TLS-terminating proxy is protected even when the variable was never set.
    secure: process.env.NODE_ENV === "production" && !process.env.GALLEY_URL?.startsWith("http://"),
    path: "/",
    expires: new Date(expiresAt * 1000),
  });
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) db.delete(schema.sessions).where(eq(schema.sessions.id, id)).run();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const row = db
    .select({ user: schema.users, expiresAt: schema.sessions.expiresAt })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(eq(schema.sessions.id, id))
    .get();
  if (!row) return null;
  const nowS = Math.floor(Date.now() / 1000);
  if (row.expiresAt < nowS || row.user.deactivatedAt) return null;
  if (!row.user.lastSeenAt || nowS - row.user.lastSeenAt > 300) {
    db.update(schema.users).set({ lastSeenAt: nowS }).where(eq(schema.users.id, row.user.id)).run();
  }
  return row.user;
}
