import { clsx } from "@/lib/clsx";
import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./icon";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "default" | "ghost" | "danger" | "quiet";
  size?: "sm" | "md";
  icon?: IconName;
  iconAfter?: IconName;
  loading?: boolean;
};

export function Button({ variant = "default", size = "md", icon, iconAfter, loading, className, children, disabled, ...rest }: Props) {
  return (
    <button
      className={clsx(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-r font-medium whitespace-nowrap transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1 text-[13px]" : "px-3 py-1.5",
        variant === "primary" && "border border-accent bg-accent text-accent-ink hover:brightness-95",
        variant === "default" && "border border-line bg-surface hover:bg-surface-2",
        variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
        variant === "quiet" && "text-ink-3 hover:text-ink",
        variant === "danger" && "border border-line bg-surface text-late hover:bg-late-soft",
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Icon name="spinner" size={size === "sm" ? 13 : 15} className="animate-spin" /> : icon ? <Icon name={icon} size={size === "sm" ? 13 : 15} /> : null}
      {children}
      {iconAfter && !loading && <Icon name={iconAfter} size={size === "sm" ? 13 : 15} />}
    </button>
  );
}
