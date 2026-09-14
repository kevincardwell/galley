"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { unlinkSupplier, updateSupplierLink } from "@/actions/suppliers";
import { Td } from "./bits";
import { useSupplierAction } from "./use-action";
import { costToInput, formatMoney, LINK_STATUSES, STATUS_LABEL, STATUS_TONE, type WorkspaceSupplierRow } from "./shared";
import type { SupplierLinkStatus } from "@/db/schema";

/** A borderless cell that becomes a proper field on hover and focus. Saves on Enter or blur. */
function CellInput({ value, onSave, label, placeholder, numeric, className }: {
  value: string;
  onSave: (next: string) => void;
  label: string;
  placeholder: string;
  numeric?: boolean;
  className?: string;
}) {
  // Uncontrolled, keyed on the saved value: a refresh from the server resets what you see.
  return (
    <input
      key={value}
      defaultValue={value}
      aria-label={label}
      placeholder={placeholder}
      onBlur={(e) => e.target.value !== value && onSave(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.currentTarget.value = value;
          e.currentTarget.blur();
        }
      }}
      className={clsx(
        "w-full cursor-text rounded-r border border-transparent bg-transparent px-1.5 py-1 text-[13px] transition-colors",
        "placeholder:text-ink-3 hover:border-line focus:border-line focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent",
        numeric && "tnum text-right",
        className,
      )}
    />
  );
}

export function LinkRow({ row, canEdit, currency }: { row: WorkspaceSupplierRow; canEdit: boolean; currency: string }) {
  const router = useRouter();
  const { pending, error, run } = useSupplierAction();
  const [confirm, setConfirm] = useState(false);

  const patch = (p: { status?: SupplierLinkStatus; cost?: string; note?: string }, message?: string) =>
    run(
      () => updateSupplierLink(row.id, p),
      () => {
        if (message) toast(message);
        router.refresh();
      },
    );

  return (
    <tr className={clsx("transition-colors hover:bg-surface-2", pending && "opacity-60")}>
      <Td className="max-w-[220px]">
        <Link href={`/suppliers/${row.supplierId}`} className="cursor-pointer font-medium transition-colors hover:text-accent hover:underline underline-offset-[3px]">
          <span className="block truncate">{row.name}</span>
        </Link>
        <span className="block truncate text-xs text-ink-3">{row.category ?? "Supplier"}</span>
        {error && (
          <span role="alert" className="block text-xs text-late">
            {error}
          </span>
        )}
      </Td>

      <Td className="max-w-[200px] text-ink-2">
        {row.email ? (
          <a href={`mailto:${row.email}`} className="block cursor-pointer truncate transition-colors hover:text-ink hover:underline underline-offset-[3px]">
            {row.email}
          </a>
        ) : row.phone ? (
          <a href={`tel:${row.phone.replace(/[^+\d]/g, "")}`} className="block cursor-pointer truncate transition-colors hover:text-ink">
            {row.phone}
          </a>
        ) : (
          <span className="text-ink-3">—</span>
        )}
      </Td>

      <Td numeric className="w-[120px]">
        {canEdit ? (
          <CellInput value={costToInput(row.cost)} onSave={(v) => patch({ cost: v })} label={`Cost for ${row.name}`} placeholder="—" numeric />
        ) : row.cost === null ? (
          <span className="text-ink-3">—</span>
        ) : (
          formatMoney(row.cost, currency)
        )}
      </Td>

      <Td className="min-w-[140px]">
        {canEdit ? (
          <CellInput value={row.note ?? ""} onSave={(v) => patch({ note: v })} label={`Note for ${row.name}`} placeholder="Add a note" />
        ) : (
          <span className={row.note ? "text-ink-2" : "text-ink-3"}>{row.note || "—"}</span>
        )}
      </Td>

      <Td className="w-[150px]">
        {canEdit ? (
          <select
            value={row.status}
            aria-label={`Status for ${row.name}`}
            onChange={(e) => patch({ status: e.target.value as SupplierLinkStatus }, `${row.name} moved to ${STATUS_LABEL[e.target.value as SupplierLinkStatus].toLowerCase()}`)}
            className="w-full cursor-pointer rounded-r border border-transparent bg-transparent px-1.5 py-1 text-[13px] transition-colors hover:border-line focus:border-line focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {LINK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        ) : (
          <Pill tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Pill>
        )}
      </Td>

      <Td className="w-10">
        {canEdit && (
          <>
            <IconButton name="trash" tone="danger" label={`Remove ${row.name} from this project`} onClick={() => setConfirm(true)} />
            <Dialog open={confirm} onClose={() => setConfirm(false)} title="Remove from this project?">
              <p className="m-0 mb-4 text-ink-2">
                <b>{row.name}</b> stays in the directory. Only the link to this project, with its cost and note, is removed.
              </p>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setConfirm(false)}>Keep it</Button>
                <Button
                  variant="danger"
                  loading={pending}
                  onClick={() =>
                    run(
                      () => unlinkSupplier(row.id),
                      () => {
                        setConfirm(false);
                        toast(`${row.name} removed`);
                        router.refresh();
                      },
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            </Dialog>
          </>
        )}
      </Td>
    </tr>
  );
}
