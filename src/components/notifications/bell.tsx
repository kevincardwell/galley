"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";

/**
 * Sidebar link to the inbox with an unread badge. Server-rendered count comes in as a prop;
 * mount it inside the shell wherever the nav lives.
 */
export function NotificationBell({ unread, className }: { unread: number; className?: string }) {
  const on = usePathname().startsWith("/me/notifications");
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <Link
      href="/me/notifications"
      aria-label={label}
      title={label}
      aria-current={on ? "page" : undefined}
      className={clsx(
        "relative grid size-6 shrink-0 place-items-center rounded transition-colors duration-150 ease-out",
        on ? "bg-surface text-ink" : "text-ink-3 hover:bg-surface hover:text-ink",
        className,
      )}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 11V7a4 4 0 1 1 8 0v4l1.2 1.5H2.8L4 11Z" />
        <path d="M6.5 14a1.5 1.5 0 0 0 3 0" />
      </svg>
      {unread > 0 && (
        <span className="tnum absolute -right-1 -top-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-accent-ink" aria-hidden="true">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
