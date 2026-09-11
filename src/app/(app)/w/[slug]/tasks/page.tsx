import { requireUser } from "@/lib/auth/current";
import { can, requireAccess } from "@/lib/permissions";
import { listMembers } from "@/lib/queries/workspaces";
import { loadSections } from "@/lib/queries/tasks";
import { TaskBoard } from "@/components/tasks/task-board";
import type { TaskView } from "@/components/tasks/types";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TasksPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const access = requireAccess(user, slug);
  const ws = access.workspace;
  const viewParam = one(sp.view);
  const initialView: TaskView | null = viewParam === "board" || viewParam === "list" ? viewParam : null;
  const openTaskId = one(sp.task) ?? null;
  const sections = loadSections(ws.id);
  const members = listMembers(ws.id).map((m) => ({ id: m.user.id, name: m.user.name }));
  const openExists = openTaskId ? sections.some((s) => s.tasks.some((t) => t.id === openTaskId)) : false;

  return (
    <TaskBoard
      workspaceId={ws.id}
      slug={ws.slug}
      initialSections={sections}
      members={members}
      currentUserId={user.id}
      canEdit={can(access, "edit")}
      initialView={initialView}
      openTaskId={openExists ? openTaskId : null}
    />
  );
}
