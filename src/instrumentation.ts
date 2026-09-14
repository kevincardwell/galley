/** Runs once per server boot. Arms background timers that must not depend on a page being visited. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Touch the database first, outside anything that swallows errors: migrations
    // run on the first open, and a failed upgrade should crash the boot loudly
    // rather than surface later as 500s on an apparently healthy container.
    const { sqlite, DATA_DIR } = await import("@/db/client");
    sqlite.prepare("select 1").get();
    console.log(`Galley ${process.env.GALLEY_VERSION || "dev"} started — data directory ${DATA_DIR}`);

    await import("@/lib/backup/scheduler");
    await import("@/lib/digest/scheduler");
    const { ensureMediaWorker } = await import("@/lib/media/process");
    ensureMediaWorker();
  }
}
