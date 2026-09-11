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
    <nav className="mt-4 flex gap-0.5" role="tablist">
      {tabs.map((t) => {
        const on = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={on}
            className={clsx("-mb-px flex items-center gap-1.5 rounded-t border-b-2 px-3 py-2 font-medium", on ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink")}
          >
            {t.label}
            {t.n && <span className="tnum text-xs text-ink-3">{t.n}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
