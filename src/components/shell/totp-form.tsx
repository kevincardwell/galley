"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/page";
import { disableTotp, enableTotp, startTotp, type TotpSetup } from "@/actions/account";

const Name = ({ children }: { children: React.ReactNode }) => <span className="font-medium text-ink-2">{children}</span>;
const Hint = ({ children }: { children: React.ReactNode }) => <span className="text-xs text-ink-3">{children}</span>;

function Error({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="m-0 flex items-center gap-2 rounded-r bg-late-soft px-3 py-2 text-[13px] text-late">
      <Icon name="alert" size={15} />{children}
    </p>
  );
}

/** The QR, drawn as one path so no QR library has to reach the browser. */
function Qr({ qr }: { qr: TotpSetup["qr"] }) {
  const quiet = 4; // the quiet zone the QR spec asks for, or some scanners will not lock on
  return (
    <svg
      viewBox={`${-quiet} ${-quiet} ${qr.size + quiet * 2} ${qr.size + quiet * 2}`}
      className="size-44 shrink-0 rounded-r bg-white p-1"
      role="img"
      aria-label="QR code for your authenticator app"
    >
      <path d={qr.d} fill="#000" />
    </svg>
  );
}

/**
 * Two-factor with any authenticator app. Nothing is stored until a code from the app
 * proves it took the secret, and the recovery codes are shown once, right after.
 */
export function TotpForm({ enabled, hasPassword }: { enabled: boolean; hasPassword: boolean }) {
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function begin() {
    setError(null);
    start(async () => setSetup(await startTotp()));
  }

  function onEnable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r = await enableTotp(setup!.secret, String(form.get("code") || ""), String(form.get("password") || ""));
      if (!r.ok) return setError(r.error);
      setSetup(null);
      setCodes(r.codes);
    });
  }

  function onDisable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r = await disableTotp(String(form.get("password") || ""));
      if (!r.ok) return setError(r.error);
      setCodes(null);
    });
  }

  if (codes) {
    return (
      <Section title="Recovery codes" className="border-t border-line pt-6">
        <div className="flex flex-col gap-4">
          <p className="m-0 flex items-center gap-2 rounded-r bg-done-soft px-3 py-2 text-[13px] text-done">
            <Icon name="check-circle" size={15} />Two-factor is on. You will be asked for a code every time you sign in.
          </p>
          <p className="m-0 text-[13px] text-ink-2">
            Save these somewhere safe. Each one signs you in once if you lose your phone, and this is the only time they are shown.
          </p>
          <ul className="m-0 grid list-none grid-cols-2 gap-1.5 rounded-r border border-line bg-surface-2 p-3 font-mono text-sm text-ink">
            {codes.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <div className="flex gap-2">
            <Button icon="copy" onClick={() => navigator.clipboard?.writeText(codes.join("\n"))}>Copy codes</Button>
            <Button variant="primary" icon="check" onClick={() => setCodes(null)}>I have saved them</Button>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section title="Two-factor authentication" className="border-t border-line pt-6">
      {enabled ? (
        <form onSubmit={onDisable} className="flex flex-col gap-4">
          <p className="m-0 flex items-center gap-2 text-sm text-ink">
            <Icon name="shield" size={15} className="text-done" />On. Sign-in asks for a code from your authenticator app.
          </p>
          {hasPassword && (
            <Label htmlFor="totp-off-password">
              <Name>Your password</Name>
              <Input id="totp-off-password" name="password" type="password" autoComplete="current-password" required />
              <Hint>Confirms it is you before the second factor comes off.</Hint>
            </Label>
          )}
          <Error>{error}</Error>
          <div><Button type="submit" icon="x" variant="danger" loading={pending}>Turn off two-factor</Button></div>
        </form>
      ) : !setup ? (
        <div className="flex flex-col gap-4">
          <p className="m-0 text-[13px] text-ink-2">
            Off. Add a code from Google Authenticator, 1Password, Aegis or any other authenticator app to your sign-in.
          </p>
          <Error>{error}</Error>
          <div><Button variant="primary" icon="shield" loading={pending} onClick={begin}>Set up two-factor</Button></div>
        </div>
      ) : (
        <form onSubmit={onEnable} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start gap-4">
            <Qr qr={setup.qr} />
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <p className="m-0 text-[13px] text-ink-2">Scan this with your authenticator app, then type the six-digit code it shows.</p>
              <Hint>Cannot scan? Enter this key by hand:</Hint>
              <code className="rounded-r border border-line bg-surface-2 px-2 py-1.5 font-mono text-[13px] break-all text-ink">{setup.grouped}</code>
            </div>
          </div>
          <Label htmlFor="totp-code">
            <Name>Code from the app</Name>
            <Input id="totp-code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required />
          </Label>
          {hasPassword && (
            <Label htmlFor="totp-password">
              <Name>Your password</Name>
              <Input id="totp-password" name="password" type="password" autoComplete="current-password" required />
            </Label>
          )}
          <Error>{error}</Error>
          <div className="flex gap-2">
            <Button variant="primary" type="submit" icon="check" loading={pending}>Turn on two-factor</Button>
            <Button type="button" onClick={() => { setSetup(null); setError(null); }}>Cancel</Button>
          </div>
        </form>
      )}
    </Section>
  );
}
