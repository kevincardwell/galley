"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { InlineError } from "./bits";
import { useAdminAction } from "./use-action";
import { saveMailSettings, sendTestEmail } from "@/actions/admin";
import { MAIL_PROVIDERS, PROVIDER_HINTS, PROVIDER_LABELS, SMTP_PRESETS, type MailProvider, type PublicMailSettings } from "@/lib/email/providers";

type Props = { mail: PublicMailSettings; configured: boolean; hasSecret: { smtpPass: boolean; apiKey: boolean }; adminEmail: string };

export function MailForm({ mail, configured, hasSecret, adminEmail }: Props) {
  const save = useAdminAction();
  const test = useAdminAction();
  const [provider, setProvider] = useState<MailProvider>(mail.provider);
  const [host, setHost] = useState(mail.smtp.host);
  const [port, setPort] = useState(String(mail.smtp.port));
  const [preset, setPreset] = useState("custom");
  const [saved, setSaved] = useState(false);
  const [testTo, setTestTo] = useState(adminEmail);
  const [testResult, setTestResult] = useState<string | null>(null);
  const presetNote = SMTP_PRESETS.find((p) => p.id === preset)?.note;

  function applyPreset(id: string) {
    setPreset(id);
    const found = SMTP_PRESETS.find((p) => p.id === id);
    if (found && found.host) { setHost(found.host); setPort(String(found.port)); }
  }

  return (
    <div className="grid max-w-3xl gap-5">
      <form
        className="rounded-lg border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const get = (k: string) => String(fd.get(k) ?? "");
          setSaved(false);
          save.run(
            () => saveMailSettings({
              provider,
              from: get("from"),
              replyTo: get("replyTo"),
              host,
              port: port || "587",
              user: get("user"),
              pass: get("pass"),
              apiKey: get("apiKey"),
              domain: get("domain"),
              euRegion: fd.get("euRegion") === "on",
            }),
            () => setSaved(true),
          );
        }}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="m-0 flex items-center gap-2 text-sm font-semibold"><Icon name="mail" size={15} className="text-ink-3" />How email is sent</h2>
          {configured ? <Pill tone="done">Sending via {PROVIDER_LABELS[mail.provider]}</Pill> : <Pill tone="draft">Not sending yet</Pill>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Label htmlFor="mail-provider" className="sm:col-span-2">
            Provider
            <Select id="mail-provider" value={provider} onChange={(e) => setProvider(e.target.value as MailProvider)}>
              {MAIL_PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>)}
            </Select>
            <span className="text-xs text-ink-3">{PROVIDER_HINTS[provider]}</span>
          </Label>

          {provider !== "none" && (
            <>
              <Label htmlFor="mail-from">
                From address
                <Input id="mail-from" name="from" defaultValue={mail.from} placeholder="Galley &lt;galley@example.co.uk&gt;" required />
                <span className="text-xs text-ink-3">Must be an address the provider lets you send from.</span>
              </Label>
              <Label htmlFor="mail-reply">
                Reply-to (optional)
                <Input id="mail-reply" name="replyTo" defaultValue={mail.replyTo} placeholder="studio@example.co.uk" />
              </Label>
            </>
          )}

          {provider === "smtp" && (
            <>
              <Label htmlFor="mail-preset" className="sm:col-span-2">
                Common servers
                <Select id="mail-preset" value={preset} onChange={(e) => applyPreset(e.target.value)}>
                  {SMTP_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </Select>
                {presetNote && <span className="text-xs text-ink-3">{presetNote}</span>}
              </Label>
              <Label htmlFor="mail-host">Server address<Input id="mail-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" autoComplete="off" spellCheck={false} /></Label>
              <Label htmlFor="mail-port">Port<Input id="mail-port" value={port} onChange={(e) => setPort(e.target.value)} type="number" min={1} max={65535} /><span className="text-xs text-ink-3">465 uses TLS, 587 upgrades with STARTTLS.</span></Label>
              <Label htmlFor="mail-user">Username<Input id="mail-user" name="user" defaultValue={mail.smtp.user} autoComplete="off" spellCheck={false} /></Label>
              <Label htmlFor="mail-pass">
                Password
                <Input id="mail-pass" name="pass" type="password" autoComplete="new-password" placeholder={hasSecret.smtpPass ? "Saved. Leave empty to keep it." : ""} />
              </Label>
            </>
          )}

          {(provider === "resend" || provider === "postmark" || provider === "sendgrid" || provider === "mailgun") && (
            <Label htmlFor="mail-key" className="sm:col-span-2">
              {provider === "postmark" ? "Server API token" : "API key"}
              <Input id="mail-key" name="apiKey" type="password" autoComplete="off" placeholder={hasSecret.apiKey ? "Saved. Leave empty to keep it." : ""} />
            </Label>
          )}

          {provider === "mailgun" && (
            <>
              <Label htmlFor="mail-domain">Sending domain<Input id="mail-domain" name="domain" defaultValue={mail.domain} placeholder="mg.example.co.uk" spellCheck={false} /></Label>
              <label htmlFor="mail-eu" className="flex items-center gap-2 self-end pb-1.5 text-sm">
                <input id="mail-eu" name="euRegion" type="checkbox" defaultChecked={mail.euRegion} className="size-4 accent-[var(--accent)]" />
                EU region account
              </label>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" icon="check" loading={save.pending}>{save.pending ? "Saving…" : "Save"}</Button>
          {saved && <span className="flex items-center gap-1.5 text-sm text-done"><Icon name="check-circle" size={14} />Saved</span>}
          <InlineError>{save.error}</InlineError>
        </div>
      </form>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="m-0 mb-1 flex items-center gap-2 text-sm font-semibold"><Icon name="zap" size={15} className="text-ink-3" />Check it works</h2>
        <p className="m-0 mb-3 text-ink-2">Sends one message using the settings you have saved, not what is typed above.</p>
        <div className="flex flex-wrap items-end gap-2">
          <Label htmlFor="mail-test" className="min-w-56 flex-1">Send a test to<Input id="mail-test" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} /></Label>
          <Button
            type="button"
            icon="mail"
            loading={test.pending}
            disabled={!configured}
            title={configured ? undefined : "Save a provider first"}
            onClick={() => { setTestResult(null); test.run(() => sendTestEmail(testTo), (r: { to: string }) => setTestResult(`Sent to ${r.to}`)); }}
          >
            {test.pending ? "Sending…" : "Send test email"}
          </Button>
        </div>
        {testResult && <p className="mb-0 mt-2 flex items-center gap-1.5 text-sm text-done"><Icon name="check-circle" size={14} />{testResult}</p>}
        <InlineError>{test.error}</InlineError>
        {!configured && <p className="mb-0 mt-2 text-xs text-ink-3">Until this is set up, invites still work: you copy the link and send it yourself from the <Link href="/admin/invites" className="underline underline-offset-2">Invites</Link> tab.</p>}
      </section>
    </div>
  );
}
