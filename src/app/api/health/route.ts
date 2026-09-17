import fs from "node:fs";
import { DATA_DIR, sqlite } from "@/db/client";

/** Free space below this counts as a full disk for health purposes. */
const MIN_FREE_BYTES = 1024 * 1024;

/**
 * Liveness for the container healthcheck.
 *
 * Reachability is not enough: a volume that has gone read-only, or a disk that has filled up,
 * keeps `select 1` working while uploads and backups fail. So the database has to answer and
 * the data directory has to still be writable with room to spare.
 */
export function GET() {
  const row = sqlite.prepare("select 1 as ok").get() as { ok: number };
  let storage = false;
  try {
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
    const stat = fs.statfsSync(DATA_DIR);
    storage = stat.bavail * stat.bsize > MIN_FREE_BYTES;
  } catch {
    /* read-only mount, missing directory, or a filesystem that cannot answer */
  }
  const ok = row.ok === 1 && storage;
  return Response.json({ ok, storage }, { status: ok ? 200 : 503 });
}
