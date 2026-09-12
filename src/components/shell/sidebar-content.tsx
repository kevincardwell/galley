import Link from "next/link";
import type { User } from "@/db/schema";
import { listWorkspacesFor } from "@/lib/queries/workspaces";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon";
import { logoutAction } from "@/actions/auth";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "@/components/notifications/bell";
import { unreadCountFor } from "@/lib/queries/notifications";
import { SidebarNav } from "./sidebar-nav";

/**
 * The navigation shared by the desktop sidebar and the mobile drawer.
 * Server component: it reads the user's workspaces itself and renders the
 * brand, nav sections and the user block. The wrapper decides where it lives.
 */
export function SidebarContent({ user }: { user: User }) {
  const workspaces = listWorkspacesFor(user).map((w) => ({ id: w.ws.id, slug: w.ws.slug, name: w.ws.name, accent: w.ws.accent, open: w.openTasks }));
  return (
    <>
      <Link
        href="/"
        className="flex cursor-pointer items-center gap-2 rounded-r px-2 py-1 font-semibold tracking-tight transition-colors duration-150 ease-out hover:text-ink"
      >
        <span className="relative inline-block size-[18px] rounded bg-ink after:absolute after:inset-[5px] after:border-b-2 after:border-l-2 after:border-surface" />
        Galley
      </Link>

      <SidebarNav workspaces={workspaces} isAdmin={user.isAdmin} />

      <div className="mt-auto flex flex-col gap-1 px-1 pt-2 pb-14">
        <div className="flex items-center gap-1.5">
          <Link
            href="/me/account"
            title="Account settings"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-r px-1 py-1 transition-colors duration-150 ease-out hover:bg-surface"
          >
            <Avatar name={user.name} size={26} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium text-ink">{user.name}</span>
              <span className="block truncate text-xs text-ink-3">{user.isAdmin ? "Admin" : "Member"}</span>
            </span>
          </Link>
          <NotificationBell unread={unreadCountFor(user.id)} />
        </div>
        <div className="flex items-center gap-0.5 border-t border-line-2 px-1 pt-1.5">
          <ThemeToggle />
          <form action={logoutAction}>
            <IconButton type="submit" name="logout" label="Sign out" className="hover:bg-surface" />
          </form>
        </div>
      </div>
    </>
  );
}
