import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getSettings } from "@/lib/settings";

export type SendEmailInput = { to: string; subject: string; text: string; html?: string };
export type SendEmailResult = { ok: true; messageId?: string } | { ok: false; error: string };

/** True when SMTP has a host and a from address; the rest is optional (open relays, local sendmail-style hosts). */
export function isEmailConfigured(): boolean {
  const smtp = getSettings().smtp;
  return !!(smtp && smtp.host.trim() && smtp.from.trim());
}

// Cache the transporter per SMTP config so the pool is reused across sends.
let cached: { key: string; transport: Transporter } | null = null;

function transporter(): Transporter | null {
  const smtp = getSettings().smtp;
  if (!smtp || !smtp.host.trim() || !smtp.from.trim()) return null;
  const key = JSON.stringify(smtp);
  if (cached?.key === key) return cached.transport;
  const transport = nodemailer.createTransport({
    host: smtp.host.trim(),
    port: smtp.port,
    secure: smtp.port === 465,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  cached = { key, transport };
  return transport;
}

/** Sends one message. Never throws: failures are logged and returned as `{ ok: false, error }`. */
export async function sendEmail({ to, subject, text, html }: SendEmailInput): Promise<SendEmailResult> {
  try {
    const transport = transporter();
    if (!transport) return { ok: false, error: "Email is not set up. Add SMTP details in Admin → Settings." };
    const from = getSettings().smtp!.from;
    const info = await transport.sendMail({ from, to, subject, text, html });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[email] failed to send "${subject}" to ${to}: ${error}`);
    return { ok: false, error };
  }
}
