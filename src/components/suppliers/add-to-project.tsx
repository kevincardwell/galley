"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { linkSupplier } from "@/actions/suppliers";
import { NewSupplierFields } from "./new-supplier";
import { useSupplierAction } from "./use-action";

export type Candidate = { id: string; name: string; category: string | null; email: string | null };

/** Adds a supplier from the directory to this project, or creates one on the spot. */
export function AddToProject({ workspaceId, directory, linkedIds, label = "Add supplier", variant = "primary" }: {
  workspaceId: string;
  directory: Candidate[];
  linkedIds: string[];
  label?: string;
  variant?: "primary" | "default";
}) {
  const router = useRouter();
  const { pending, error, setError, run } = useSupplierAction();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"pick" | "new">("pick");
  const [q, setQ] = useState("");
  const linked = useMemo(() => new Set(linkedIds), [linkedIds]);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = needle
      ? directory.filter((s) => s.name.toLowerCase().includes(needle) || (s.category ?? "").toLowerCase().includes(needle) || (s.email ?? "").toLowerCase().includes(needle))
      : directory;
    return rows.slice(0, 40);
  }, [directory, q]);

  const close = () => {
    setOpen(false);
    setMode("pick");
    setQ("");
    setError(null);
  };

  const add = (id: string, name: string) =>
    run(
      () => linkSupplier(workspaceId, id, { status: "shortlisted" }),
      () => {
        close();
        toast(`${name} added to this project`, { tone: "done" });
        router.refresh();
      },
    );

  return (
    <>
      <Button variant={variant} icon="plus" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={close} title={mode === "pick" ? "Add supplier to this project" : "Add a new supplier"}>
        {mode === "new" ? (
          <NewSupplierFields
            submitLabel="Add and link"
            onCancel={() => setMode("pick")}
            onCreated={({ id, name }) => add(id, name)}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-r border border-line bg-surface px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-accent">
              <Icon name="search" size={15} className="text-ink-3" />
              <input
                autoFocus
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search the directory"
                aria-label="Search the directory"
                className="w-full min-w-0 bg-transparent text-ink placeholder:text-ink-3 focus:outline-none"
              />
            </div>

            {directory.length === 0 ? (
              <p className="m-0 text-[13px] text-ink-2">The directory is empty. Add the first supplier below.</p>
            ) : matches.length === 0 ? (
              <p className="m-0 text-[13px] text-ink-2">Nobody in the directory matches &ldquo;{q.trim()}&rdquo;.</p>
            ) : (
              <ul className="m-0 flex max-h-[320px] list-none flex-col overflow-y-auto p-0">
                {matches.map((s) => {
                  const already = linked.has(s.id);
                  return (
                    <li key={s.id} className="border-b border-line-2 last:border-b-0">
                      <button
                        type="button"
                        disabled={already || pending}
                        onClick={() => add(s.id, s.name)}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-r px-2 py-2 text-left transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      >
                        <Icon name="supplier" size={15} className="text-ink-3" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{s.name}</span>
                          <span className="block truncate text-xs text-ink-3">{s.category ?? s.email ?? "No category"}</span>
                        </span>
                        <span className="shrink-0 text-xs text-ink-3">{already ? "Already added" : "Add"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {error && (
              <p role="alert" className="m-0 text-[13px] text-late">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-line-2 pt-3">
              <Button type="button" variant="ghost" icon="plus" onClick={() => setMode("new")}>
                Create a new one
              </Button>
              <Button type="button" onClick={close}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
