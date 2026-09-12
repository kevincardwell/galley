import { requireUser } from "@/lib/auth/current";
import { requireAccess } from "@/lib/permissions";
import { listMembers } from "@/lib/queries/workspaces";
import { db, schema } from "@/db/client";
import { PageHeader, Screen, Section } from "@/components/ui/page";
import { SettingsForm } from "@/components/workspaces/settings-form";
import { MembersPanel } from "@/components/workspaces/members-panel";
import { DangerZone } from "@/components/workspaces/danger-zone";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const { workspace: ws } = requireAccess(user, slug, "manage");
  const members = listMembers(ws.id);
  const everyone = user.isAdmin ? db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email }).from(schema.users).all() : [];
  return (
    <Screen width="narrow">
      <PageHeader eyebrow={ws.name} title="Settings" description="How this website is named, coloured and who can work on it." />
      <div className="flex flex-col gap-8">
        <Section title="Workspace">
          <SettingsForm workspace={{ id: ws.id, name: ws.name, url: ws.url, clientName: ws.clientName, accent: ws.accent, status: ws.status }} />
        </Section>
        <Section title="People" className="border-t border-line pt-6">
          <MembersPanel
            workspaceId={ws.id}
            members={members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email, role: m.role }))}
            candidates={everyone.filter((u) => !members.some((m) => m.user.id === u.id))}
            isAdmin={user.isAdmin}
            selfId={user.id}
          />
        </Section>
        <div className="border-t border-line pt-6">
          <DangerZone workspaceId={ws.id} name={ws.name} archived={!!ws.archivedAt} />
        </div>
      </div>
    </Screen>
  );
}
