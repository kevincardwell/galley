import { requireAdmin } from "@/lib/auth/current";
import { getSettings } from "@/lib/settings";
import { isEmailConfigured, recentMail } from "@/lib/email";
import { publicMailSettings } from "@/lib/email/providers";
import { MailForm } from "@/components/admin/mail-form";
import { DigestForm } from "@/components/admin/digest-form";
import { MailLog } from "@/components/admin/mail-log";
import { digestCandidates } from "@/lib/digest";
import { Section } from "@/components/ui/page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email" };

export default async function AdminEmailPage() {
  const admin = await requireAdmin();
  const { mail, digest } = getSettings();
  const log = recentMail();
  const candidates = digestCandidates().length;
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
      <DigestForm settings={digest} configured={isEmailConfigured(mail)} projects={candidates} />
      <Section title="Recent deliveries" className="max-w-3xl">
        <MailLog rows={log} />
      </Section>
    </div>
  );
}
