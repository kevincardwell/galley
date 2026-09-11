import Link from "next/link";
import type { User } from "@/db/schema";
import { listWorkspacesFor } from "@/lib/queries/workspaces";
import { Avatar } from "@/components/ui/avatar";
import { logoutAction } from "@/actions/auth";
import { ThemeToggle } from "./theme-toggle";
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
      <Link href="/" className="flex items-center gap-2 px-2 py-1 font-semibold tracking-tight">
        <span className="relative inline-block size-[18px] rounded bg-ink after:absolute after:inset-[5px] after:border-b-2 after:border-l-2 after:border-surface" />
        Galley
      </Link>
      <SidebarNav workspaces={workspaces} isAdmin={user.isAdmin} />
      <div className="mt-auto flex items-center gap-2 px-2 pt-1.5 pb-8 text-ink-2">
        <Avatar name={user.name} />
        <span className="min-w-0 flex-1 leading-tight">
          <Link href="/me/account" className="block truncate text-ink hover:underline" title="Account settings">{user.name}</Link>
          <span className="block text-xs text-ink-3">{user.isAdmin ? "Admin" : "Member"}</span>
        </span>
        <ThemeToggle />
        <form action={logoutAction}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="grid size-6 place-items-center rounded text-ink-3 hover:bg-surface hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6" />
              <path d="M10.5 11 13.5 8l-3-3" />
              <path d="M13.5 8H6.5" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
