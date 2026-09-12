import { requireAdmin } from "@/lib/auth/current";
import { listInvites, listPeople, listWorkspaceOptions, resolveBaseUrl } from "@/lib/queries/admin";
import { PeopleTable } from "@/components/admin/people-table";
import { InviteForm } from "@/components/admin/invite-form";
import { Hint } from "@/components/admin/bits";
import { Icon } from "@/components/ui/icon";

export default async function AdminPeoplePage() {
  const user = await requireAdmin();
  const people = listPeople();
  const invites = listInvites(true);
  const workspaces = listWorkspaceOptions();
  const baseUrl = await resolveBaseUrl();
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 overflow-auto px-4 pt-4 pb-8 sm:px-6 sm:pt-5">
        <div className="mb-4"><Hint>People can only sign in once they have been created or invited here. They see only the workspaces they are added to.</Hint></div>
        <PeopleTable people={people} invites={invites} workspaces={workspaces} selfId={user.id} baseUrl={baseUrl} />
      </div>
      <aside className="border-t border-line bg-surface-2 px-4 py-5 sm:px-5 lg:border-t-0 lg:border-l">
        <h2 className="m-0 mb-3 flex items-center gap-2 text-sm font-semibold">
          <Icon name="user" size={15} className="text-ink-3" />
          Add a person
        </h2>
        <InviteForm workspaces={workspaces} idPrefix="inv" />
      </aside>
    </div>
  );
}
