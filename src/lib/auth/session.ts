import "server-only";
import { cookies } from "next/headers";
import { and, eq, lt } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { newToken } from "@/lib/ids";
import { getSettings } from "@/lib/settings";
import type { User } from "@/db/schema";

export const SESSION_COOKIE = "galley_session";

/** How long someone has to type their code before the sign-in has to start again. */
const PENDING_MINUTES = 10;

const nowS = () => Math.floor(Date.now() / 1000);
const fullLife = () => nowS() + (getSettings().sessionDays || 30) * 86400;

async function setCookie(id: string, expiresAt: number) {
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

export async function createSession(userId: string, { pendingTotp = false } = {}) {
  if (Math.random() < 0.05) db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, nowS())).run();
  const id = newToken();
  const expiresAt = pendingTotp ? nowS() + PENDING_MINUTES * 60 : fullLife();
  db.insert(schema.sessions).values({ id, userId, expiresAt, pendingTotp }).run();
  await setCookie(id, expiresAt);
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) db.delete(schema.sessions).where(eq(schema.sessions.id, id)).run();
  jar.delete(SESSION_COOKIE);
}

function lookup(id: string) {
  const row = db
    .select({ user: schema.users, expiresAt: schema.sessions.expiresAt, pendingTotp: schema.sessions.pendingTotp })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(eq(schema.sessions.id, id))
    .get();
  if (!row || row.expiresAt < nowS() || row.user.deactivatedAt) return null;
  return row;
}

export async function getSessionUser() {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const row = lookup(id);
  if (!row || row.pendingTotp) return null;
  const now = nowS();
  if (!row.user.lastSeenAt || now - row.user.lastSeenAt > 300) {
    db.update(schema.users).set({ lastSeenAt: now }).where(eq(schema.users.id, row.user.id)).run();
  }
  return row.user;
}

/** The half-done sign-in: the password was right, the code is not in yet. */
export async function getPendingSession(): Promise<{ id: string; user: User } | null> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const row = lookup(id);
  return row?.pendingTotp ? { id, user: row.user } : null;
}

/** Turns that half-done sign-in into a real one, once the code has been checked. */
export async function completePendingSession(id: string) {
  const expiresAt = fullLife();
  db.update(schema.sessions)
    .set({ pendingTotp: false, expiresAt })
    .where(and(eq(schema.sessions.id, id), eq(schema.sessions.pendingTotp, true)))
    .run();
  await setCookie(id, expiresAt);
}
