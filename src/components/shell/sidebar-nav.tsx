"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { useCommandPalette } from "./command-palette";

type Ws = { id: string; slug: string; name: string; accent: string; open: number };

export function SidebarNav({ workspaces, isAdmin }: { workspaces: Ws[]; isAdmin: boolean }) {
  const path = usePathname();
  const open = useCommandPalette((s) => s.open);
  const item = "flex items-center gap-2 rounded-r px-2 py-1.5 text-ink-2 hover:text-ink";
  const on = "bg-surface text-ink shadow-[0_0_0_1px_var(--line)] font-medium";
  return (
    <>
      <button onClick={open} className="flex items-center justify-between rounded-r border border-line bg-surface px-2.5 py-1.5 text-ink-3">
        <span>Jump to…</span><kbd>⌘K</kbd>
      </button>
      <nav>
        <h2 className="m-0 mb-1.5 px-2 text-xs font-medium text-ink-3">Workspaces</h2>
        <ul className="m-0 flex list-none flex-col gap-px p-0">
          {workspaces.map((w) => (
            <li key={w.id}>
              <Link href={`/w/${w.slug}`} className={clsx(item, path.startsWith(`/w/${w.slug}`) && on)}>
                <span className="size-2 shrink-0 rounded-full" style={{ background: w.accent }} />
                <span className="truncate">{w.name}</span>
                {w.open > 0 && <span className="tnum ml-auto text-xs text-ink-3">{w.open}</span>}
              </Link>
            </li>
          ))}
          {workspaces.length === 0 && <li className="px-2 py-1 text-xs text-ink-3">No workspaces yet</li>}
        </ul>
      </nav>
      <nav>
        <h2 className="m-0 mb-1.5 px-2 text-xs font-medium text-ink-3">You</h2>
        <ul className="m-0 flex list-none flex-col gap-px p-0">
          <li><Link href="/me/tasks" className={clsx(item, path === "/me/tasks" && on)}>My tasks</Link></li>
          <li><Link href="/" className={clsx(item, path === "/" && on)}>All workspaces</Link></li>
        </ul>
      </nav>
      {isAdmin && (
        <nav>
          <h2 className="m-0 mb-1.5 px-2 text-xs font-medium text-ink-3">Instance</h2>
          <ul className="m-0 flex list-none flex-col gap-px p-0">
            <li><Link href="/admin" className={clsx(item, path.startsWith("/admin") && on)}>Admin</Link></li>
          </ul>
        </nav>
      )}
    </>
  );
}
