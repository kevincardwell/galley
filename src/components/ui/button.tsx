import { clsx } from "@/lib/clsx";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "default" | "ghost" | "danger"; size?: "sm" | "md" };

export function Button({ variant = "default", size = "md", className, ...rest }: Props) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-r font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" ? "px-2.5 py-1 text-[13px]" : "px-3 py-1.5",
        variant === "primary" && "bg-accent text-accent-ink border border-accent hover:brightness-95",
        variant === "default" && "bg-surface border border-line hover:bg-surface-2",
        variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
        variant === "danger" && "bg-surface border border-line text-late hover:bg-late-soft",
        className,
      )}
      {...rest}
    />
  );
}
