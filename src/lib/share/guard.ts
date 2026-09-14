import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { Workspace } from "@/db/schema";

/**
 * Guards for writes that arrive through a client share link.
 *
 * There is no signed-in user on these paths: the token is the whole key, so
 * every one of them is rate limited and every one of them is refused unless the
 * workspace has explicitly opted in to that kind of write.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_NAME = 60;

// bucket -> timestamps (ms) of recent writes. Process-local; fine for one container.
// ponytail: in-memory counter, move to the database if Galley ever runs more than one process.
const writes = new Map<string, number[]>();

/** Throws once a bucket exceeds `max` writes in ten minutes. Buckets are namespaced by the caller. */
export function guestRateLimit(bucket: string, max: number) {
  const now = Date.now();
  const recent = (writes.get(bucket) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= max) throw new Error("Too many changes in a short time. Try again in a few minutes.");
  recent.push(now);
  writes.set(bucket, recent);
  if (writes.size > 500) for (const [k, v] of writes) if (!v.some((t) => now - t < WINDOW_MS)) writes.delete(k);
}

export function cleanGuestName(name: string): string {
  const n = (name ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME);
  if (!n) throw new Error("Tell us your name first");
  return n;
}

/**
 * The workspace behind a share token, but only when the named capability is on.
 * Returns null rather than explaining itself: a wrong token and a disabled
 * feature must look identical from outside.
 */
export function shareWorkspace(token: string, need: "shareReview" | "shareUploads"): Workspace | null {
  if (!token) return null;
  const ws = db.select().from(schema.workspaces).where(eq(schema.workspaces.shareToken, token)).get();
  if (!ws || !ws[need] || ws.archivedAt) return null;
  return ws;
}
