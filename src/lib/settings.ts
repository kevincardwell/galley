import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type BackupSettings = { enabled: boolean; hour: number; keep: number };

export type InstanceSettings = {
  instanceName: string;
  baseUrl: string;
  maxUploadMb: number;
  sessionDays: number;
  smtp: { host: string; port: number; user: string; pass: string; from: string } | null;
  backup: BackupSettings;
};

const DEFAULTS: InstanceSettings = {
  instanceName: "Galley",
  baseUrl: process.env.GALLEY_URL || "",
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 500),
  sessionDays: 30,
  smtp: null,
  backup: { enabled: false, hour: 3, keep: 7 },
};

export function getSettings(): InstanceSettings {
  const row = db.select().from(schema.settings).where(eq(schema.settings.key, "instance")).get();
  const stored = (row?.value as Partial<InstanceSettings>) ?? {};
  return { ...DEFAULTS, ...stored, backup: { ...DEFAULTS.backup, ...(stored.backup ?? {}) } };
}

export function saveSettings(patch: Partial<InstanceSettings>) {
  const next = { ...getSettings(), ...patch };
  db.insert(schema.settings)
    .values({ key: "instance", value: next })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: next } })
    .run();
  return next;
}

export function hasAnyUser(): boolean {
  return !!db.select({ id: schema.users.id }).from(schema.users).limit(1).get();
}
