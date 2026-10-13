"use client";
import { errorText } from "@/lib/user-error";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { deploySecrets, removeDeploySecret, saveDeploySecrets } from "@/actions/site";
import type { RepoSecret } from "@/lib/site/github";

const Name = ({ children }: { children: React.ReactNode }) => <span className="font-medium text-ink-2">{children}</span>;

/** The names the deploy workflow reads. */
const FTP = [
  { name: "FTP_SERVER", label: "FTP server", placeholder: "ftp.example.com", type: "text" },
  { name: "FTP_USERNAME", label: "FTP username", placeholder: "", type: "text" },
  { name: "FTP_PASSWORD", label: "FTP password", placeholder: "", type: "password" },
] as const;

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function DeploySecrets({ workspaceId }: { workspaceId: string }) {
  const [secrets, setSecretsList] = useState<RepoSecret[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [form, setForm] = useState(0); // remounts the form, which empties it
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    deploySecrets(workspaceId).then(
      (list) => live && (setSecretsList(list), setError(null)),
      (e) => live && setError(errorText(e)),
    );
    return () => {
      live = false;
    };
  }, [workspaceId, version]);

  const byName = new Map((secrets ?? []).map((s) => [s.name, s]));
  const others = (secrets ?? []).filter((s) => !FTP.some((f) => f.name === s.name));

  const save = (fd: FormData) =>
    start(async () => {
      const values: Record<string, string> = {};
      for (const f of FTP) values[f.name] = String(fd.get(f.name) ?? "");
      const extraName = String(fd.get("extraName") ?? "").trim().toUpperCase();
      if (extraName) values[extraName] = String(fd.get("extraValue") ?? "");
      try {
        await saveDeploySecrets(workspaceId, values);
        toast("Saved to GitHub. The next deploy uses them.", { tone: "done" });
        setForm((n) => n + 1);
        setVersion((n) => n + 1);
      } catch (e) {
        toast(errorText(e), { tone: "late", duration: 9000 });
      }
    });

  const remove = (name: string) =>
    start(async () => {
      try {
        await removeDeploySecret(workspaceId, name);
        setConfirm(null);
        setVersion((n) => n + 1);
      } catch (e) {
        toast(errorText(e), { tone: "late" });
      }
    });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <div>
        <p className="m-0 font-medium">Deploy details</p>
        <p className="m-0 mt-1 text-[13px] text-ink-2">
          Saved as encrypted secrets in the GitHub repository, where its deploy workflow reads them. Galley passes them on and keeps none of them, and GitHub never shows them
          again: to change one, type the new value.
        </p>
      </div>
      {error && (
        <p role="alert" className="m-0 text-[13px] text-late">
          <Icon name="alert" size={13} className="mr-1 inline" />
          {error}
        </p>
      )}
      <form key={form} action={save} className="grid gap-3 sm:grid-cols-3">
        {FTP.map((f) => {
          const set = byName.get(f.name);
          return (
            <Label key={f.name} htmlFor={`secret-${f.name}`}>
              <Name>{f.label}</Name>
              <Input id={`secret-${f.name}`} name={f.name} type={f.type} autoComplete="off" spellCheck={false} placeholder={set ? "Set. Leave empty to keep it." : f.placeholder || "Not set"} />
              <span className="text-xs text-ink-3">{set ? `${f.name}, set ${when(set.updatedAt)}` : f.name}</span>
            </Label>
          );
        })}
        <details className="text-xs text-ink-2 sm:col-span-3">
          <summary className="cursor-pointer font-medium select-none">Another secret</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-[200px_1fr]">
            <Label htmlFor="secret-extra-name">
              <Name>Name</Name>
              <Input id="secret-extra-name" name="extraName" placeholder="CONFIG_PHP" autoComplete="off" spellCheck={false} className="font-mono uppercase" />
            </Label>
            <Label htmlFor="secret-extra-value">
              <Name>Value</Name>
              <Input id="secret-extra-value" name="extraValue" type="password" autoComplete="off" spellCheck={false} />
            </Label>
          </div>
        </details>
        <div className="sm:col-span-3">
          <Button type="submit" variant="primary" icon="key" loading={pending}>
            Save to GitHub
          </Button>
        </div>
      </form>
      {others.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 border-t border-line p-0 pt-3 text-[13px]" aria-label="Other secrets in the repository">
          {others.map((s) => (
            <li key={s.name} className="flex flex-wrap items-center gap-2">
              <code className="font-mono text-xs">{s.name}</code>
              <span className="text-xs text-ink-3">set {when(s.updatedAt)}</span>
              {confirm === s.name ? (
                <span className="ml-auto flex items-center gap-2 text-ink-2">
                  Remove it from the repository?
                  <Button size="sm" onClick={() => setConfirm(null)}>Keep</Button>
                  <Button size="sm" variant="danger" icon="trash" loading={pending} onClick={() => remove(s.name)}>Remove</Button>
                </span>
              ) : (
                <Button size="sm" variant="ghost" icon="x" className="ml-auto" onClick={() => setConfirm(s.name)}>Remove</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
