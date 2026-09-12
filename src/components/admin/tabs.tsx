"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { Icon, type IconName } from "@/components/ui/icon";

type Tab = { href: string; label: string; icon: IconName; exact?: boolean; n?: string };

export function AdminTabs({ pendingInvites }: { pendingInvites: number }) {
  const path = usePathname();
  const tabs: Tab[] = [
    { href: "/admin", label: "People", icon: "users", exact: true },
    { href: "/admin/workspaces", label: "Workspaces", icon: "folder" },
    { href: "/admin/invites", label: "Invites", icon: "mail", n: pendingInvites > 0 ? `${pendingInvites} pending` : undefined },
    { href: "/admin/storage", label: "Storage", icon: "storage" },
    { href: "/admin/backups", label: "Backups", icon: "database" },
    { href: "/admin/settings", label: "Settings", icon: "settings" },
    { href: "/admin/audit", label: "Audit log", icon: "activity" },
  ];
  return (
    <nav className="mt-4 flex max-w-full min-w-0 gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
      {tabs.map((t) => {
        const on = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={on}
            className={clsx(
              "-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 rounded-t border-b-2 px-3 py-2 font-medium whitespace-nowrap transition-colors duration-150",
              on ? "border-accent text-ink" : "border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon name={t.icon} size={15} className={on ? "text-accent" : "text-ink-3"} />
            {t.label}
            {t.n && <span className="tnum text-xs text-ink-3 max-sm:hidden">{t.n}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
