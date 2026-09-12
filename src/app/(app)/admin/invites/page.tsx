import { requireAdmin } from "@/lib/auth/current";
import { listInvites, resolveBaseUrl } from "@/lib/queries/admin";
import { isEmailConfigured } from "@/lib/email";
import { InvitesTable } from "@/components/admin/invites-table";
import { Hint } from "@/components/admin/bits";
import { Empty } from "@/components/ui/empty";

export default async function AdminInvitesPage() {
  await requireAdmin();
  const invites = listInvites();
  const baseUrl = await resolveBaseUrl();
  const emailOn = isEmailConfigured();
  return (
    <div className="overflow-auto px-4 pt-4 pb-8 sm:px-6 sm:pt-5">
      <div className="mb-4"><Hint>Invite links last seven days. {emailOn ? "New invites are emailed; you can still copy the link to resend it." : "Nothing is emailed until SMTP is set up in Settings; copy the link and send it yourself."}</Hint></div>
      {invites.length === 0 ? (
        <Empty icon="mail" title="No invites yet" hint="Use “Invite someone” above or the form on the People tab." />
      ) : (
        <InvitesTable invites={invites} baseUrl={baseUrl} />
      )}
    </div>
  );
}
