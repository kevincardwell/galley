import { clsx } from "@/lib/clsx";
import { Icon, type IconName } from "./icon";

/** A small figure with its label. Use for counts that matter, not for decoration. */
export function Stat({ label, value, hint, icon, className }: { label: string; value: React.ReactNode; hint?: string; icon?: IconName; className?: string }) {
  return (
    <div className={clsx("flex flex-col gap-0.5", className)}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
        {icon && <Icon name={icon} size={13} />}
        {label}
      </span>
      <span className="tnum text-[17px] leading-tight font-semibold">{value}</span>
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </div>
  );
}
