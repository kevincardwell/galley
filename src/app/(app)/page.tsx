import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { listWorkspacesFor } from "@/lib/queries/workspaces";
import { Empty } from "@/components/ui/empty";
import { Screen, PageHeader } from "@/components/ui/page";
import { NewWorkspaceButton } from "@/components/workspaces/new-workspace";
import { WorkspaceCard } from "@/components/workspaces/workspace-card";
import { WorkspaceFilters, workspacesHref } from "@/components/workspaces/workspace-filters";

const STATUSES = ["planning", "building", "review", "live"];

type Search = { q?: string; status?: string; archived?: string };

export default async function HomePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const archived = sp.archived === "1";
  const q = (sp.q ?? "").trim();
  const status = STATUSES.includes(sp.status ?? "") ? sp.status! : "";

  const all = listWorkspacesFor(user, archived);
  const needle = q.toLowerCase();
  const rows = all.filter(({ ws }) => {
    if (status && ws.status !== status) return false;
    if (!needle) return true;
    return `${ws.name} ${ws.clientName ?? ""} ${ws.url ?? ""}`.toLowerCase().includes(needle);
  });
  const filtering = Boolean(q || status || archived);
  // Any project you can see is a shape worth reusing, archived ones included.
  const templates = (archived ? all : listWorkspacesFor(user, true)).map(({ ws }) => ({ id: ws.id, name: ws.name }));

  return (
    <Screen>
      <PageHeader title="Workspaces" count={rows.length} action={<NewWorkspaceButton templates={templates} />} />
      {all.length > 0 && <WorkspaceFilters q={q} status={status} archived={archived} />}

      {all.length === 0 ? (
        <Empty
          icon="sparkles"
          title="No workspaces yet"
          hint={user.isAdmin ? "Create one for each website you are working on." : "Ask an admin to add you to a workspace."}
          action={<NewWorkspaceButton templates={templates} />}
        />
      ) : rows.length === 0 ? (
        <Empty
          icon="search"
          title="Nothing matches those filters"
          hint="Try a different name, or widen the status filter."
          action={
            filtering ? (
              <Link
                href={workspacesHref({})}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-r border border-line bg-surface px-3 py-1.5 font-medium transition-colors duration-150 ease-out hover:bg-surface-2"
              >
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(272px,1fr))] gap-3 p-0">
          {rows.map(({ ws, openTasks, approvedSections, totalSections, assetCount, lastActivity }) => (
            <li key={ws.id}>
              <WorkspaceCard
                ws={{
                  id: ws.id,
                  slug: ws.slug,
                  name: ws.name,
                  accent: ws.accent,
                  status: ws.archivedAt ? "archived" : ws.status,
                  clientName: ws.clientName,
                  url: ws.url,
                  faviconPath: ws.faviconPath,
                  openTasks,
                  approvedSections,
                  totalSections,
                  assetCount,
                  lastActivity,
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
