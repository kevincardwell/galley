"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";

export function ShareNav({ token, pages }: { token: string; pages: { slug: string; title: string }[] }) {
  const path = usePathname();
  const base = `/share/${token}`;
  const items = [...pages.map((p) => ({ href: `${base}/${p.slug}`, label: p.title })), { href: `${base}/files`, label: "Files" }];
  return (
    <nav className="-mb-px flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Pages">
      {items.map((t) => {
        const on = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={clsx(
              "shrink-0 cursor-pointer rounded-t border-b-2 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150",
              on ? "border-accent text-ink" : "border-transparent text-ink-2 hover:border-line hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
