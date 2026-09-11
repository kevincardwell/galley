import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { db, schema, UPLOAD_DIR } from "@/db/client";
import { BACKUP_DIR, createBackup, listBackups, pruneBackups } from "@/lib/backup";

describe("backups", () => {
  it("writes a zip with the db and uploads, and records a row", async () => {
    db.insert(schema.users).values({ id: "bk-user", email: "bk@x.test", name: "Backup Person", passwordHash: "" }).run();
    fs.mkdirSync(path.join(UPLOAD_DIR, "ws1", "asset1"), { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, "ws1", "asset1", "original.jpg"), Buffer.alloc(2048, 7));

    const row = await createBackup({ createdBy: "bk-user", kind: "manual" });
    expect(row.filename).toMatch(/^galley-\d{8}-\d{6}(-[a-z0-9]{4})?\.zip$/);
    const file = path.join(BACKUP_DIR, row.filename);
    expect(fs.existsSync(file)).toBe(true);
    const size = fs.statSync(file).size;
    expect(size).toBeGreaterThan(0);
    expect(row.bytes).toBe(size);
    expect(row.kind).toBe("manual");
    expect(row.createdBy).toBe("bk-user");
    // Zip local-file header, and the VACUUM INTO temp copy has been cleaned up.
    expect(fs.readFileSync(file).subarray(0, 2).toString()).toBe("PK");
    expect(fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".db"))).toEqual([]);
    expect(listBackups().some((b) => b.id === row.id)).toBe(true);
  });

  it("prune keeps the newest N", async () => {
    for (let i = 0; i < 3; i++) await createBackup({ createdBy: null, kind: "scheduled" });
    const before = listBackups();
    expect(before.length).toBeGreaterThanOrEqual(4);
    const removed = await pruneBackups(2);
    expect(removed).toBe(before.length - 2);
    const after = listBackups();
    expect(after.map((b) => b.id)).toEqual(before.slice(0, 2).map((b) => b.id));
    for (const b of after) expect(fs.existsSync(path.join(BACKUP_DIR, b.filename))).toBe(true);
    for (const b of before.slice(2)) expect(fs.existsSync(path.join(BACKUP_DIR, b.filename))).toBe(false);
  });
});
