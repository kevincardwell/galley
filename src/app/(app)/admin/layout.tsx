import { requireAdmin } from "@/lib/auth/current";
import { instanceStats, listWorkspaceOptions } from "@/lib/queries/admin";
import { formatBytes } from "@/lib/format";
import { Stat } from "@/components/ui/stat";
import { AdminTabs } from "@/components/admin/tabs";
import { AdminHeaderActions } from "@/components/admin/header-actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const stats = await instanceStats();
  const workspaces = listWorkspaceOptions();
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line bg-surface px-4 pt-4 sm:px-6">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="m-0 mb-0.5 text-xs font-medium text-ink-3">{stats.instanceName}</p>
            <h1 className="m-0 text-[22px] leading-tight font-semibold tracking-tight">Admin</h1>
          </div>
          <div className="flex flex-wrap items-start gap-x-7 gap-y-3">
            <Stat icon="users" label="People" value={stats.people} />
            <Stat icon="folder" label="Workspaces" value={stats.workspaces} />
            <Stat icon="storage" label="Storage used" value={formatBytes(stats.bytes)} />
          </div>
          <div className="ml-auto"><AdminHeaderActions workspaces={workspaces} /></div>
        </div>
        <AdminTabs pendingInvites={stats.pendingInvites} />
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
