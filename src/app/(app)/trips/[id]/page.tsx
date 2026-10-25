import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TripDetailView } from "@/components/trip-detail";
import { getTrip } from "@/lib/trips/queries";
import { createClient } from "@/lib/supabase/server";
import { vi } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: vi.trips.title };

export default async function TripPage({ params }: PageProps<"/trips/[id]">) {
  const { id } = await params;
  const trip = await getTrip(id);

  if (!trip) notFound();

  // RLS already limits the read to the owner; the id is needed to build the
  // storage path, whose first segment must be the uploader.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  return <TripDetailView trip={trip} userId={user.id} />;
}
