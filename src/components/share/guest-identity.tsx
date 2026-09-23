"use client";
import { useState } from "react";
import { Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useGuestName } from "./guest-name";

/** The share view's one name field, in the header. Everything the client sends is signed with it. */
export function GuestIdentity() {
  const [name, setName, settle] = useGuestName();
  const [editing, setEditing] = useState(false);

  if (name.trim() && !editing) {
    return (
      <p className="m-0 flex min-w-0 items-center gap-1.5 text-[13px] text-ink-2">
        <Icon name="user" size={13} className="shrink-0 text-ink-3" />
        <span className="truncate">
          You are <span className="font-medium text-ink">{name}</span>
        </span>
        <button type="button" onClick={() => setEditing(true)} className="shrink-0 cursor-pointer rounded-r px-1 text-xs text-ink-3 underline-offset-2 hover:text-ink hover:underline">
          Change
        </button>
      </p>
    );
  }

  return (
    <label htmlFor="guest-name" className="flex items-center gap-2 text-[13px] text-ink-2">
      <span className="shrink-0">Your name</span>
      <Input
        id="guest-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        // Stay a field while it has focus, or the first letter typed would collapse it.
        onFocus={() => setEditing(true)}
        onBlur={() => {
          settle();
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        autoFocus={editing}
        maxLength={60}
        autoComplete="name"
        placeholder="So we know who said what"
        className="w-52 py-1 text-[13px]"
      />
    </label>
  );
}
