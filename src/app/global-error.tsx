"use client";
import Link from "next/link";

const styles = {
  body: { margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", padding: "0 16px", background: "#efeeea", color: "#1c1b19", font: "14px/1.45 system-ui, sans-serif" } as const,
  card: { width: "100%", maxWidth: 384, border: "1px solid #dbd9d2", borderRadius: 10, background: "#fbfbfa", padding: 20, textAlign: "center" } as const,
  h1: { margin: 0, fontSize: 18, fontWeight: 600 } as const,
  p: { margin: "4px 0 16px", color: "#5f5c55" } as const,
  digest: { margin: "0 0 16px", fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#9a968c" } as const,
  row: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12 } as const,
  button: { font: "inherit", fontWeight: 500, padding: "6px 12px", borderRadius: 6, border: "1px solid #2f6b4f", background: "#2f6b4f", color: "#fff", cursor: "pointer" } as const,
  link: { color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 } as const,
};

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={styles.body}>
        <main style={styles.card}>
          <h1 style={styles.h1}>Something went wrong</h1>
          <p style={styles.p}>Galley hit an error it could not recover from. Trying again usually fixes it.</p>
          {error.digest && <p style={styles.digest}>{error.digest}</p>}
          <div style={styles.row}>
            <button type="button" style={styles.button} onClick={() => reset()}>Try again</button>
            <Link href="/" style={styles.link}>Back to your workspaces</Link>
          </div>
        </main>
      </body>
    </html>
  );
}
