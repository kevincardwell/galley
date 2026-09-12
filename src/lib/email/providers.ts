/**
 * Where mail goes out. SMTP works everywhere but many hosts block outbound 25/465/587,
 * so the HTTP providers are there for anyone who cannot open a socket.
 * Pure config: no server-only imports, so the admin UI can render from the same list.
 */
export const MAIL_PROVIDERS = ["none", "smtp", "resend", "postmark", "sendgrid", "mailgun"] as const;
export type MailProvider = (typeof MAIL_PROVIDERS)[number];

export type MailSettings = {
  provider: MailProvider;
  from: string;
  replyTo: string;
  smtp: { host: string; port: number; user: string; pass: string };
  apiKey: string;
  /** Mailgun only: the sending domain, and whether the account lives in the EU region. */
  domain: string;
  euRegion: boolean;
};

export const MAIL_DEFAULTS: MailSettings = {
  provider: "none",
  from: "",
  replyTo: "",
  smtp: { host: "", port: 587, user: "", pass: "" },
  apiKey: "",
  domain: "",
  euRegion: false,
};

/** What the admin form is allowed to see: the same shape minus anything secret. */
export type PublicMailSettings = Omit<MailSettings, "apiKey" | "smtp"> & { smtp: Omit<MailSettings["smtp"], "pass"> };

export function publicMailSettings(mail: MailSettings): PublicMailSettings {
  const { apiKey: _apiKey, smtp, ...rest } = mail;
  const { pass: _pass, ...smtpRest } = smtp;
  return { ...rest, smtp: smtpRest };
}

export const PROVIDER_LABELS: Record<MailProvider, string> = {
  none: "Do not send email",
  smtp: "SMTP server",
  resend: "Resend",
  postmark: "Postmark",
  sendgrid: "SendGrid",
  mailgun: "Mailgun",
};

export const PROVIDER_HINTS: Record<MailProvider, string> = {
  none: "Invites still work: you copy the link and send it yourself.",
  smtp: "Any mail server, including your own or a Google Workspace or Microsoft 365 account.",
  resend: "API key from resend.com. Good choice when your host blocks SMTP ports.",
  postmark: "Server API token from postmarkapp.com. Strong on transactional delivery.",
  sendgrid: "API key from sendgrid.com with the Mail Send permission.",
  mailgun: "Sending API key and domain from mailgun.com.",
};

/** Common SMTP servers, so nobody has to go looking for a port number. */
export const SMTP_PRESETS: { id: string; label: string; host: string; port: number; note: string }[] = [
  { id: "custom", label: "Custom or your own server", host: "", port: 587, note: "" },
  { id: "gmail", label: "Gmail or Google Workspace", host: "smtp.gmail.com", port: 587, note: "Use an app password, not your normal password. Two-step verification must be on." },
  { id: "microsoft", label: "Microsoft 365 or Outlook", host: "smtp.office365.com", port: 587, note: "The user is the full mailbox address, and SMTP AUTH must be enabled for it." },
  { id: "fastmail", label: "Fastmail", host: "smtp.fastmail.com", port: 465, note: "Create an app password with SMTP access." },
  { id: "zoho", label: "Zoho Mail", host: "smtp.zoho.eu", port: 465, note: "Use smtp.zoho.com outside the EU." },
  { id: "icloud", label: "iCloud Mail", host: "smtp.mail.me.com", port: 587, note: "Use an app-specific password from your Apple account." },
  { id: "ses", label: "Amazon SES", host: "email-smtp.eu-west-1.amazonaws.com", port: 587, note: "Swap the region in the host. The user and password are SES SMTP credentials, not your AWS keys." },
];

/** Which fields a provider needs, so the form and the validator agree. */
export function requiredFields(provider: MailProvider): Array<"from" | "host" | "apiKey" | "domain"> {
  switch (provider) {
    case "smtp": return ["from", "host"];
    case "resend":
    case "postmark":
    case "sendgrid": return ["from", "apiKey"];
    case "mailgun": return ["from", "apiKey", "domain"];
    default: return [];
  }
}
