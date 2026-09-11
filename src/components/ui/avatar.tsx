import { initials } from "@/lib/format";
import { clsx } from "@/lib/clsx";

export function Avatar({ name, size = 22, className, muted }: { name: string; size?: number; className?: string; muted?: boolean }) {
  return (
    <span
      title={name}
      className={clsx("inline-grid place-items-center rounded-full font-semibold shrink-0", muted ? "bg-ink-2 text-surface" : "bg-accent text-accent-ink", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {initials(name)}
    </span>
  );
}
