import "server-only";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { ZipArchive } from "archiver";
import { desc, eq } from "drizzle-orm";
import { db, schema, sqlite, DATA_DIR, UPLOAD_DIR } from "@/db/client";
import { newId } from "@/lib/ids";
import "./scheduler"; // arms the scheduled-backup interval whenever this module is loaded

export const BACKUP_DIR = path.join(DATA_DIR, "backups");
const FAVICON_DIR = path.join(DATA_DIR, "favicons");

export type BackupKind = "manual" | "scheduled";
export type BackupRow = typeof schema.backups.$inferSelect;

/** How the most recent backup attempt went, successful or not. */
export type BackupStatus = { at: number; ok: boolean; message: string };

/**
 * Records the result of an attempt in the settings table. The list only ever shows zips that
 * exist, so without this a nightly failure is invisible outside the container log.
 */
export function recordBackupStatus(ok: boolean, message: string) {
  const value: BackupStatus = { at: Math.floor(Date.now() / 1000), ok, message };
  db.insert(schema.settings)
    .values({ key: "backup.status", value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } })
    .run();
}

export function lastBackupStatus(): BackupStatus | null {
  const row = db.select().from(schema.settings).where(eq(schema.settings.key, "backup.status")).get();
  return (row?.value as BackupStatus | undefined) ?? null;
}

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Absolute path of a backup's zip. Filenames are generated here, so a bare basename is all that is ever stored. */
export function backupPath(row: Pick<BackupRow, "filename">): string {
  return path.join(BACKUP_DIR, path.basename(row.filename));
}

/**
 * Writes `/data/backups/galley-YYYYMMDD-HHMMSS.zip` containing a consistent copy of the
 * database (VACUUM INTO), every upload and the cached favicons, then records it.
 */
export async function createBackup({ createdBy, kind }: { createdBy: string | null; kind: BackupKind }): Promise<BackupRow> {
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  const id = newId();
  let filename = `galley-${stamp()}.zip`;
  if (fs.existsSync(path.join(BACKUP_DIR, filename))) filename = `galley-${stamp()}-${id.slice(0, 4)}.zip`;
  const zipPath = path.join(BACKUP_DIR, filename);
  // Written under a `.part` name and renamed at the end: a crash midway leaves a part file to
  // sweep up, never a truncated zip that looks like a backup you can restore from.
  const partPath = `${zipPath}.part`;
  const tmpDb = path.join(BACKUP_DIR, `.galley-${id}.db`);

  try {
    // VACUUM INTO writes a transactionally consistent snapshot without blocking writers for long.
    sqlite.exec(`VACUUM INTO '${tmpDb.replace(/'/g, "''")}'`);

    await new Promise<void>((resolve, reject) => {
      const out = fs.createWriteStream(partPath);
      const archive = new ZipArchive({ zlib: { level: 6 } });
      out.on("close", resolve);
      out.on("error", reject);
      archive.on("error", reject);
      archive.on("warning", (err: { code?: string; message: string }) => {
        if (err.code === "ENOENT") console.warn(`[backup] ${err.message}`);
        else reject(err);
      });
      archive.pipe(out);
      archive.file(tmpDb, { name: "galley.db" });
      if (fs.existsSync(UPLOAD_DIR)) archive.directory(UPLOAD_DIR, "uploads");
      if (fs.existsSync(FAVICON_DIR)) archive.directory(FAVICON_DIR, "favicons");
      archive.finalize().catch(reject);
    });

    await fsp.rename(partPath, zipPath);
    // A backup zip holds SMTP credentials, password hashes and share tokens; not world-readable.
    try {
      await fsp.chmod(zipPath, 0o600);
    } catch {
      /* best effort: some filesystems (SMB, CIFS) do not do permissions */
    }

    const bytes = (await fsp.stat(zipPath)).size;
    db.insert(schema.backups).values({ id, filename, bytes, kind, createdBy }).run();
    return db.select().from(schema.backups).where(eq(schema.backups.id, id)).get()!;
  } catch (err) {
    await fsp.rm(partPath, { force: true }).catch(() => {});
    await fsp.rm(zipPath, { force: true }).catch(() => {});
    throw err;
  } finally {
    await fsp.rm(tmpDb, { force: true }).catch(() => {});
  }
}

export function listBackups(): BackupRow[] {
  return db.select().from(schema.backups).orderBy(desc(schema.backups.createdAt), desc(schema.backups.id)).all();
}

export function getBackup(id: string): BackupRow | undefined {
  return db.select().from(schema.backups).where(eq(schema.backups.id, id)).get();
}

/** Removes the zip and its row. Returns false when no such backup exists. */
export async function deleteBackup(id: string): Promise<boolean> {
  const row = getBackup(id);
  if (!row) return false;
  try {
    await fsp.rm(backupPath(row), { force: true });
  } catch (err) {
    // The row still goes: keeping it would promise a file nobody can download. Say so, because
    // the orphaned file is otherwise silent.
    console.warn(`[backup] could not remove ${row.filename}:`, err instanceof Error ? err.message : err);
  }
  db.delete(schema.backups).where(eq(schema.backups.id, id)).run();
  return true;
}

/** Keeps the newest `keep` backups and deletes the rest. Returns how many were removed. */
export async function pruneBackups(keep: number): Promise<number> {
  const n = Math.max(0, Math.floor(keep));
  const extra = listBackups().slice(n);
  for (const row of extra) await deleteBackup(row.id);
  return extra.length;
}

/** Plain-language restore instructions shown on the admin page. */
export function restoreNote(): string {
  return [
    "Restoring is manual. Stop the container, then unzip the backup into the data directory so that galley.db, uploads/ and favicons/ replace what is there.",
    "The galley.db inside a backup zip is a complete snapshot, so delete any galley.db-wal and galley.db-shm left beside it before starting again. Only do that when restoring from a zip: deleting the -wal next to a database you copied by hand throws away its most recent writes.",
    "Backups live in the backups/ folder of the same data directory; copy them somewhere else too, since a lost volume takes them with it.",
  ].join(" ");
}
