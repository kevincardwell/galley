"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";

export function ShareNav({ token, pages }: { token: string; pages: { slug: string; title: string }[] }) {
  const path = usePathname();
  const base = `/share/${token}`;
  const items = [...pages.map((p) => ({ href: `${base}/${p.slug}`, label: p.title })), { href: `${base}/files`, label: "Files" }];
  return (
    <nav className="-mb-px mt-4 flex gap-0.5 overflow-x-auto" aria-label="Pages">
      {items.map((t) => {
        const on = path === t.href;
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={clsx("whitespace-nowrap rounded-t border-b-2 px-3 py-2 font-medium transition-colors", on ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
