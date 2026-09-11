import { requireAdmin } from "@/lib/auth/current";
import { instanceStats, listWorkspaceOptions } from "@/lib/queries/admin";
import { formatBytes } from "@/lib/format";
import { AdminTabs } from "@/components/admin/tabs";
import { AdminHeaderActions } from "@/components/admin/header-actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const stats = await instanceStats();
  const workspaces = listWorkspaceOptions();
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line bg-surface px-6 pt-4">
        <div className="flex flex-wrap items-start gap-3.5">
          <div className="min-w-0">
            <h1 className="m-0 text-xl font-semibold tracking-tight">Admin</h1>
            <div className="mt-0.5 flex flex-wrap gap-3.5 text-ink-2">
              <span>{stats.instanceName}</span>
              <span className="tnum">{stats.people} {stats.people === 1 ? "person" : "people"}</span>
              <span className="tnum">{stats.workspaces} {stats.workspaces === 1 ? "workspace" : "workspaces"}</span>
              <span className="tnum">{formatBytes(stats.bytes)} used</span>
            </div>
          </div>
          <div className="ml-auto"><AdminHeaderActions workspaces={workspaces} /></div>
        </div>
        <AdminTabs pendingInvites={stats.pendingInvites} />
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
