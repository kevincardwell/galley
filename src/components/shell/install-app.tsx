"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon, IconButton } from "@/components/ui/icon";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISSED = "galley-install-dismissed";

/** Already installed, or told us to stop asking. */
function alreadyHandled(): boolean {
  try { if (localStorage.getItem(DISMISSED) === "1") return true; } catch { /* private window */ }
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/**
 * Registers the service worker and offers the install step on phones.
 * Android fires `beforeinstallprompt`, which we hold until the person asks for it.
 * iOS has no such event, so Safari gets the Share → Add to Home Screen instructions instead,
 * a few seconds in rather than the moment the page paints.
 */
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // Only in production: development chunks share stable URLs, so a cache-first worker would
    // serve yesterday's JavaScript after every rebuild. Clear any worker left over from a local
    // production build so `next dev` is never poisoned by it.
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      } else {
        navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
        if ("caches" in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
    }
    if (alreadyHandled()) return;

    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const timer = isIosSafari() ? window.setTimeout(() => setIosHint(true), 2500) : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    setHidden(true);
    try { localStorage.setItem(DISMISSED, "1"); } catch { /* private window */ }
  }

  if (hidden || (!prompt && !iosHint)) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-sm rounded-lg border border-line bg-surface p-3 shadow-panel md:hidden" role="dialog" aria-label="Add Galley to your home screen">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Icon name="sparkles" size={17} /></span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-medium">Keep Galley on your home screen</p>
          {prompt ? (
            <p className="m-0 mt-0.5 text-[13px] text-ink-2">It opens full screen, like an app.</p>
          ) : (
            <p className="m-0 mt-0.5 text-[13px] text-ink-2">
              Tap <span className="font-medium">Share</span>, then <span className="font-medium">Add to Home Screen</span>.
            </p>
          )}
          {prompt && (
            <Button variant="primary" size="sm" className="mt-2" icon="download" onClick={async () => { await prompt.prompt(); await prompt.userChoice; dismiss(); }}>
              Add to home screen
            </Button>
          )}
        </div>
        <IconButton name="x" label="Not now" onClick={dismiss} />
      </div>
    </div>
  );
}
