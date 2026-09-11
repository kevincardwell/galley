import { requireAdmin } from "@/lib/auth/current";
import { listInvites, listPeople, listWorkspaceOptions, resolveBaseUrl } from "@/lib/queries/admin";
import { PeopleTable } from "@/components/admin/people-table";
import { InviteForm } from "@/components/admin/invite-form";
import { Hint } from "@/components/admin/bits";

export default async function AdminPeoplePage() {
  const user = await requireAdmin();
  const people = listPeople();
  const invites = listInvites(true);
  const workspaces = listWorkspaceOptions();
  const baseUrl = await resolveBaseUrl();
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0 overflow-auto px-6 pb-8 pt-5">
        <div className="mb-3.5"><Hint>People can only sign in once they have been created or invited here. They see only the workspaces they are added to.</Hint></div>
        <PeopleTable people={people} invites={invites} workspaces={workspaces} selfId={user.id} baseUrl={baseUrl} />
      </div>
      <aside className="border-t border-line bg-surface-2 px-5 py-5 lg:border-l lg:border-t-0">
        <h3 className="m-0 mb-3 text-sm font-semibold">Add a person</h3>
        <InviteForm workspaces={workspaces} idPrefix="inv" />
      </aside>
    </div>
  );
}
