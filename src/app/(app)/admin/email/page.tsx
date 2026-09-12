import { requireAdmin } from "@/lib/auth/current";
import { getSettings } from "@/lib/settings";
import { isEmailConfigured, recentMail } from "@/lib/email";
import { PROVIDER_LABELS, publicMailSettings } from "@/lib/email/providers";
import { MailForm } from "@/components/admin/mail-form";
import { Section } from "@/components/ui/page";
import { Icon } from "@/components/ui/icon";
import { Empty } from "@/components/ui/empty";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email" };

export default async function AdminEmailPage() {
  const admin = await requireAdmin();
  const mail = getSettings().mail;
  const log = recentMail();
  return (
    <div className="flex flex-col gap-6 px-4 py-5 sm:px-6">
      <p className="m-0 max-w-[68ch] text-ink-2">
        With this set up, invites are emailed the moment you create one, and people are told about mentions, tasks assigned to them and client feedback.
      </p>
      <MailForm
        mail={publicMailSettings(mail)}
        configured={isEmailConfigured(mail)}
        hasSecret={{ smtpPass: !!mail.smtp.pass, apiKey: !!mail.apiKey }}
        adminEmail={admin.email}
      />
      <Section title="Recent deliveries" className="max-w-3xl">
        {log.length === 0 ? (
          <Empty icon="mail" title="Nothing sent yet" hint="Send a test email and it will show up here, along with anything that fails." />
        ) : (
          <ul className="m-0 list-none divide-y divide-line-2 rounded-lg border border-line p-0">
            {log.map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-3 py-2">
                <Icon name={row.ok ? "check-circle" : "alert"} size={15} className={row.ok ? "mt-0.5 text-done" : "mt-0.5 text-late"} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{row.subject}</span>
                  <span className="block truncate text-xs text-ink-3">
                    {row.to} · {PROVIDER_LABELS[row.provider as keyof typeof PROVIDER_LABELS] ?? row.provider}
                    {row.error ? ` · ${row.error}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-ink-3">{timeAgo(row.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
