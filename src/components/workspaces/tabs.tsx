"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { Icon, type IconName } from "@/components/ui/icon";

type Tab = { href: string; label: string; icon: IconName; exact?: boolean; n?: string };

export function WorkspaceTabs({ slug, counts, canManage }: { slug: string; counts: { open: number; approved: number; sections: number; assets: number }; canManage: boolean }) {
  const path = usePathname();
  const base = `/w/${slug}`;
  const tabs: Tab[] = [
    { href: base, label: "Overview", icon: "activity", exact: true },
    { href: `${base}/tasks`, label: "Tasks", icon: "checklist", n: `${counts.open} open` },
    { href: `${base}/copy`, label: "Copy", icon: "text", n: `${counts.approved} of ${counts.sections} approved` },
    { href: `${base}/assets`, label: "Assets", icon: "image", n: String(counts.assets) },
    { href: `${base}/calendar`, label: "Calendar", icon: "calendar" },
    { href: `${base}/suppliers`, label: "Suppliers", icon: "supplier" },
    ...(canManage ? [{ href: `${base}/settings`, label: "Settings", icon: "settings" as IconName }] : []),
  ];
  return (
    <nav className="mt-2.5 flex max-w-full min-w-0 gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
      {tabs.map((t) => {
        const on = t.exact ? path === t.href : path === t.href || path.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={on}
            className={clsx(
              "-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 rounded-t border-b-2 px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 ease-out",
              on ? "border-accent text-ink" : "border-transparent text-ink-2 hover:border-line hover:text-ink",
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
