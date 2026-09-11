"use client";
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  /** Current href when the selection sits inside a link, else empty. */
  initial: string;
  onApply: (href: string) => void;
  onRemove: () => void;
  onClose: () => void;
  /** The toolbar button that opened us; mousedowns there are left to its own toggle. */
  anchor?: RefObject<HTMLElement | null>;
};

/** Turn "example.com/page" into "https://example.com/page"; leave mailto:, tel:, #anchors and absolute URLs alone. */
export function normaliseHref(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^(https?:|mailto:|tel:|ftp:|#|\/)/i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
  return `https://${v}`;
}

/** Small panel anchored under the toolbar's Link button. */
export function LinkPopover({ initial, onApply, onRemove, onClose, anchor }: Props) {
  const [value, setValue] = useState(initial);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (root.current?.contains(t) || anchor?.current?.contains(t)) return;
      onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose, anchor]);

  const apply = () => {
    const href = normaliseHref(value);
    if (!href) { if (initial) onRemove(); else onClose(); return; }
    onApply(href);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); apply(); }
  };

  return (
    <div
      ref={root}
      role="dialog"
      aria-label="Link"
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } }}
      className="absolute right-0 top-full z-20 mt-1 flex w-[min(320px,calc(100vw-2rem))] items-center gap-1.5 rounded-r border border-line bg-surface p-1.5 shadow-panel"
    >
      <input
        ref={input}
        type="url"
        inputMode="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        placeholder="example.com/page"
        aria-label="Link URL"
        spellCheck={false}
        autoComplete="off"
        className="min-w-0 flex-1 rounded-r border border-line bg-surface px-2.5 py-1 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {initial && (
        <Button size="sm" variant="ghost" onClick={onRemove}>Remove</Button>
      )}
      <Button size="sm" variant="primary" onClick={apply}>Apply</Button>
    </div>
  );
}
