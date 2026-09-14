import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

export const DATA_DIR = process.env.GALLEY_DATA_DIR || path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_PATH = path.join(DATA_DIR, "galley.db");

// Search tables live outside Drizzle's schema: FTS5 virtual tables kept in sync by triggers.
const FTS_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(workspace_id UNINDEXED, kind UNINDEXED, subject_id UNINDEXED, title, body, tokenize='porter unicode61');

CREATE TRIGGER IF NOT EXISTS tasks_fts_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO search_fts(workspace_id, kind, subject_id, title, body) VALUES (new.workspace_id, 'task', new.id, new.title, new.body);
END;
CREATE TRIGGER IF NOT EXISTS tasks_fts_au AFTER UPDATE ON tasks BEGIN
  DELETE FROM search_fts WHERE kind='task' AND subject_id=old.id;
  INSERT INTO search_fts(workspace_id, kind, subject_id, title, body) VALUES (new.workspace_id, 'task', new.id, new.title, new.body);
END;
CREATE TRIGGER IF NOT EXISTS tasks_fts_ad AFTER DELETE ON tasks BEGIN
  DELETE FROM search_fts WHERE kind='task' AND subject_id=old.id;
END;

CREATE TRIGGER IF NOT EXISTS sections_fts_ai AFTER INSERT ON sections BEGIN
  INSERT INTO search_fts(workspace_id, kind, subject_id, title, body) VALUES (new.workspace_id, 'section', new.id, new.title, new.plain_text);
END;
CREATE TRIGGER IF NOT EXISTS sections_fts_au AFTER UPDATE ON sections BEGIN
  DELETE FROM search_fts WHERE kind='section' AND subject_id=old.id;
  INSERT INTO search_fts(workspace_id, kind, subject_id, title, body) VALUES (new.workspace_id, 'section', new.id, new.title, new.plain_text);
END;
CREATE TRIGGER IF NOT EXISTS sections_fts_ad AFTER DELETE ON sections BEGIN
  DELETE FROM search_fts WHERE kind='section' AND subject_id=old.id;
END;

CREATE TRIGGER IF NOT EXISTS assets_fts_ai AFTER INSERT ON assets BEGIN
  INSERT INTO search_fts(workspace_id, kind, subject_id, title, body) VALUES (new.workspace_id, 'asset', new.id, new.filename, '');
END;
CREATE TRIGGER IF NOT EXISTS assets_fts_au AFTER UPDATE ON assets BEGIN
  DELETE FROM search_fts WHERE kind='asset' AND subject_id=old.id;
  INSERT INTO search_fts(workspace_id, kind, subject_id, title, body) VALUES (new.workspace_id, 'asset', new.id, new.filename, '');
END;
CREATE TRIGGER IF NOT EXISTS assets_fts_ad AFTER DELETE ON assets BEGIN
  DELETE FROM search_fts WHERE kind='asset' AND subject_id=old.id;
END;
`;

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");
/** Pre-migration snapshots to keep. Enough to step back from a bad upgrade, not enough to fill the disk. */
const KEEP_PRE_MIGRATION = 3;

/**
 * Copies the database aside before an upgrade applies new migrations.
 *
 * Migrations are forward-only and Drizzle writes no down files, so this snapshot
 * is the whole rollback story: stop the container, put this file back as
 * galley.db, run the older image. Skipped on a fresh database, where there is
 * nothing to lose yet.
 */
function snapshotBeforeMigrate(sqlite: Database.Database) {
  const table = sqlite.prepare("select name from sqlite_master where type='table' and name='__drizzle_migrations'").get();
  if (!table) return; // first boot
  const { n } = sqlite.prepare("select count(*) as n from __drizzle_migrations").get() as { n: number };
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).length;
  if (n >= files) return; // nothing pending

  const dir = path.join(DATA_DIR, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  sqlite.exec(`VACUUM INTO '${path.join(dir, `pre-migration-${stamp}.db`).replace(/'/g, "''")}'`);
  console.log(`Galley: ${files - n} migration(s) pending, snapshot written to backups/pre-migration-${stamp}.db`);

  const old = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("pre-migration-") && f.endsWith(".db"))
    .sort()
    .slice(0, -KEEP_PRE_MIGRATION);
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
}

function open() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const sqlite = new Database(DB_PATH);
  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("synchronous = NORMAL");
    snapshotBeforeMigrate(sqlite);
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    sqlite.exec(FTS_SQL);
    return { db, sqlite };
  } catch (err) {
    // Without this the handle leaks and store() opens another one on the next
    // request, against a half-migrated file, until the process runs out of fds.
    sqlite.close();
    throw err;
  }
}

const g = globalThis as unknown as { __galley?: ReturnType<typeof open> };

/**
 * Opens on first use, not on import.
 *
 * `next build` imports every route module to read its config, and an import-time connection meant
 * the build opened a database, ran migrations and wrote a stray data directory into the image
 * layer. Under emulated arm64 that was slow enough to fail the build outright.
 */
function store() {
  if (!g.__galley) g.__galley = open();
  return g.__galley;
}

/** Forwards to the real handle on first touch, keeping methods bound to their owner. */
function lazy<T extends object>(pick: (s: ReturnType<typeof open>) => T): T {
  const bound = new WeakMap<object, Map<PropertyKey, unknown>>();
  return new Proxy({} as T, {
    get(_target, prop) {
      const target = pick(store()) as Record<PropertyKey, unknown>;
      const value = target[prop];
      if (typeof value !== "function") return value;
      let cache = bound.get(target);
      if (!cache) bound.set(target, (cache = new Map()));
      let fn = cache.get(prop);
      if (!fn) cache.set(prop, (fn = (value as (...args: unknown[]) => unknown).bind(target)));
      return fn;
    },
    has: (_t, prop) => prop in (pick(store()) as object),
  });
}

export const db = lazy((s) => s.db);
export const sqlite = lazy((s) => s.sqlite);
export { schema };
