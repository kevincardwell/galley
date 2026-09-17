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
    if (process.env.NODE_ENV === "production" && !process.env.GALLEY_URL) {
      console.warn(
        "[config] GALLEY_URL is not set: session cookies are marked Secure by default, so a plain-http address (a LAN IP, for instance) will look like a login loop. Set GALLEY_URL to the address people use, or to an http:// one if that really is the address.",
      );
    }
    const { forwardAuthConfig } = await import("@/lib/auth/forward");
    const auth = forwardAuthConfig();
    if (auth.enabled && !auth.secret) {
      console.warn(
        "[auth] GALLEY_AUTH_HEADERS is on without GALLEY_AUTH_SECRET: anyone who can reach this port can become any user. Set the secret and have the proxy send it in x-galley-auth, or keep the port unreachable from outside the proxy.",
      );
    }
    const { ensureMediaWorker } = await import("@/lib/media/process");
    ensureMediaWorker();
  }
}
