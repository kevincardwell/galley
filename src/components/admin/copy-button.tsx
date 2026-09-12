"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";

function write(value: string, onOk: () => void) {
  navigator.clipboard
    .writeText(value)
    .then(() => { onOk(); toast("Link copied"); })
    .catch(() => toast("Could not copy", { tone: "late" }));
}

export function CopyButton({ value, label = "Copy", size = "md", variant = "default" }: { value: string; label?: string; size?: "sm" | "md"; variant?: "default" | "ghost" | "primary" }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size={size}
      variant={variant}
      icon={copied ? "check" : "copy"}
      onClick={() => write(value, () => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

/** The same thing as a row action: icon only, with the label in a tooltip. */
export function CopyIconButton({ value, label = "Copy invite link" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip label={copied ? "Copied" : label}>
      <IconButton
        name={copied ? "check" : "copy"}
        label={label}
        title=""
        onClick={() => write(value, () => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
      />
    </Tooltip>
  );
}
