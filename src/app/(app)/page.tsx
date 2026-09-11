import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { listWorkspacesFor } from "@/lib/queries/workspaces";
import { Pill } from "@/components/ui/pill";
import { Empty } from "@/components/ui/empty";
import { timeAgo } from "@/lib/format";
import { NewWorkspaceButton } from "@/components/workspaces/new-workspace";

const STATUS_LABEL: Record<string, string> = { planning: "Planning", building: "Building", review: "In review", live: "Live", archived: "Archived" };

export default async function HomePage() {
  const user = await requireUser();
  const rows = listWorkspacesFor(user);
  return (
    <div className="px-6 py-5">
      <div className="mb-5 flex items-center gap-3">
        <h1 className="m-0 text-xl font-semibold tracking-tight">Workspaces</h1>
        <span className="tnum text-ink-3">{rows.length}</span>
        <div className="ml-auto"><NewWorkspaceButton /></div>
      </div>
      {rows.length === 0 ? (
        <Empty
          title="No workspaces yet"
          hint={user.isAdmin ? "Create one for each website you are working on." : "Ask an admin to add you to a workspace."}
          action={<NewWorkspaceButton />}
        />
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 p-0">
          {rows.map(({ ws, openTasks, approvedSections, totalSections, assetCount, lastActivity }) => (
            <li key={ws.id}>
              <Link href={`/w/${ws.slug}`} className="block rounded-[10px] border border-line bg-surface p-4 transition-colors hover:border-ink-3" style={{ ["--accent" as string]: ws.accent }}>
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent font-serif text-base font-semibold text-accent-ink">
                    {ws.faviconPath ? <img src={`/api/favicon/${ws.id}`} alt="" className="size-5" /> : ws.name[0]}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{ws.name}</span>
                    <span className="block truncate text-xs text-ink-2">{ws.clientName || ws.url?.replace(/^https?:\/\//, "") || "—"}</span>
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-ink-2">
                  <Pill tone="accent">{STATUS_LABEL[ws.status]}</Pill>
                  <span className="tnum">{openTasks} open</span>
                  <span className="tnum">{approvedSections}/{totalSections} approved</span>
                  <span className="tnum">{assetCount} files</span>
                </div>
                <div className="mt-2 text-xs text-ink-3">{lastActivity ? `Active ${timeAgo(lastActivity)}` : "No activity yet"}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
