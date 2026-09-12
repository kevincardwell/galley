import { clsx } from "@/lib/clsx";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

export const ROLE_LABEL: Record<string, string> = { manager: "Manager", editor: "Editor", viewer: "Viewer" };
export const STATUS_LABEL: Record<string, string> = { planning: "Planning", building: "Building", review: "In review", live: "Live", archived: "Archived" };

export function WsDot({ accent, className }: { accent: string; className?: string }) {
  return <span aria-hidden className={clsx("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: accent }} />;
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left text-[13px]">{children}</table>
    </div>
  );
}

/** Table row: hover tint, and a `group` so its actions can appear on hover. */
export function Tr({ children, className, muted }: { children: ReactNode; className?: string; muted?: boolean }) {
  return <tr className={clsx("group transition-colors duration-150 hover:bg-surface-2", muted && "text-ink-3", className)}>{children}</tr>;
}

export function Th({ children, className, num }: { children?: ReactNode; className?: string; num?: boolean }) {
  return <th className={clsx("border-b border-line px-2 py-1.5 text-xs font-medium text-ink-3", num && "text-right", className)}>{children}</th>;
}

export function Td({ children, className, colSpan, num }: { children?: ReactNode; className?: string; colSpan?: number; num?: boolean }) {
  return <td colSpan={colSpan} className={clsx("tnum border-b border-line-2 px-2 py-2.5 align-middle", num && "text-right whitespace-nowrap", className)}>{children}</td>;
}

/** Row actions: quiet until the row is hovered or something inside it takes focus. */
export function RowActions({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center justify-end gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 max-sm:opacity-100">
      {children}
    </span>
  );
}

export function InlineError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="m-0 mt-2 flex items-start gap-1.5 text-sm text-late">
      <Icon name="alert" size={15} className="mt-0.5" />
      <span>{children}</span>
    </p>
  );
}

export function Hint({ children, small }: { children: ReactNode; small?: boolean }) {
  return <p className={clsx("m-0 max-w-[68ch]", small ? "text-xs text-ink-3" : "text-ink-2")}>{children}</p>;
}
