import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { desc, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getSettings } from "@/lib/settings";
import { requiredFields, type MailProvider, type MailSettings } from "./providers";

export type SendEmailInput = { to: string; subject: string; text: string; html?: string };
export type SendEmailResult = { ok: true; via: MailProvider } | { ok: false; error: string };

/** True when the chosen provider has everything it needs to send. */
export function isEmailConfigured(settings: MailSettings = getSettings().mail): boolean {
  if (settings.provider === "none") return false;
  return requiredFields(settings.provider).every((field) => {
    if (field === "from") return !!settings.from.trim();
    if (field === "host") return !!settings.smtp.host.trim();
    if (field === "apiKey") return !!settings.apiKey.trim();
    return !!settings.domain.trim();
  });
}

export function emailStatus(): { configured: boolean; provider: MailProvider; from: string } {
  const mail = getSettings().mail;
  return { configured: isEmailConfigured(mail), provider: mail.provider, from: mail.from };
}

// One pooled transport per SMTP config, rebuilt when the settings change.
let cached: { key: string; transport: Transporter } | null = null;

function smtpTransport(mail: MailSettings): Transporter {
  const key = JSON.stringify(mail.smtp);
  if (cached?.key === key) return cached.transport;
  const transport = nodemailer.createTransport({
    host: mail.smtp.host.trim(),
    port: mail.smtp.port,
    secure: mail.smtp.port === 465,
    auth: mail.smtp.user ? { user: mail.smtp.user, pass: mail.smtp.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  cached = { key, transport };
  return transport;
}

const TIMEOUT = 15_000;

async function post(url: string, init: RequestInit): Promise<void> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
  if (res.ok) return;
  const body = (await res.text().catch(() => "")).slice(0, 300);
  throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ""}`);
}

async function deliver(mail: MailSettings, { to, subject, text, html }: SendEmailInput): Promise<void> {
  const from = mail.from.trim();
  const replyTo = mail.replyTo.trim() || undefined;
  const key = mail.apiKey.trim();

  switch (mail.provider) {
    case "smtp":
      await smtpTransport(mail).sendMail({ from, to, subject, text, html, replyTo });
      return;

    case "resend":
      await post("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, text, html, reply_to: replyTo }),
      });
      return;

    case "postmark":
      await post("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: { "X-Postmark-Server-Token": key, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ From: from, To: to, Subject: subject, TextBody: text, HtmlBody: html, ReplyTo: replyTo, MessageStream: "outbound" }),
      });
      return;

    case "sendgrid":
      await post("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from },
          reply_to: replyTo ? { email: replyTo } : undefined,
          subject,
          content: [{ type: "text/plain", value: text }, ...(html ? [{ type: "text/html", value: html }] : [])],
        }),
      });
      return;

    case "mailgun": {
      const host = mail.euRegion ? "api.eu.mailgun.net" : "api.mailgun.net";
      const form = new URLSearchParams({ from, to, subject, text });
      if (html) form.set("html", html);
      if (replyTo) form.set("h:Reply-To", replyTo);
      await post(`https://${host}/v3/${encodeURIComponent(mail.domain.trim())}/messages`, {
        method: "POST",
        headers: { authorization: `Basic ${Buffer.from(`api:${key}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      return;
    }

    default:
      throw new Error("Email is switched off.");
  }
}

/** Sends one message and records the attempt. Never throws. */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const mail = getSettings().mail;
  if (!isEmailConfigured(mail)) {
    return { ok: false, error: "Email is not set up yet. Choose a provider in Admin → Email." };
  }
  try {
    await deliver(mail, input);
    record(input, mail.provider, true, null);
    return { ok: true, via: mail.provider };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[email] ${mail.provider} failed to send "${input.subject}" to ${input.to}: ${error}`);
    record(input, mail.provider, false, error);
    return { ok: false, error };
  }
}

/** Keeps the last 100 attempts so an admin can see why mail is not arriving. */
function record(input: SendEmailInput, provider: MailProvider, ok: boolean, error: string | null) {
  try {
    db.insert(schema.mailLog).values({ to: input.to, subject: input.subject, provider, ok, error: error?.slice(0, 500) ?? null }).run();
    db.run(sql`delete from mail_log where id not in (select id from mail_log order by id desc limit 100)`);
  } catch {
    /* logging must never break a send */
  }
}

export function recentMail(limit = 12) {
  return db.select().from(schema.mailLog).orderBy(desc(schema.mailLog.id)).limit(limit).all();
}
