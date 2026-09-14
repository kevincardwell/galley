/**
 * Plain-text-first email templates. The HTML variant stays deliberately simple:
 * no images, no external CSS, nothing that needs to be fetched, tables for
 * layout and styles inlined, because that is the subset every mail client
 * agrees on. Georgia and the system stack are the only fonts, since a client
 * that cannot load a webfont would fall back unpredictably.
 */
export type EmailContent = { subject: string; text: string; html: string };

/** A labelled list, e.g. "What we did" over a set of bullets. */
export type EmailList = { label: string; items: string[] };
export type EmailBody = {
  /** Big line at the top. Falls back to the instance name if absent. */
  heading?: string;
  paragraphs?: string[];
  lists?: EmailList[];
  cta?: { label: string; url: string };
  /** Small print under the rule, above the sign-off. */
  note?: string;
};

const INK = "#1b1b1b";
const MUTED = "#6b6b66";
const LINE = "#e3e3df";
const PAPER = "#f6f6f4";
const ACCENT = "#2F6B4F";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function listBlock({ label, items }: EmailList) {
  if (items.length === 0) return "";
  const rows = items
    .map(
      (item) =>
        `<tr><td style="padding:0 0 6px;vertical-align:top;width:16px;color:${ACCENT};font-size:15px;line-height:22px">&bull;</td>` +
        `<td style="padding:0 0 6px;font-size:15px;line-height:22px;color:${INK}">${esc(item)}</td></tr>`,
    )
    .join("");
  return (
    `<p style="margin:22px 0 8px;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${MUTED}">${esc(label)}</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">${rows}</table>`
  );
}

/** The one shell every Galley email uses. */
function shell(instanceName: string, body: EmailBody) {
  const heading = body.heading ?? instanceName;
  const paragraphs = (body.paragraphs ?? [])
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:23px;color:${INK}">${esc(p)}</p>`)
    .join("");
  const lists = (body.lists ?? []).map(listBlock).join("");
  const cta = body.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 8px">` +
      `<tr><td style="border-radius:8px;background:${ACCENT}">` +
      `<a href="${esc(body.cta.url)}" style="display:inline-block;padding:11px 20px;font-family:${SANS};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${esc(body.cta.label)}</a>` +
      `</td></tr></table>` +
      `<p style="margin:0 0 4px;font-size:12px;line-height:18px;color:${MUTED};word-break:break-all">${esc(body.cta.url)}</p>`
    : "";
  const note = body.note ? `<p style="margin:18px 0 0;font-size:13px;line-height:20px;color:${MUTED}">${esc(body.note)}</p>` : "";

  return (
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light"></head>` +
    `<body style="margin:0;padding:0;background:${PAPER};-webkit-font-smoothing:antialiased">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${PAPER}">` +
    `<tr><td align="center" style="padding:28px 14px">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:12px">` +
    `<tr><td style="padding:12px 26px;border-bottom:1px solid ${LINE};font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${MUTED}">${esc(instanceName)}</td></tr>` +
    `<tr><td style="padding:26px 26px 28px;font-family:${SANS}">` +
    `<h1 style="margin:0 0 16px;font-family:${SERIF};font-size:25px;line-height:32px;font-weight:500;color:${INK}">${esc(heading)}</h1>` +
    paragraphs +
    lists +
    cta +
    note +
    `</td></tr></table>` +
    `<p style="margin:14px 0 0;font-family:${SANS};font-size:12px;color:${MUTED}">Sent by ${esc(instanceName)}.</p>` +
    `</td></tr></table></body></html>`
  );
}

/** The same content as the HTML, for clients that show text only. */
function asText(body: EmailBody, instanceName: string): string {
  const out: string[] = [];
  if (body.heading) out.push(body.heading, "");
  for (const p of body.paragraphs ?? []) out.push(p, "");
  for (const list of body.lists ?? []) {
    if (list.items.length === 0) continue;
    out.push(`${list.label}:`, ...list.items.map((i) => `  - ${i}`), "");
  }
  if (body.cta) out.push(`${body.cta.label}: ${body.cta.url}`, "");
  if (body.note) out.push(body.note, "");
  out.push(`Sent by ${instanceName}.`);
  return out.join("\n");
}

function build(instanceName: string, subject: string, body: EmailBody): EmailContent {
  return { subject, text: asText(body, instanceName), html: shell(instanceName, body) };
}

export function inviteEmail(input: { instanceName: string; url: string; inviterName?: string | null; workspaceName?: string | null; expiresDays: number }): EmailContent {
  const { instanceName, url, inviterName, workspaceName, expiresDays } = input;
  const who = inviterName ? `${inviterName} has invited you` : "You have been invited";
  const where = workspaceName ? ` to work on ${workspaceName}` : ` to ${instanceName}`;
  return build(instanceName, `You've been invited to ${instanceName}`, {
    heading: workspaceName ? `Come and work on ${workspaceName}` : `You've been invited to ${instanceName}`,
    paragraphs: [`${who}${where}.`, "Use the button below to set up your account."],
    cta: { label: "Accept the invite", url },
    note: `The link stops working after ${expiresDays} days.`,
  });
}

export function notificationEmail(input: { instanceName: string; title: string; body?: string | null; url?: string | null }): EmailContent {
  const { instanceName, title, body, url } = input;
  return build(instanceName, `${title} · ${instanceName}`, {
    heading: title,
    paragraphs: body ? [body] : [],
    cta: url ? { label: `Open in ${instanceName}`, url } : undefined,
  });
}

export function testEmail(input: { instanceName: string }): EmailContent {
  const { instanceName } = input;
  return build(instanceName, `Test email from ${instanceName}`, {
    heading: "Email is working",
    paragraphs: [
      "This is a test message from your Galley instance.",
      "If you are reading it, sending is set up correctly, so invites, notifications and the weekly client digest will all go out.",
    ],
  });
}

/** The weekly note to a client: what the studio did, and what it is waiting on. */
export function digestEmail(input: {
  instanceName: string;
  projectName: string;
  changes: string[];
  waitingOn: string[];
  shareUrl: string;
}): EmailContent {
  const { instanceName, projectName, changes, waitingOn, shareUrl } = input;
  const subject = waitingOn.length
    ? `${projectName}: ${waitingOn.length} thing${waitingOn.length === 1 ? "" : "s"} to look at`
    : `${projectName}: this week`;
  return build(instanceName, subject, {
    heading: `${projectName} this week`,
    paragraphs: changes.length
      ? []
      : ["Nothing changed on our side this week, but there are still a couple of things waiting on you."],
    lists: [
      { label: "What we did", items: changes },
      { label: waitingOn.length === 1 ? "Waiting on you" : `Waiting on you (${waitingOn.length})`, items: waitingOn },
    ],
    cta: { label: "Open the project", url: shareUrl },
    note: "Reply to this email and it reaches us.",
  });
}
