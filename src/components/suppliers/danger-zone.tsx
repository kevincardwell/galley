"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { archiveSupplier, deleteSupplier } from "@/actions/suppliers";
import { useSupplierAction } from "./use-action";

/** Archive keeps the history; delete takes the supplier off every project it is on. */
export function SupplierDangerZone({ id, name, archived, projectCount }: { id: string; name: string; archived: boolean; projectCount: number }) {
  const router = useRouter();
  const { pending, error, run } = useSupplierAction();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          icon={archived ? "undo" : "archive"}
          size="sm"
          loading={pending && !open}
          onClick={() =>
            run(
              () => archiveSupplier(id, !archived),
              () => {
                toast(archived ? `${name} restored` : `${name} archived`);
                router.refresh();
              },
            )
          }
        >
          {archived ? "Restore supplier" : "Archive supplier"}
        </Button>
        <Button variant="danger" size="sm" icon="trash" onClick={() => setOpen(true)}>
          Delete supplier
        </Button>
      </div>
      <p className="m-0 text-xs text-ink-3">
        Archiving hides them from the directory and keeps every project link. Deleting removes them from {projectCount === 1 ? "the project" : `all ${projectCount} projects`} they are on.
      </p>
      {error && !open && (
        <p role="alert" className="m-0 text-[13px] text-late">
          {error}
        </p>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Delete this supplier?">
        <p className="m-0 mb-3 text-ink-2">
          Type <b>{name}</b> to confirm. This cannot be undone.
        </p>
        <Input aria-label={`Type ${name} to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} />
        {error && (
          <p role="alert" className="m-0 mt-2 text-[13px] text-late">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setOpen(false)}>Keep them</Button>
          <Button
            variant="danger"
            loading={pending}
            disabled={typed.trim() !== name}
            onClick={() =>
              run(
                () => deleteSupplier(id),
                () => {
                  toast(`${name} deleted`);
                  router.push("/suppliers");
                },
              )
            }
          >
            Delete for good
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
