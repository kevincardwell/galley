"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { sweepOrphanFiles } from "@/actions/admin";
import { formatBytes } from "@/lib/format";
import { InlineError } from "./bits";
import { useAdminAction } from "./use-action";

export function SweepButton() {
  const { pending, error, run } = useAdminAction();
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        icon="refresh"
        loading={pending}
        onClick={() => {
          setResult(null);
          run(sweepOrphanFiles, (d) => setResult(d.count === 0 ? "Nothing to sweep. Every file on disk belongs to an asset." : `Removed ${d.count} orphaned ${d.count === 1 ? "folder" : "folders"}, freeing ${formatBytes(d.bytes)}.`));
        }}
      >
        {pending ? "Sweeping…" : "Sweep orphaned files"}
      </Button>
      {result && <span role="status" className="flex items-center gap-1.5 text-sm text-done"><Icon name="check-circle" size={14} />{result}</span>}
      <InlineError>{error}</InlineError>
    </div>
  );
}
