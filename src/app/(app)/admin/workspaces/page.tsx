import { requireAdmin } from "@/lib/auth/current";
import { listAdminWorkspaces, listPersonOptions } from "@/lib/queries/admin";
import { WorkspacesTable } from "@/components/admin/workspaces-table";
import { Hint } from "@/components/admin/bits";
import { Empty } from "@/components/ui/empty";

export default async function AdminWorkspacesPage() {
  const user = await requireAdmin();
  const workspaces = await listAdminWorkspaces();
  const people = listPersonOptions();
  return (
    <div className="overflow-auto px-6 pb-8 pt-5">
      <div className="mb-3.5"><Hint>Every workspace on this instance, including archived ones. Add or remove members and set their role from Manage.</Hint></div>
      {workspaces.length === 0 ? (
        <Empty title="No workspaces yet" hint="Create one from the Workspaces home page." />
      ) : (
        <WorkspacesTable workspaces={workspaces} people={people} selfId={user.id} />
      )}
    </div>
  );
}
