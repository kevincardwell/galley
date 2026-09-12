"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { saveInstanceSettings } from "@/actions/admin";
import type { InstanceSettings } from "@/lib/settings";
import { Hint, InlineError } from "./bits";
import { useAdminAction } from "./use-action";

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "");
}

export function InstanceSettingsForm({ settings }: { settings: InstanceSettings }) {
  const { pending, error, run } = useAdminAction();
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="grid max-w-3xl gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setSaved(false);
        run(
          () =>
            saveInstanceSettings({
              instanceName: str(fd, "instanceName"),
              baseUrl: str(fd, "baseUrl"),
              maxUploadMb: str(fd, "maxUploadMb"),
              sessionDays: str(fd, "sessionDays"),
            }),
          () => setSaved(true),
        );
      }}
    >
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="m-0 mb-3 flex items-center gap-2 text-sm font-semibold"><Icon name="settings" size={15} className="text-ink-3" />Instance</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label htmlFor="st-name">Instance name<Input id="st-name" name="instanceName" defaultValue={settings.instanceName} required maxLength={80} /></Label>
          <Label htmlFor="st-url">Base URL<Input id="st-url" name="baseUrl" defaultValue={settings.baseUrl} placeholder="https://galley.example.co.uk" inputMode="url" /></Label>
          <Label htmlFor="st-upload">Max upload (MB)<Input id="st-upload" name="maxUploadMb" type="number" min={1} max={100000} step={1} defaultValue={settings.maxUploadMb} required /></Label>
          <Label htmlFor="st-session">Session lifetime (days)<Input id="st-session" name="sessionDays" type="number" min={1} max={365} step={1} defaultValue={settings.sessionDays} required /></Label>
        </div>
        <p className="mb-0 mt-2 text-xs text-ink-3">The base URL is used for invite links. Leave it empty to use whatever address you are visiting.</p>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="m-0 mb-1 flex items-center gap-2 text-sm font-semibold"><Icon name="mail" size={15} className="text-ink-3" />Email</h2>
        <Hint small>Choosing a provider, sending a test and seeing what went out all live on their own tab now.</Hint>
        <div className="mt-3">
          <Link href="/admin/email" className="inline-flex cursor-pointer items-center gap-1.5 rounded-r border border-line bg-surface px-3 py-1.5 font-medium transition-colors hover:bg-surface-2">
            <Icon name="mail" size={15} />
            Set up email
            <Icon name="chevron-right" size={14} className="text-ink-3" />
          </Link>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" icon="check" loading={pending}>{pending ? "Saving…" : "Save settings"}</Button>
        {saved && !error && <span className="flex items-center gap-1.5 text-done"><Icon name="check-circle" size={15} />Saved</span>}
        <InlineError>{error}</InlineError>
      </div>
    </form>
  );
}
