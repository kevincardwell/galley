export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${u[i]}`;
}

export function timeAgo(unixSeconds: number | null | undefined) {
  if (!unixSeconds) return "never";
  const s = Math.floor(Date.now() / 1000) - unixSeconds;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return "yesterday";
  return new Date(unixSeconds * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function formatDue(iso: string | null | undefined) {
  if (!iso) return { label: "", tone: "none" as const };
  const d = new Date(iso + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `${-diff}d overdue`, tone: "late" as const };
  if (diff === 0) return { label: "Today", tone: "soon" as const };
  if (diff === 1) return { label: "Tomorrow", tone: "soon" as const };
  if (diff < 7) return { label: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }), tone: "soon" as const };
  return { label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), tone: "none" as const };
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
