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
 */
async function clientAddress(): Promise<string> {
  const h = await headers();
  const hops = Math.max(0, Number(process.env.TRUSTED_PROXY_HOPS ?? 1));
  const chain = (h.get("x-forwarded-for") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (chain.length === 0) return h.get("x-real-ip")?.trim() || "local";
  return chain[Math.max(0, chain.length - hops)] ?? chain[chain.length - 1];
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

/** True when this address or this account has failed too often lately. */
export async function isThrottled(email: string): Promise<boolean> {
  const now = Date.now();
  const ip = await clientAddress();
  return check(`ip:${ip}`, MAX_PER_ADDRESS, now) || check(`acct:${ip}|${email}`, MAX_PER_ACCOUNT, now);
}

export async function recordFailure(email: string): Promise<void> {
  const now = Date.now();
  const ip = await clientAddress();
  for (const [key, limit] of [[`ip:${ip}`, MAX_PER_ADDRESS], [`acct:${ip}|${email}`, MAX_PER_ACCOUNT]] as const) {
    const bucket = attempts.get(key) ?? { failures: [], blockedUntil: 0 };
    bucket.failures = bucket.failures.filter((t) => now - t < WINDOW_MS);
    bucket.failures.push(now);
    if (bucket.failures.length >= limit) bucket.blockedUntil = now + WINDOW_MS;
    remember(key, bucket);
  }
}

export async function clearFailures(email: string): Promise<void> {
  const ip = await clientAddress();
  attempts.delete(`acct:${ip}|${email}`);
  attempts.delete(`ip:${ip}`);
}
