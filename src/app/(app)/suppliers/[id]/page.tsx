import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { getSettings } from "@/lib/settings";
import { supplierDetail } from "@/lib/queries/suppliers";
import { Icon } from "@/components/ui/icon";
import { PageHeader, Screen, Section } from "@/components/ui/page";
import { Pill } from "@/components/ui/pill";
import { Stars } from "@/components/suppliers/bits";
import { SupplierDangerZone } from "@/components/suppliers/danger-zone";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { UsageList } from "@/components/suppliers/usage-list";
import { formatMoney } from "@/components/suppliers/shared";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  const detail = supplierDetail(id, user);
  return { title: detail ? detail.supplier.name : "Supplier" };
}

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { currency } = getSettings();
  const detail = supplierDetail(id, user);
  if (!detail) notFound();
  const { supplier, usage, hidden } = detail;
  const archived = supplier.archivedAt !== null;

  return (
    <Screen>
      <Link
        href="/suppliers"
        className="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-ink-2 transition-colors hover:text-ink"
      >
        <Icon name="arrow-left" size={14} />
        All suppliers
      </Link>

      <PageHeader
        title={supplier.name}
        eyebrow={supplier.category ?? "Supplier"}
        action={
          <div className="flex items-center gap-3">
            <Stars value={supplier.rating} size={15} />
            {archived && <Pill tone="draft">Archived</Pill>}
          </div>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <Section title="Details">
          <SupplierForm supplier={supplier} />
        </Section>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-5">
          <Section
            title="Used on"
            action={
              supplier.bookedTotal > 0 ? <span className="tnum text-xs text-ink-3">{formatMoney(supplier.bookedTotal, currency)} booked</span> : undefined
            }
          >
            <UsageList usage={usage} hidden={hidden} currency={currency} />
          </Section>

          <Section title="Archive or delete">
            <SupplierDangerZone id={supplier.id} name={supplier.name} archived={archived} projectCount={supplier.projectCount} />
          </Section>
        </aside>
      </div>
    </Screen>
  );
}
