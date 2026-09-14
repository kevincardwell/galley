import "server-only";
import { getSettings } from "@/lib/settings";
import { isEmailConfigured } from "@/lib/email";
import { digestCandidates, sendWorkspaceDigest } from "./index";

/**
 * Sends the weekly client digest on the configured weekday and hour, once.
 *
 * Armed once per process on module load, like the backup scheduler. The guard
 * against sending twice is `workspaces.digest_sent_at` rather than a flag in
 * memory, so a restart inside the sending hour does not mean a second email.
 */
const TICK_MS = 60_000;
const g = globalThis as unknown as { __galleyDigestTimer?: ReturnType<typeof setInterval>; __galleyDigestRunning?: boolean };

/** One scheduler pass. Exported for the admin action and tests; safe to call at any time. */
export async function runWeeklyDigestIfDue(now = new Date()): Promise<number> {
  const { digest } = getSettings();
  if (!digest.enabled || g.__galleyDigestRunning) return 0;
  if (now.getDay() !== digest.weekday || now.getHours() !== digest.hour) return 0;
  if (!isEmailConfigured()) return 0;

  g.__galleyDigestRunning = true;
  try {
    let sent = 0;
    for (const ws of digestCandidates()) {
      try {
        if (await sendWorkspaceDigest(ws, now)) sent++;
      } catch (err) {
        console.error(`[digest] ${ws.slug} failed:`, err instanceof Error ? err.message : err);
      }
    }
    if (sent) console.log(`[digest] sent ${sent} client digest(s)`);
    return sent;
  } finally {
    g.__galleyDigestRunning = false;
  }
}

export function armDigestScheduler() {
  if (g.__galleyDigestTimer) return;
  const timer = setInterval(() => void runWeeklyDigestIfDue(), TICK_MS);
  timer.unref?.(); // never keep the process (or a test run) alive on its own
  g.__galleyDigestTimer = timer;
}

// Not during `next build`: collecting page data imports this module, and a build should never
// start a timer or touch the database.
if (process.env.NEXT_PHASE !== "phase-production-build") armDigestScheduler();
