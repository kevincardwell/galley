"use client";
import { errorText } from "@/lib/user-error";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { connectSite } from "@/actions/site";

const Name = ({ children }: { children: React.ReactNode }) => <span className="font-medium text-ink-2">{children}</span>;
const Hint = ({ children }: { children: React.ReactNode }) => <span className="text-xs text-ink-3">{children}</span>;

/**
 * The repository fields, shared by the Site tab and the New workspace dialog. All optional in the
 * dialog: leave the address empty and no site is connected.
 */
export function SiteFields({ idPrefix, required = false }: { idPrefix: string; required?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor={`${idPrefix}-repo`}>
        <Name>Repository address</Name>
        <Input id={`${idPrefix}-repo`} name="repoUrl" type="url" inputMode="url" placeholder="https://github.com/you/website" required={required} autoComplete="off" spellCheck={false} />
        <Hint>Public or private, on GitHub or any git host that speaks https.</Hint>
      </Label>
      <Label htmlFor={`${idPrefix}-token`}>
        <Name>Access token</Name>
        <Input id={`${idPrefix}-token`} name="token" type="password" autoComplete="off" spellCheck={false} placeholder="github_pat_…" />
        <Hint>
          A GitHub fine-grained token for this one repository, with Contents and Pull requests set to Read and write, and Actions set to Read (add Secrets: Read and write to
          manage deploy details from Galley). Needed to send changes for review, and to read a private repository. It stays on this server.
        </Hint>
      </Label>
      <details className="group text-xs text-ink-2">
        <summary className="cursor-pointer font-medium select-none">More options</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Label htmlFor={`${idPrefix}-base`}>
            <Name>Main branch</Name>
            <Input id={`${idPrefix}-base`} name="baseBranch" placeholder="main" spellCheck={false} />
          </Label>
          <Label htmlFor={`${idPrefix}-work`}>
            <Name>Branch for changes</Name>
            <Input id={`${idPrefix}-work`} name="workBranch" placeholder="galley" spellCheck={false} />
          </Label>
          <Label htmlFor={`${idPrefix}-root`}>
            <Name>Website folder</Name>
            <Input id={`${idPrefix}-root`} name="root" placeholder="the whole repository" spellCheck={false} />
          </Label>
        </div>
      </details>
    </div>
  );
}

export function ConnectSiteForm({ workspaceId }: { workspaceId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-line p-5"
      action={(fd) =>
        start(async () => {
          setError(null);
          try {
            await connectSite(workspaceId, fd);
          } catch (e) {
            setError(errorText(e));
          }
        })
      }
    >
      <SiteFields idPrefix="site" required />
      {error && <p role="alert" className="m-0 text-[13px] text-late">{error}</p>}
      <div>
        <Button type="submit" variant="primary" icon="branch" loading={pending}>
          {pending ? "Copying the repository…" : "Connect repository"}
        </Button>
      </div>
    </form>
  );
}
