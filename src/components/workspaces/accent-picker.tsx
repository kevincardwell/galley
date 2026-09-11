"use client";
import { useState } from "react";

export const ACCENTS = ["#2F6B4F", "#B5533C", "#3F5FA8", "#7A5AA6", "#B7791F", "#2B7A8C", "#8C2B4A", "#4A4A4A"];

export function AccentPicker({ name, defaultValue = ACCENTS[0] }: { name: string; defaultValue?: string }) {
  const [v, setV] = useState(defaultValue);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="hidden" name={name} value={v} />
      {ACCENTS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setV(c)}
          aria-label={c}
          aria-pressed={v === c}
          className="size-6 rounded-full border-2 border-transparent aria-pressed:border-ink"
          style={{ background: c }}
        />
      ))}
      <input type="color" value={v} onChange={(e) => setV(e.target.value)} aria-label="Custom colour" className="size-6 cursor-pointer rounded border border-line bg-transparent p-0" />
    </div>
  );
}
