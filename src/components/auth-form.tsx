"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/actions/auth";

type Field = { name: string; label: string; type?: string; autoComplete?: string; defaultValue?: string; readOnly?: boolean };

export function AuthForm({ action, fields, submit, hidden = {}, title, intro }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  fields: Field[];
  submit: string;
  hidden?: Record<string, string>;
  title: string;
  intro?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <h1 className="m-0 text-lg font-semibold">{title}</h1>
      {intro && <p className="m-0 -mt-1 text-ink-2">{intro}</p>}
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {fields.map((f) => (
        <label key={f.name} className="flex flex-col gap-1 text-xs text-ink-2">
          {f.label}
          <input
            id={`auth-${f.name}`}
            name={f.name}
            type={f.type ?? "text"}
            autoComplete={f.autoComplete}
            defaultValue={f.defaultValue}
            readOnly={f.readOnly}
            required
            className="rounded-r border border-line bg-surface px-2.5 py-1.5 text-sm text-ink read-only:text-ink-2 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
      ))}
      {state?.error && <p role="alert" className="m-0 rounded-r bg-late-soft px-3 py-2 text-sm text-late">{state.error}</p>}
      <Button variant="primary" type="submit" disabled={pending} className="mt-1">{pending ? "One moment…" : submit}</Button>
    </form>
  );
}
