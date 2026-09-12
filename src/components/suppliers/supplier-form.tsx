"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { setSupplierTags, updateSupplier, type Result } from "@/actions/suppliers";
import { RatingInput } from "./rating-input";
import { TagInput } from "./tag-input";
import { useSupplierAction } from "./use-action";
import type { SupplierRow } from "./shared";

const sameTags = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** The full edit form on a supplier's page. Saves the record, then its tags. */
export function SupplierForm({ supplier }: { supplier: SupplierRow }) {
  const { pending, error, setError, run } = useSupplierAction();
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState({
    name: supplier.name,
    category: supplier.category ?? "",
    contactName: supplier.contactName ?? "",
    email: supplier.email ?? "",
    phone: supplier.phone ?? "",
    website: supplier.website ?? "",
    address: supplier.address ?? "",
    notes: supplier.notes ?? "",
  });
  const [rating, setRating] = useState<number | null>(supplier.rating);
  const [tags, setTags] = useState<string[]>(supplier.tags);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setError(null);
    setF((prev) => ({ ...prev, [k]: e.target.value }));
  };

  const save = () => {
    run<undefined>(async (): Promise<Result> => {
      const r = await updateSupplier(supplier.id, { ...f, rating });
      if (!r.ok || sameTags(tags, supplier.tags)) return r;
      const t = await setSupplierTags(supplier.id, tags);
      return t.ok ? { ok: true, data: undefined } : t;
    }, () => setSaved(true));
  };

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Label htmlFor="sf-name" className="sm:col-span-2">
        Name
        <Input id="sf-name" required maxLength={120} value={f.name} onChange={set("name")} />
      </Label>
      <Label htmlFor="sf-category">
        Category
        <Input id="sf-category" maxLength={60} value={f.category} onChange={set("category")} placeholder="Florist" />
      </Label>
      <Label htmlFor="sf-contact">
        Contact name
        <Input id="sf-contact" maxLength={120} value={f.contactName} onChange={set("contactName")} />
      </Label>
      <Label htmlFor="sf-email">
        Email
        <Input id="sf-email" type="email" maxLength={200} value={f.email} onChange={set("email")} />
      </Label>
      <Label htmlFor="sf-phone">
        Phone
        <Input id="sf-phone" maxLength={40} value={f.phone} onChange={set("phone")} />
      </Label>
      <Label htmlFor="sf-website" className="sm:col-span-2">
        Website
        <Input id="sf-website" maxLength={200} value={f.website} onChange={set("website")} placeholder="example.com" />
      </Label>
      <Label htmlFor="sf-address" className="sm:col-span-2">
        Address
        <Input id="sf-address" maxLength={300} value={f.address} onChange={set("address")} />
      </Label>

      <div className="flex flex-col gap-1 text-xs text-ink-2">
        <span>Rating</span>
        <RatingInput
          value={rating}
          onChange={(v) => {
            setSaved(false);
            setRating(v);
          }}
        />
      </div>
      <div className="flex flex-col gap-1 text-xs text-ink-2">
        <span>Tags</span>
        <TagInput
          tags={tags}
          onChange={(next) => {
            setSaved(false);
            setTags(next);
          }}
        />
      </div>

      <Label htmlFor="sf-notes" className="sm:col-span-2">
        Notes
        <Textarea id="sf-notes" maxLength={4000} value={f.notes} onChange={set("notes")} placeholder="What they are good at, what they charge, who to ask for." />
      </Label>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="primary" loading={pending} disabled={!f.name.trim()}>
          Save changes
        </Button>
        {error && (
          <span role="alert" className="text-[13px] text-late">
            {error}
          </span>
        )}
        {saved && !error && <span className="text-[13px] text-done">Saved</span>}
      </div>
    </form>
  );
}
