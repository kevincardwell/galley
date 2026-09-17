import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { MAIL_DEFAULTS, type MailSettings } from "@/lib/email/providers";

export type BackupSettings = { enabled: boolean; hour: number; keep: number };
/** Weekly client digest. `weekday` is 0 (Sunday) to 6, matching Date#getDay. */
export type DigestSettings = { enabled: boolean; weekday: number; hour: number };

export type InstanceSettings = {
  instanceName: string;
  baseUrl: string;
  maxUploadMb: number;
  sessionDays: number;
  /** ISO 4217 code used wherever Galley shows money. One currency per instance. */
  currency: string;
  /** Legacy SMTP-only shape, still read so existing installs keep sending after an upgrade. */
  smtp: { host: string; port: number; user: string; pass: string; from: string } | null;
  mail: MailSettings;
  backup: BackupSettings;
  digest: DigestSettings;
};

const DEFAULTS: InstanceSettings = {
  instanceName: "Galley",
  baseUrl: "",
  maxUploadMb: 500,
  sessionDays: 30,
  currency: "GBP",
  smtp: null,
  mail: MAIL_DEFAULTS,
  backup: { enabled: false, hour: 3, keep: 7 },
  digest: { enabled: false, weekday: 5, hour: 9 }, // Friday morning, off until someone turns it on
};

/**
 * Container-level environment variables are read live, and win over the stored value.
 *
 * The settings page persists whatever it is given, so a stored `baseUrl` written before the
 * variable existed would otherwise shadow it forever: operators change the variable in compose,
 * restart, and nothing happens. Explicit intent from the environment beats a database row.
 */
function envOverrides(): Partial<InstanceSettings> {
  const out: Partial<InstanceSettings> = {};
  const url = process.env.GALLEY_URL?.trim();
  if (url) out.baseUrl = url;
  const mb = Number(process.env.MAX_UPLOAD_MB);
  if (Number.isFinite(mb) && mb > 0) out.maxUploadMb = Math.floor(mb);
  return out;
}

export function getSettings(): InstanceSettings {
  const row = db.select().from(schema.settings).where(eq(schema.settings.key, "instance")).get();
  const stored = (row?.value as Partial<InstanceSettings>) ?? {};
  const mail: MailSettings = {
    ...MAIL_DEFAULTS,
    ...(stored.mail ?? {}),
    smtp: { ...MAIL_DEFAULTS.smtp, ...(stored.mail?.smtp ?? {}) },
  };
  // An install that configured SMTP before providers existed keeps sending without touching anything.
  if (!stored.mail && stored.smtp?.host) {
    mail.provider = "smtp";
    mail.from = stored.smtp.from;
    mail.smtp = { host: stored.smtp.host, port: stored.smtp.port, user: stored.smtp.user, pass: stored.smtp.pass };
  }
  return {
    ...DEFAULTS,
    ...stored,
    ...envOverrides(),
    mail,
    backup: { ...DEFAULTS.backup, ...(stored.backup ?? {}) },
    digest: { ...DEFAULTS.digest, ...(stored.digest ?? {}) },
  };
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
