"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { Icon, type IconName } from "@/components/ui/icon";
import { useCommandPalette } from "./command-palette";

type Ws = { id: string; slug: string; name: string; accent: string; open: number };
type NavItem = { href: string; label: string; icon: IconName; exact?: boolean };

const YOU: NavItem[] = [
  { href: "/", label: "All workspaces", icon: "home", exact: true },
  { href: "/me/tasks", label: "My tasks", icon: "checklist" },
  { href: "/me/notifications", label: "Notifications", icon: "inbox" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/suppliers", label: "Suppliers", icon: "supplier" },
];

const ROW =
  "group flex cursor-pointer items-center gap-2 rounded-r px-2 py-1.5 text-[13px] text-ink-2 transition-colors duration-150 ease-out hover:bg-surface hover:text-ink max-md:py-2.5";
const ROW_ON = "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--line)]";

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="m-0 mb-1 px-2 text-xs font-medium text-ink-3">{children}</h2>;
}

export function SidebarNav({ workspaces, isAdmin }: { workspaces: Ws[]; isAdmin: boolean }) {
  const path = usePathname();
  const openPalette = useCommandPalette((s) => s.open);
  const isOn = (item: NavItem) => (item.exact ? path === item.href : path === item.href || path.startsWith(`${item.href}/`));

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        aria-keyshortcuts="Meta+K Control+K"
        className="flex w-full cursor-pointer items-center gap-2 rounded-r border border-line bg-surface px-2.5 py-1.5 text-ink-3 transition-colors duration-150 ease-out hover:border-ink-3 hover:text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent max-md:py-2.5"
      >
        <Icon name="search" size={15} />
        <span className="flex-1 text-left text-[13px]">Search</span>
        <kbd className="tnum shrink-0">⌘K</kbd>
      </button>

      <nav aria-label="Workspaces">
        <Heading>Workspaces</Heading>
        <ul className="m-0 flex list-none flex-col gap-px p-0">
          {workspaces.map((w) => {
            const on = path === `/w/${w.slug}` || path.startsWith(`/w/${w.slug}/`);
            return (
              <li key={w.id}>
                <Link href={`/w/${w.slug}`} aria-current={on ? "page" : undefined} className={clsx(ROW, on && ROW_ON)}>
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: w.accent }} />
                  <span className="min-w-0 flex-1 truncate">{w.name}</span>
                  {w.open > 0 && (
                    <span className="tnum shrink-0 text-right text-xs text-ink-3" title={`${w.open} open tasks`}>
                      {w.open}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
          {workspaces.length === 0 && <li className="px-2 py-1 text-xs text-ink-3">No workspaces yet</li>}
        </ul>
      </nav>

      <nav aria-label="You">
        <Heading>You</Heading>
        <ul className="m-0 flex list-none flex-col gap-px p-0">
          {YOU.map((item) => {
            const on = isOn(item);
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={on ? "page" : undefined} className={clsx(ROW, on && ROW_ON)}>
                  <Icon name={item.icon} size={15} className={on ? "text-accent" : "text-ink-3 group-hover:text-ink-2"} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {isAdmin && (
        <nav aria-label="Instance">
          <Heading>Instance</Heading>
          <ul className="m-0 flex list-none flex-col gap-px p-0">
            <li>
              <Link href="/admin" aria-current={path.startsWith("/admin") ? "page" : undefined} className={clsx(ROW, path.startsWith("/admin") && ROW_ON)}>
                <Icon name="shield" size={15} className={path.startsWith("/admin") ? "text-accent" : "text-ink-3 group-hover:text-ink-2"} />
                <span className="min-w-0 flex-1 truncate">Admin</span>
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </>
  );
}
