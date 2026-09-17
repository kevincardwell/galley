import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { db, schema, UPLOAD_DIR } from "@/db/client";
import { BACKUP_DIR, createBackup, lastBackupStatus, listBackups, pruneBackups } from "@/lib/backup";
import { runScheduledBackupIfDue } from "@/lib/backup/scheduler";
import { saveSettings } from "@/lib/settings";

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

  it("writes the zip atomically and privately", async () => {
    const row = await createBackup({ createdBy: null, kind: "manual" });
    const file = path.join(BACKUP_DIR, row.filename);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".part"))).toEqual([]);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it("runs a missed scheduled backup after its hour, once, and records it", async () => {
    db.delete(schema.backups).run();
    saveSettings({ backup: { enabled: true, hour: 0, keep: 5 } });
    // Midday: the 00:00 hour has passed while the container was down, so this is the catch-up.
    const at = new Date();
    at.setHours(12, 0, 0, 0);

    expect(await runScheduledBackupIfDue(at)).toBe(true);
    expect(listBackups()).toHaveLength(1);
    expect(lastBackupStatus()?.ok).toBe(true);
    // Same day, a second pass does nothing.
    expect(await runScheduledBackupIfDue(at)).toBe(false);
  });

  it("does not run before its hour", async () => {
    saveSettings({ backup: { enabled: true, hour: 23, keep: 5 } });
    const at = new Date();
    at.setHours(0, 30, 0, 0);
    expect(await runScheduledBackupIfDue(at)).toBe(false);
  });
});
