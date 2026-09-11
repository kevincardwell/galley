"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
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
      className="grid max-w-3xl gap-8"
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
              smtp: { host: str(fd, "smtpHost"), port: str(fd, "smtpPort") || 587, user: str(fd, "smtpUser"), pass: str(fd, "smtpPass"), from: str(fd, "smtpFrom") },
            }),
          () => setSaved(true),
        );
      }}
    >
      <section>
        <h2 className="m-0 mb-3 text-sm font-semibold">Instance</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label htmlFor="st-name">Instance name<Input id="st-name" name="instanceName" defaultValue={settings.instanceName} required maxLength={80} /></Label>
          <Label htmlFor="st-url">Base URL<Input id="st-url" name="baseUrl" defaultValue={settings.baseUrl} placeholder="https://galley.example.co.uk" inputMode="url" /></Label>
          <Label htmlFor="st-upload">Max upload (MB)<Input id="st-upload" name="maxUploadMb" type="number" min={1} max={100000} step={1} defaultValue={settings.maxUploadMb} required /></Label>
          <Label htmlFor="st-session">Session lifetime (days)<Input id="st-session" name="sessionDays" type="number" min={1} max={365} step={1} defaultValue={settings.sessionDays} required /></Label>
        </div>
        <p className="mb-0 mt-2 text-xs text-ink-3">The base URL is used for invite links. Leave it empty to use whatever address you are visiting.</p>
      </section>

      <section>
        <h2 className="m-0 mb-1 text-sm font-semibold">Email (SMTP)</h2>
        <Hint small>Stored for later. Invite emails are not sent yet; copy links instead.</Hint>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Label htmlFor="st-host">Host<Input id="st-host" name="smtpHost" defaultValue={settings.smtp?.host ?? ""} placeholder="smtp.example.com" autoComplete="off" /></Label>
          <Label htmlFor="st-port">Port<Input id="st-port" name="smtpPort" type="number" min={1} max={65535} defaultValue={settings.smtp?.port ?? 587} /></Label>
          <Label htmlFor="st-user">Username<Input id="st-user" name="smtpUser" defaultValue={settings.smtp?.user ?? ""} autoComplete="off" /></Label>
          <Label htmlFor="st-pass">Password<Input id="st-pass" name="smtpPass" type="password" defaultValue={settings.smtp?.pass ?? ""} autoComplete="new-password" /></Label>
          <Label htmlFor="st-from" className="sm:col-span-2">From address<Input id="st-from" name="smtpFrom" defaultValue={settings.smtp?.from ?? ""} placeholder="Galley <galley@example.com>" /></Label>
        </div>
        <p className="mb-0 mt-2 text-xs text-ink-3">Leave the host empty to clear the SMTP settings.</p>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
        {saved && !error && <span className="text-done">Saved</span>}
        <InlineError>{error}</InlineError>
      </div>
    </form>
  );
}
