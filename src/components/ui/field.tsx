import { clsx } from "@/lib/clsx";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const base = "w-full rounded-r border border-line bg-surface px-2.5 py-1.5 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(base, className)} {...rest} />;
}
export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx(base, className)} {...rest} />;
}
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(base, "min-h-24", className)} {...rest} />;
}
export function Label({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={clsx("flex flex-col gap-1 text-xs text-ink-2", className)}>
      {children}
    </label>
  );
}
