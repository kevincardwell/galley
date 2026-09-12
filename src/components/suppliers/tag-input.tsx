"use client";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/field";

const clean = (v: string) => v.trim().toLowerCase().replace(/^#/, "").slice(0, 30);

/** Type a tag and press Enter. Tags are lower case so the filter bar stays tidy. */
export function TagInput({ tags, onChange }: { tags: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const t = clean(draft);
    setDraft("");
    if (!t || tags.includes(t)) return;
    onChange([...tags, t].sort());
  };

  return (
    <div className="flex flex-col gap-2">
      {tags.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {tags.map((t) => (
            <li key={t}>
              <span className="inline-flex items-center gap-1 rounded-full border border-line py-px pr-1 pl-2.5 text-xs text-ink-2">
                #{t}
                <button
                  type="button"
                  aria-label={`Remove tag ${t}`}
                  title={`Remove tag ${t}`}
                  onClick={() => onChange(tags.filter((x) => x !== t))}
                  className="inline-grid size-5 cursor-pointer place-items-center rounded-full text-ink-3 transition-colors hover:bg-late-soft hover:text-late"
                >
                  <Icon name="x" size={12} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
          if (e.key === "Backspace" && draft === "" && tags.length > 0) onChange(tags.slice(0, -1));
        }}
        placeholder="Add a tag and press Enter"
        aria-label="Add a tag"
        maxLength={30}
      />
    </div>
  );
}
