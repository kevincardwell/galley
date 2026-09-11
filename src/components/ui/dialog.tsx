"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-labelledby={titleId} aria-modal="true">
      <div className="p-5">
        <h2 id={titleId} className="m-0 mb-4 text-base font-semibold">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
