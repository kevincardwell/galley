import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type InstanceSettings = {
  instanceName: string;
  baseUrl: string;
  maxUploadMb: number;
  sessionDays: number;
  smtp: { host: string; port: number; user: string; pass: string; from: string } | null;
};

const DEFAULTS: InstanceSettings = {
  instanceName: "Galley",
  baseUrl: process.env.GALLEY_URL || "",
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 500),
  sessionDays: 30,
  smtp: null,
};

export function getSettings(): InstanceSettings {
  const row = db.select().from(schema.settings).where(eq(schema.settings.key, "instance")).get();
  return { ...DEFAULTS, ...((row?.value as Partial<InstanceSettings>) ?? {}) };
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
