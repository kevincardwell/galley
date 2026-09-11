import { headers } from "next/headers";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

type Entry = { failures: number[]; blockedUntil: number };
const attempts = new Map<string, Entry>();

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "local";
}

async function keyFor(email: string): Promise<string> {
  return `${await clientIp()}|${email.toLowerCase()}`;
}

function prune(entry: Entry, now: number) {
  entry.failures = entry.failures.filter((t) => now - t < WINDOW_MS);
}

/** True when this ip+email pair has exhausted its attempts and is inside the cool-off. */
export async function isThrottled(email: string): Promise<boolean> {
  const key = await keyFor(email);
  const entry = attempts.get(key);
  if (!entry) return false;
  const now = Date.now();
  if (entry.blockedUntil > now) return true;
  prune(entry, now);
  if (entry.failures.length === 0 && entry.blockedUntil <= now) attempts.delete(key);
  return false;
}

export async function recordFailure(email: string): Promise<void> {
  const key = await keyFor(email);
  const now = Date.now();
  const entry = attempts.get(key) ?? { failures: [], blockedUntil: 0 };
  prune(entry, now);
  entry.failures.push(now);
  if (entry.failures.length >= MAX_FAILURES) {
    entry.blockedUntil = now + WINDOW_MS;
    entry.failures = [];
  }
  attempts.set(key, entry);
  if (attempts.size > 10_000) {
    for (const [k, v] of attempts) if (v.blockedUntil <= now && v.failures.every((t) => now - t >= WINDOW_MS)) attempts.delete(k);
  }
}

export async function clearFailures(email: string): Promise<void> {
  attempts.delete(await keyFor(email));
}
