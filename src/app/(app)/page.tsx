import type { Metadata } from "next";
import { RouteForm } from "@/components/route-form";
import { listOwnCompanies } from "@/lib/companies/queries";
import { getSettings } from "@/lib/settings/queries";
import { vi } from "@/lib/i18n/vi";
import type { TripSlot } from "@/types/database";

export const metadata: Metadata = { title: vi.route.title };

export default async function RoutePage({ searchParams }: PageProps<"/">) {
  const [companies, settings] = await Promise.all([
    listOwnCompanies(),
    getSettings(),
  ]);

  // Set by the company form when it was opened from here (CLAUDE.md §5.2).
  const { added, date, slot } = await searchParams;
  const addedId = typeof added === "string" ? added : undefined;

  // Set when arriving from an empty slot on the calendar, so the save sheet
  // opens on the day the user tapped rather than today.
  const presetDate =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : undefined;
  const presetSlot =
    slot === "morning" || slot === "afternoon" ? (slot as TripSlot) : undefined;

  return (
    <RouteForm
      companies={companies}
      addedId={addedId}
      presetDate={presetDate}
      presetSlot={presetSlot}
      defaultStart={settings.defaultStart}
    />
  );
}
