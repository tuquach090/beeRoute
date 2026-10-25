import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RouteForm } from "@/components/route-form";
import { getTrip } from "@/lib/trips/queries";
import { listOwnCompanies } from "@/lib/companies/queries";
import { vi } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: vi.tripDetail.edit };

export default async function EditTripPage({
  params,
}: PageProps<"/trips/[id]/edit">) {
  const { id } = await params;
  const [trip, companies] = await Promise.all([
    getTrip(id),
    listOwnCompanies(),
  ]);

  if (!trip) notFound();

  return <RouteForm companies={companies} trip={trip} />;
}
