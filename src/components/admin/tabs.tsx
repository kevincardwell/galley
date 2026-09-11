"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";

export function AdminTabs({ pendingInvites }: { pendingInvites: number }) {
  const path = usePathname();
  const tabs = [
    { href: "/admin", label: "People", exact: true },
    { href: "/admin/workspaces", label: "Workspaces" },
    { href: "/admin/invites", label: "Invites", n: pendingInvites > 0 ? `${pendingInvites} pending` : undefined },
    { href: "/admin/storage", label: "Storage" },
    { href: "/admin/settings", label: "Settings" },
    { href: "/admin/audit", label: "Audit log" },
  ];
  return (
    <nav className="mt-4 flex gap-0.5" role="tablist">
      {tabs.map((t) => {
        const on = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={on}
            className={clsx("-mb-px flex items-center gap-1.5 whitespace-nowrap rounded-t border-b-2 px-3 py-2 font-medium", on ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink")}
          >
            {t.label}
            {t.n && <span className="tnum text-xs text-ink-3">{t.n}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
