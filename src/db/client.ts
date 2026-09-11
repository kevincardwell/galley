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

function open() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  sqlite.exec(FTS_SQL);
  return { db, sqlite };
}

const g = globalThis as unknown as { __galley?: ReturnType<typeof open> };
if (!g.__galley) g.__galley = open();

export const db = g.__galley.db;
export const sqlite = g.__galley.sqlite;
export { schema };
