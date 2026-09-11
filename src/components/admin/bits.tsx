import { clsx } from "@/lib/clsx";
import type { ReactNode } from "react";

export const ROLE_LABEL: Record<string, string> = { manager: "Manager", editor: "Editor", viewer: "Viewer" };
export const STATUS_LABEL: Record<string, string> = { planning: "Planning", building: "Building", review: "In review", live: "Live", archived: "Archived" };

export function WsDot({ accent, className }: { accent: string; className?: string }) {
  return <span aria-hidden className={clsx("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: accent }} />;
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={clsx("border-b border-line px-2 py-1.5 text-xs font-medium text-ink-3", className)}>{children}</th>;
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={clsx("tnum border-b border-line-2 px-2 py-2.5 align-middle", className)}>{children}</td>;
}

export function InlineError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="m-0 text-sm text-late">{children}</p>;
}

export function Hint({ children, small }: { children: ReactNode; small?: boolean }) {
  return <p className={clsx("m-0 max-w-[60ch]", small ? "text-xs text-ink-3" : "text-ink-2")}>{children}</p>;
}
