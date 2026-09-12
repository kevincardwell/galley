"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { Icon } from "@/components/ui/icon";

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
        "relative grid size-7 shrink-0 cursor-pointer place-items-center rounded-r transition-colors duration-150 ease-out",
        on ? "bg-surface text-ink" : "text-ink-3 hover:bg-surface hover:text-ink",
        className,
      )}
    >
      <Icon name="bell" size={15} />
      {unread > 0 && (
        <span className="tnum absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 font-semibold text-accent-ink" aria-hidden="true">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
