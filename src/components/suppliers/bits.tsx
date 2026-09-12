import { clsx } from "@/lib/clsx";
import { Icon } from "@/components/ui/icon";
import { displayHost } from "./shared";

const STAR_POSITIONS = [1, 2, 3, 4, 5] as const;

/** Five stars, filled up to the rating. Renders nothing when the supplier is unrated. */
export function Stars({ value, size = 13, className }: { value: number | null; size?: number; className?: string }) {
  if (!value) return null;
  return (
    <span role="img" aria-label={`Rated ${value} out of 5`} className={clsx("inline-flex items-center gap-px", className)}>
      {STAR_POSITIONS.map((n) => (
        <Icon key={n} name="star" size={size} className={n <= value ? "fill-current text-accent" : "text-line"} />
      ))}
    </span>
  );
}

type ContactFields = { email: string | null; phone: string | null; website: string | null; address?: string | null };

const line = "relative z-10 inline-flex max-w-full items-center gap-1.5 text-ink-2 transition-colors hover:text-ink";
const linkLine = `${line} cursor-pointer hover:underline underline-offset-[3px] decoration-line`;

/**
 * Real mailto / tel / https links. They sit above the card's stretched link (z-10) so clicking an
 * address opens the mail client instead of the supplier page.
 */
export function ContactLines({ supplier, className, showAddress = true }: { supplier: ContactFields; className?: string; showAddress?: boolean }) {
  const { email, phone, website, address } = supplier;
  if (!email && !phone && !website && !(showAddress && address)) return null;
  return (
    <ul className={clsx("m-0 flex list-none flex-col gap-1 p-0 text-[13px]", className)}>
      {email && (
        <li className="min-w-0">
          <a href={`mailto:${email}`} className={linkLine}>
            <Icon name="mail" size={13} className="text-ink-3" />
            <span className="truncate">{email}</span>
          </a>
        </li>
      )}
      {phone && (
        <li className="min-w-0">
          <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className={linkLine}>
            <Icon name="phone" size={13} className="text-ink-3" />
            <span className="truncate">{phone}</span>
          </a>
        </li>
      )}
      {website && (
        <li className="min-w-0">
          <a href={website} target="_blank" rel="noreferrer" className={linkLine}>
            <Icon name="globe" size={13} className="text-ink-3" />
            <span className="truncate">{displayHost(website)}</span>
          </a>
        </li>
      )}
      {showAddress && address && (
        <li className="min-w-0">
          <span className={line}>
            <Icon name="pin" size={13} className="text-ink-3" />
            <span className="truncate">{address}</span>
          </span>
        </li>
      )}
    </ul>
  );
}

/** A link that looks like the default Button, so we never nest a button inside an anchor. */
export const linkButtonClass =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-r border border-line bg-surface px-3 py-1.5 font-medium whitespace-nowrap transition-colors hover:bg-surface-2";

// ---- Table primitives (13px rows, hairline rules, numbers right and tabular) ----

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("-mx-1 overflow-x-auto px-1", className)}>
      <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">{children}</table>
    </div>
  );
}

export function Th({ children, className, numeric }: { children?: React.ReactNode; className?: string; numeric?: boolean }) {
  return <th className={clsx("border-b border-line px-2 py-1.5 text-xs font-medium text-ink-3", numeric && "text-right", className)}>{children}</th>;
}

export function Td({ children, className, numeric, colSpan }: { children?: React.ReactNode; className?: string; numeric?: boolean; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={clsx("border-b border-line-2 px-2 py-1.5 align-middle", numeric && "tnum text-right", className)}>
      {children}
    </td>
  );
}

/** The tag chips shown on a card or a detail header. Read-only. */
export function TagList({ tags, className }: { tags: string[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <ul className={clsx("m-0 flex list-none flex-wrap gap-1 p-0", className)}>
      {tags.map((t) => (
        <li key={t} className="rounded-full border border-line px-2 py-px text-xs text-ink-2">
          #{t}
        </li>
      ))}
    </ul>
  );
}
