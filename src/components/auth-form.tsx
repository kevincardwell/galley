"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { FormState } from "@/actions/auth";

type TextField = { name: string; label: string; type?: "text" | "email" | "password"; autoComplete?: string; defaultValue?: string; readOnly?: boolean };
type CheckboxField = { name: string; label: string; type: "checkbox"; defaultChecked?: boolean };
type Field = TextField | CheckboxField;

const isCheckbox = (f: Field): f is CheckboxField => f.type === "checkbox";

export function AuthForm({ action, fields, submit, hidden = {}, title, intro }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  fields: Field[];
  submit: string;
  hidden?: Record<string, string>;
  title: string;
  intro?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const texts = fields.filter((f): f is TextField => !isCheckbox(f));
  const checks = fields.filter(isCheckbox);
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <header>
        <h1 className="m-0 text-lg leading-tight font-semibold tracking-tight">{title}</h1>
        {intro && <p className="m-0 mt-1.5 text-[13px] text-ink-2">{intro}</p>}
      </header>

      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      <div className="flex flex-col gap-3.5">
        {texts.map((f) => (
          <label key={f.name} htmlFor={`auth-${f.name}`} className="flex flex-col gap-1.5 text-xs font-medium text-ink-2">
            {f.label}
            <input
              id={`auth-${f.name}`}
              name={f.name}
              type={f.type ?? "text"}
              autoComplete={f.autoComplete}
              defaultValue={f.defaultValue}
              readOnly={f.readOnly}
              required
              className="rounded-r border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors duration-150 read-only:bg-surface-2 read-only:text-ink-2 placeholder:text-ink-3 hover:border-ink-3 focus:ring-2 focus:ring-accent focus:outline-none"
            />
          </label>
        ))}
      </div>

      {checks.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line-2 pt-4">
          {checks.map((f) => (
            <label key={f.name} htmlFor={`auth-${f.name}`} className="flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-2">
              <input id={`auth-${f.name}`} name={f.name} type="checkbox" defaultChecked={f.defaultChecked} className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent" />
              {f.label}
            </label>
          ))}
        </div>
      )}

      {state?.error && (
        <p role="alert" className="m-0 flex items-start gap-2 rounded-r bg-late-soft px-3 py-2 text-[13px] text-late">
          <Icon name="alert" size={15} className="mt-0.5" />
          <span>{state.error}</span>
        </p>
      )}

      <Button variant="primary" type="submit" loading={pending} className="w-full py-2">{pending ? "One moment…" : submit}</Button>
    </form>
  );
}
