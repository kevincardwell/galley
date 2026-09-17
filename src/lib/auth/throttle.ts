import "server-only";
import { headers } from "next/headers";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_ACCOUNT = 8;
const MAX_PER_ADDRESS = 40;
const MAX_KEYS = 5_000;

type Bucket = { failures: number[]; blockedUntil: number };
const attempts = new Map<string, Bucket>();

/**
 * The client address, counting back from the right of X-Forwarded-For.
 *
 * The leftmost entry is whatever the client sent and is trivially forged, so it can never be
 * trusted. `TRUSTED_PROXY_HOPS` says how many proxies sit in front of Galley (1 for the usual
 * single reverse proxy); we take the value that hop added, which the client cannot control.
 *
 * Zero (or nonsense) means nothing is in front: every forwarded header is client-supplied, so
 * none of them are read and all such callers share one conservative bucket. A chain shorter
 * than the configured depth did not pass through the proxies we trust, so it is treated the
 * same way rather than falling back to an entry the client chose.
 */
async function clientAddress(): Promise<string> {
  const h = await headers();
  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  if (!Number.isFinite(hops) || hops < 1) return "local";
  const chain = (h.get("x-forwarded-for") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (chain.length === 0) return h.get("x-real-ip")?.trim() || "local";
  if (chain.length < hops) return "local";
  return chain[chain.length - hops] ?? "local";
}

/** Oldest-first eviction, so a flood of distinct keys cannot grow the map without bound. */
function remember(key: string, bucket: Bucket) {
  if (!attempts.has(key) && attempts.size >= MAX_KEYS) {
    const oldest = attempts.keys().next();
    if (!oldest.done) attempts.delete(oldest.value);
  }
  attempts.set(key, bucket);
}

function check(key: string, limit: number, now: number): boolean {
  const bucket = attempts.get(key);
  if (!bucket) return false;
  if (bucket.blockedUntil > now) return true;
  bucket.failures = bucket.failures.filter((t) => now - t < WINDOW_MS);
  if (bucket.failures.length === 0 && bucket.blockedUntil <= now) attempts.delete(key);
  return bucket.failures.length >= limit;
}

function bump(key: string, limit: number, now: number) {
  const bucket = attempts.get(key) ?? { failures: [], blockedUntil: 0 };
  bucket.failures = bucket.failures.filter((t) => now - t < WINDOW_MS);
  bucket.failures.push(now);
  if (bucket.failures.length >= limit) bucket.blockedUntil = now + WINDOW_MS;
  remember(key, bucket);
}

/** True when this address or this account has failed too often lately. */
export async function isThrottled(email: string): Promise<boolean> {
  const now = Date.now();
  const ip = await clientAddress();
  return check(`ip:${ip}`, MAX_PER_ADDRESS, now) || check(`acct:${ip}|${email}`, MAX_PER_ACCOUNT, now);
}

export async function recordFailure(email: string): Promise<void> {
  const now = Date.now();
  const ip = await clientAddress();
  bump(`ip:${ip}`, MAX_PER_ADDRESS, now);
  bump(`acct:${ip}|${email}`, MAX_PER_ACCOUNT, now);
}

export async function clearFailures(email: string): Promise<void> {
  const ip = await clientAddress();
  attempts.delete(`acct:${ip}|${email}`);
  // The address bucket is deliberately left standing: one person typing their password right
  // must not wipe the limit that slows guessing down from their address.
}

// ---- The second factor ----
//
// Its own bucket, keyed by user rather than address, and cleared only by a correct code. A
// correct password must not reset it: otherwise an attacker who already has the password can
// sign in (which succeeds as far as the password step is concerned), try a few codes, sign in
// again, and keep going forever without ever tripping the limit.

/** True when this account or address has failed too many second-factor checks lately. */
export async function isTotpThrottled(userId: string): Promise<boolean> {
  const now = Date.now();
  const ip = await clientAddress();
  return check(`ip:${ip}`, MAX_PER_ADDRESS, now) || check(`totp:${userId}`, MAX_PER_ACCOUNT, now);
}

export async function recordTotpFailure(userId: string): Promise<void> {
  const now = Date.now();
  const ip = await clientAddress();
  bump(`ip:${ip}`, MAX_PER_ADDRESS, now);
  bump(`totp:${userId}`, MAX_PER_ACCOUNT, now);
}

export async function clearTotpFailures(userId: string): Promise<void> {
  attempts.delete(`totp:${userId}`);
}
