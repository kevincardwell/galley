/**
 * Plain-text-first email templates. The HTML variant is deliberately minimal:
 * no images, no external CSS, nothing that needs to be fetched.
 */
export type EmailContent = { subject: string; text: string; html: string };

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrap(instanceName: string, lines: string[], cta?: { label: string; url: string }) {
  const paragraphs = lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join("");
  const button = cta
    ? `<p style="margin:16px 0"><a href="${esc(cta.url)}" style="display:inline-block;padding:8px 14px;border:1px solid #2F6B4F;border-radius:6px;background:#2F6B4F;color:#fff;text-decoration:none;font-weight:600">${esc(cta.label)}</a></p><p style="margin:0 0 12px;color:#666;font-size:13px">Or paste this link into your browser:<br>${esc(cta.url)}</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f4;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1b1b1b"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e3e3df;border-radius:6px;padding:24px"><p style="margin:0 0 16px;font-weight:600">${esc(instanceName)}</p>${paragraphs}${button}<p style="margin:16px 0 0;color:#888;font-size:12px">Sent by ${esc(instanceName)}.</p></div></body></html>`;
}

export function inviteEmail(input: { instanceName: string; url: string; inviterName?: string | null; workspaceName?: string | null; expiresDays: number }): EmailContent {
  const { instanceName, url, inviterName, workspaceName, expiresDays } = input;
  const who = inviterName ? `${inviterName} has invited you` : "You have been invited";
  const where = workspaceName ? ` to work on ${workspaceName} in ${instanceName}` : ` to ${instanceName}`;
  const lines = [`${who}${where}.`, `Use the link below to set up your account. It stops working after ${expiresDays} days.`];
  return {
    subject: `You've been invited to ${instanceName}`,
    text: `${lines.join("\n\n")}\n\n${url}\n\n— ${instanceName}`,
    html: wrap(instanceName, lines, { label: "Accept invite", url }),
  };
}

export function notificationEmail(input: { instanceName: string; title: string; body?: string | null; url?: string | null }): EmailContent {
  const { instanceName, title, body, url } = input;
  const lines = [title, ...(body ? [body] : [])];
  return {
    subject: `${title} · ${instanceName}`,
    text: `${lines.join("\n\n")}${url ? `\n\n${url}` : ""}\n\n— ${instanceName}`,
    html: wrap(instanceName, lines, url ? { label: "Open in " + instanceName, url } : undefined),
  };
}

export function testEmail(input: { instanceName: string }): EmailContent {
  const { instanceName } = input;
  const lines = ["This is a test message from your Galley instance.", "If you are reading it, SMTP is set up correctly and invite links and notifications will be emailed."];
  return {
    subject: `Test email from ${instanceName}`,
    text: `${lines.join("\n\n")}\n\n— ${instanceName}`,
    html: wrap(instanceName, lines),
  };
}
