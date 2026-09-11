import Link from "next/link";
import type { User } from "@/db/schema";
import { listWorkspacesFor } from "@/lib/queries/workspaces";
import { Avatar } from "@/components/ui/avatar";
import { logoutAction } from "@/actions/auth";
import { ThemeToggle } from "./theme-toggle";
import { SidebarNav } from "./sidebar-nav";

export function Sidebar({ user }: { user: User }) {
  const workspaces = listWorkspacesFor(user).map((w) => ({ id: w.ws.id, slug: w.ws.slug, name: w.ws.name, accent: w.ws.accent, open: w.openTasks }));
  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col gap-5 border-r border-line bg-surface-2 px-2.5 py-3.5 max-md:hidden">
      <Link href="/" className="flex items-center gap-2 px-2 py-1 font-semibold tracking-tight">
        <span className="relative inline-block size-[18px] rounded bg-ink after:absolute after:inset-[5px] after:border-b-2 after:border-l-2 after:border-surface" />
        Galley
      </Link>
      <SidebarNav workspaces={workspaces} isAdmin={user.isAdmin} />
      <div className="mt-auto flex items-center gap-2 px-2 py-1.5 text-ink-2">
        <Avatar name={user.name} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-ink">{user.name}</span>
          <span className="block text-xs text-ink-3">{user.isAdmin ? "Admin" : "Member"}</span>
        </span>
        <ThemeToggle />
        <form action={logoutAction}>
          <button className="rounded px-1.5 py-1 text-xs text-ink-3 hover:bg-surface hover:text-ink" title="Sign out">Out</button>
        </form>
      </div>
    </aside>
  );
}
