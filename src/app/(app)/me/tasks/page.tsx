import { requireUser } from "@/lib/auth/current";
import { listMyTasks } from "@/lib/queries/tasks";
import { Empty } from "@/components/ui/empty";
import { MyTasksList } from "@/components/tasks/my-tasks-list";

export default async function MyTasksPage() {
  const user = await requireUser();
  const groups = listMyTasks(user);
  const open = groups.reduce((n, g) => n + g.tasks.filter((t) => t.status !== "done").length, 0);
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <header className="mb-5 flex items-baseline gap-3">
        <h1 className="m-0 text-xl font-semibold tracking-tight">My tasks</h1>
        {groups.length > 0 && <span className="tnum text-ink-3">{open} open across {groups.length} {groups.length === 1 ? "workspace" : "workspaces"}</span>}
      </header>
      {groups.length === 0 ? (
        <Empty title="Nothing assigned to you." hint="Tasks someone assigns to you in any workspace show up here, soonest due first." />
      ) : (
        <MyTasksList initialGroups={groups} />
      )}
    </div>
  );
}
