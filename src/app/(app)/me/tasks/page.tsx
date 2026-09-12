import { requireUser } from "@/lib/auth/current";
import { listMyTasks } from "@/lib/queries/tasks";
import { Empty } from "@/components/ui/empty";
import { PageHeader, Screen } from "@/components/ui/page";
import { MyTasksList } from "@/components/tasks/my-tasks-list";

export const metadata = { title: "My tasks" };

export default async function MyTasksPage() {
  const user = await requireUser();
  const groups = listMyTasks(user);
  const open = groups.reduce((n, g) => n + g.tasks.filter((t) => t.status !== "done").length, 0);
  return (
    <Screen width="narrow">
      <PageHeader
        eyebrow="You"
        title="My tasks"
        count={groups.length > 0 ? `${open} open across ${groups.length} ${groups.length === 1 ? "workspace" : "workspaces"}` : undefined}
        description="Everything assigned to you, soonest due first."
      />
      {groups.length === 0 ? (
        <Empty
          icon="checklist"
          title="Nothing assigned to you"
          hint="Tasks someone assigns to you in any workspace show up here, soonest due first."
        />
      ) : (
        <MyTasksList initialGroups={groups} />
      )}
    </Screen>
  );
}
