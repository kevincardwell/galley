"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function CopyButton({ value, label = "Copy", size = "md", variant = "default" }: { value: string; label?: string; size?: "sm" | "md"; variant?: "default" | "ghost" | "primary" }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size={size}
      variant={variant}
      onClick={() => {
        navigator.clipboard
          .writeText(value)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
            toast("Link copied");
          })
          .catch(() => toast("Could not copy", { tone: "late" }));
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}
