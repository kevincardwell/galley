"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { createSupplier } from "@/actions/suppliers";
import { useSupplierAction } from "./use-action";

export type NewSupplierResult = { id: string; name: string };

/** The shared "Add supplier" form. Whoever opens it decides what happens next. */
export function NewSupplierFields({ onCreated, onCancel, submitLabel = "Add supplier" }: { onCreated: (r: NewSupplierResult) => void; onCancel: () => void; submitLabel?: string }) {
  const { pending, error, run } = useSupplierAction();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => createSupplier({ name, category, contactName, email, phone, website }),
          ({ id }) => onCreated({ id, name: name.trim() }),
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Label htmlFor="ns-name" className="sm:col-span-2">
          Name
          <Input id="ns-name" autoFocus required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Bloom &amp; Bramble" />
        </Label>
        <Label htmlFor="ns-category">
          Category
          <Input id="ns-category" maxLength={60} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Florist" />
        </Label>
        <Label htmlFor="ns-contact">
          Contact name
          <Input id="ns-contact" maxLength={120} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Ada Bell" />
        </Label>
        <Label htmlFor="ns-email">
          Email
          <Input id="ns-email" type="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@example.com" />
        </Label>
        <Label htmlFor="ns-phone">
          Phone
          <Input id="ns-phone" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="020 7946 0000" />
        </Label>
        <Label htmlFor="ns-website" className="sm:col-span-2">
          Website
          <Input id="ns-website" maxLength={200} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" />
        </Label>
      </div>
      {error && (
        <p role="alert" className="m-0 text-[13px] text-late">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={pending} disabled={!name.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Directory header button: adds to the shared address book and stays on the list. */
export function NewSupplierButton({ label = "Add supplier", variant = "primary" }: { label?: string; variant?: "primary" | "default" }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant={variant} icon="plus" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add supplier">
        {open && (
          <NewSupplierFields
            onCancel={() => setOpen(false)}
            onCreated={({ name }) => {
              setOpen(false);
              toast(`${name} added`, { tone: "done" });
              router.refresh();
            }}
          />
        )}
      </Dialog>
    </>
  );
}
