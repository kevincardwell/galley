"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import type { Result } from "@/actions/admin";
import type { WorkspaceRole } from "@/db/schema";
import { InlineError } from "./bits";
import { useAdminAction } from "./use-action";

export type EditorRow = { id: string; label: string; sub?: string; lead?: ReactNode; role: WorkspaceRole };
export type EditorOption = { id: string; label: string };

const ROLES: WorkspaceRole[] = ["viewer", "editor", "manager"];

function RoleSelect({ value, disabled, onChange, id }: { value: WorkspaceRole; disabled?: boolean; onChange: (r: WorkspaceRole) => void; id?: string }) {
  return (
    <Select id={id} className="w-auto" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as WorkspaceRole)}>
      {ROLES.map((r) => <option key={r} value={r}>{r[0]!.toUpperCase() + r.slice(1)}</option>)}
    </Select>
  );
}

/**
 * Edits the memberships of one person (rows = workspaces) or one workspace (rows = people).
 * The parent decides which id goes where when calling the action.
 */
export function MembershipEditor({ rows, options, addLabel, emptyText, onSet, onRemove, lockedId }: {
  rows: EditorRow[];
  options: EditorOption[];
  addLabel: string;
  emptyText: string;
  onSet: (otherId: string, role: WorkspaceRole) => Promise<Result>;
  onRemove: (otherId: string) => Promise<Result>;
  /** A row that may not be removed (e.g. yourself). */
  lockedId?: string;
}) {
  const { pending, error, run } = useAdminAction();
  const candidates = options.filter((o) => !rows.some((r) => r.id === o.id));
  const [pick, setPick] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("editor");
  const chosen = pick || candidates[0]?.id || "";
  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-ink-3">{emptyText}</p>
      ) : (
        <ul className="m-0 list-none divide-y divide-line-2 border-y border-line-2 p-0">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2.5 py-2">
              {r.lead}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{r.label}</span>
                {r.sub && <span className="block truncate text-xs text-ink-3">{r.sub}</span>}
              </span>
              <RoleSelect value={r.role} disabled={pending} onChange={(next) => run(() => onSet(r.id, next))} />
              <Button size="sm" variant="ghost" disabled={pending || r.id === lockedId} onClick={() => run(() => onRemove(r.id))}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
      {candidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-auto min-w-44 flex-1" value={chosen} disabled={pending} onChange={(e) => setPick(e.target.value)} aria-label={addLabel}>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
          <RoleSelect value={role} disabled={pending} onChange={setRole} />
          <Button size="sm" disabled={pending || !chosen} onClick={() => run(() => onSet(chosen, role), () => setPick(""))}>{addLabel}</Button>
        </div>
      )}
      <InlineError>{error}</InlineError>
    </div>
  );
}
