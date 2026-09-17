import "server-only";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getSettings } from "@/lib/settings";
import { createBackup, pruneBackups, recordBackupStatus } from "./index";

/**
 * Runs one scheduled backup a day at `settings.backup.hour` (server local time), then prunes to `keep`.
 * Armed once per process on module load; import this (or `@/lib/backup`) from something that runs on boot.
 */
const TICK_MS = 60_000;
/** After a failure, wait this long before trying again rather than logging once a minute. */
const RETRY_AFTER_FAILURE_MS = 15 * 60_000;
const g = globalThis as unknown as {
  __galleyBackupTimer?: ReturnType<typeof setInterval>;
  __galleyBackupRunning?: boolean;
  __galleyBackupRetryAt?: number;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function hasBackupToday(): boolean {
  const latest = db.select({ createdAt: schema.backups.createdAt }).from(schema.backups).orderBy(desc(schema.backups.createdAt)).limit(1).get();
  return !!latest && latest.createdAt >= startOfToday();
}

/** One scheduler pass. Exported for the admin action and tests; safe to call at any time. */
export async function runScheduledBackupIfDue(now = new Date()): Promise<boolean> {
  const { backup } = getSettings();
  if (!backup.enabled || g.__galleyBackupRunning) return false;
  // One a day, at or after the chosen hour. If the container was down when the hour passed, the
  // first tick after it starts still writes today's backup instead of skipping the whole day.
  if (now.getHours() < backup.hour) return false;
  if (hasBackupToday()) return false;
  if (g.__galleyBackupRetryAt && now.getTime() < g.__galleyBackupRetryAt) return false;

  g.__galleyBackupRunning = true;
  try {
    const row = await createBackup({ createdBy: null, kind: "scheduled" });
    const pruned = await pruneBackups(backup.keep);
    recordBackupStatus(true, `${row.filename} (${row.bytes} bytes), pruned ${pruned}`);
    console.log(`[backup] scheduled backup ${row.filename} written (${row.bytes} bytes), pruned ${pruned}`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordBackupStatus(false, message);
    g.__galleyBackupRetryAt = now.getTime() + RETRY_AFTER_FAILURE_MS;
    console.error("[backup] scheduled backup failed:", message);
    return false;
  } finally {
    g.__galleyBackupRunning = false;
  }
}

export function armBackupScheduler() {
  if (g.__galleyBackupTimer) return;
  const timer = setInterval(() => void runScheduledBackupIfDue(), TICK_MS);
  timer.unref?.(); // never keep the process (or a test run) alive on its own
  g.__galleyBackupTimer = timer;
}

// Not during `next build`: collecting page data imports this module, and a build should never
// start a timer or touch the database.
if (process.env.NEXT_PHASE !== "phase-production-build") armBackupScheduler();
