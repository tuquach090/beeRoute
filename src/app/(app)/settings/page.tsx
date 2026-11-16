import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings-form";
import { getSettings } from "@/lib/settings/queries";
import { vi } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: vi.settings.title };

export default async function SettingsPage() {
  const settings = await getSettings();
  return <SettingsForm defaultStart={settings.defaultStart} />;
}
