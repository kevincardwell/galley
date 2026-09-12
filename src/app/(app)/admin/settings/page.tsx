import { requireAdmin } from "@/lib/auth/current";
import { getSettings } from "@/lib/settings";
import { InstanceSettingsForm } from "@/components/admin/settings-form";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = getSettings();
  return (
    <div className="overflow-auto px-4 pt-4 pb-8 sm:px-6 sm:pt-5">
      <InstanceSettingsForm settings={{ instanceName: settings.instanceName, baseUrl: settings.baseUrl, maxUploadMb: settings.maxUploadMb, sessionDays: settings.sessionDays }} />
    </div>
  );
}
