import { requireAdmin } from "@/lib/auth/current";
import { getSettings } from "@/lib/settings";
import { InstanceSettingsForm } from "@/components/admin/settings-form";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = getSettings();
  return (
    <div className="overflow-auto px-6 pb-8 pt-5">
      <InstanceSettingsForm settings={settings} />
    </div>
  );
}
