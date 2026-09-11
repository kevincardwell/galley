"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";

export function WorkspaceTabs({ slug, counts, canManage }: { slug: string; counts: { open: number; approved: number; sections: number; assets: number }; canManage: boolean }) {
  const path = usePathname();
  const base = `/w/${slug}`;
  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/tasks`, label: "Tasks", n: `${counts.open} open` },
    { href: `${base}/copy`, label: "Copy", n: `${counts.approved} of ${counts.sections} approved` },
    { href: `${base}/assets`, label: "Assets", n: String(counts.assets) },
    ...(canManage ? [{ href: `${base}/settings`, label: "Settings" }] : []),
  ];
  return (
    <nav className="mt-4 flex min-w-0 max-w-full gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
      {tabs.map((t) => {
        const on = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={on}
            className={clsx("-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t border-b-2 px-3 py-2 font-medium", on ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink")}
          >
            {t.label}
            {t.n && <span className="tnum text-xs text-ink-3 max-sm:hidden">{t.n}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
