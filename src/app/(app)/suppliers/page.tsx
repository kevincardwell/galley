import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current";
import { getSettings } from "@/lib/settings";
import { countSuppliers, listSuppliers, supplierCategories, supplierTagCounts } from "@/lib/queries/suppliers";
import { Empty } from "@/components/ui/empty";
import { PageHeader, Screen } from "@/components/ui/page";
import { FilterBar, type DirectoryFilters } from "@/components/suppliers/filter-bar";
import { NewSupplierButton } from "@/components/suppliers/new-supplier";
import { SupplierCard } from "@/components/suppliers/supplier-card";

export const metadata: Metadata = { title: "Suppliers" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireUser();
  const { currency } = getSettings();
  const sp = await searchParams;
  const filters: DirectoryFilters = {
    q: one(sp.q).slice(0, 80),
    category: one(sp.category),
    tag: one(sp.tag),
    archived: one(sp.archived) === "1",
  };

  const rows = listSuppliers({ q: filters.q, category: filters.category, tag: filters.tag, includeArchived: filters.archived });
  const categories = supplierCategories(filters.archived);
  const tags = supplierTagCounts(filters.archived);
  const filtered = Boolean(filters.q || filters.category || filters.tag);
  const total = countSuppliers(filters.archived);

  return (
    <Screen>
      <PageHeader
        title="Suppliers"
        count={rows.length}
        description="The florists, printers, photographers and freelancers you work with. Everyone signed in shares this directory."
        action={<NewSupplierButton />}
      />

      <FilterBar filters={filters} categories={categories} tags={tags} total={total} />

      {rows.length === 0 ? (
        filtered ? (
          <Empty
            icon="search"
            title="Nothing matches those filters"
            hint="Try a different word, or clear the filters to see the whole directory."
            action={<NewSupplierButton label="Add supplier" />}
          />
        ) : (
          <Empty
            icon="supplier"
            title="No suppliers yet"
            hint="Keep your florists, printers and freelancers in one place, then link them to the projects that use them."
            action={<NewSupplierButton />}
          />
        )
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 p-0">
          {rows.map((s) => (
            <SupplierCard key={s.id} supplier={s} currency={currency} />
          ))}
        </ul>
      )}
    </Screen>
  );
}
