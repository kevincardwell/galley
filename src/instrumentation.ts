/** Runs once per server boot. Arms background timers that must not depend on a page being visited. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/backup/scheduler");
  }
}
