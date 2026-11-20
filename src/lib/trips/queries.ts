import "server-only";
import { createClient } from "@/lib/supabase/server";
import { monthRange, type YearMonth } from "@/lib/dates/vn-date";
import { signGatePhotos } from "@/lib/companies/queries";
import { PHOTO_BUCKET, SIGNED_URL_TTL_SECONDS } from "./storage";
import type {
  PhotoKind,
  TripMethod,
  TripSlot,
  TripTravelMode,
} from "@/types/database";

export type TripSummary = {
  id: string;
  trip_date: string;
  slot: TripSlot;
  slot_position: number;
  total_straight_km: number;
  method: TripMethod;
  stop_count: number;
};

export type TripStopPhotoView = {
  id: string;
  storage_path: string;
  kind: PhotoKind;
  note: string | null;
  taken_at: string;
  /** Minted at read time; expires after SIGNED_URL_TTL_SECONDS. */
  signed_url: string | null;
};

export type TripStopView = {
  id: string;
  sort_order: number;
  company_id: string | null;
  display_name: string;
  address: string;
  lat: number;
  lng: number;
  leg_km: number | null;
  delivered_at: string | null;
  sample_taken: boolean;
  note: string | null;
  photos: TripStopPhotoView[];
  /** Read live from companies, so a mid-route call uses today's number. */
  contacts: { id: string; contact_name: string | null; phone: string | null }[];
  /**
   * The company as it is today, for the info sheet behind the stop's name.
   * Null when the company was deleted after the trip.
   */
  company: TripStopCompany | null;
};

export type TripStopCompany = {
  display_name: string;
  address: string;
  note: string | null;
  /** Signed, expires after SIGNED_URL_TTL_SECONDS. */
  gate_photo_url: string | null;
};

export type TripDetail = {
  id: string;
  trip_date: string;
  slot: TripSlot;
  slot_position: number;
  travel_mode: TripTravelMode;
  start_label: string;
  start_lat: number;
  start_lng: number;
  /** Null on trips saved after the end point was dropped from the form. */
  end_label: string | null;
  end_lat: number | null;
  end_lng: number | null;
  total_straight_km: number;
  method: TripMethod;
  note: string | null;
  stops: TripStopView[];
};

const TRIP_SELECT =
  "id, trip_date, slot, slot_position, travel_mode, start_label, start_lat, start_lng, end_label, end_lat, end_lng, total_straight_km, method, note, trip_stops(id, sort_order, company_id, display_name, address, lat, lng, leg_km, delivered_at, sample_taken, note, trip_stop_photos(id, storage_path, kind, note, taken_at))" as const;

/**
 * Every trip in a month, thin enough that tapping a day needs no extra fetch.
 *
 * Deliberately NOT ordered by slot: 'afternoon' sorts before 'morning'
 * alphabetically, which would put Chiều first. The screen groups by slot in
 * TypeScript instead.
 */
export async function listTripsForMonth(ym: YearMonth): Promise<TripSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { from, to } = monthRange(ym);

  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, trip_date, slot, slot_position, total_straight_km, method, trip_stops(id)",
    )
    .eq("user_id", user.id)
    .gte("trip_date", from)
    .lte("trip_date", to)
    .order("trip_date", { ascending: true })
    .order("slot_position", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const r = row as unknown as TripSummary & { trip_stops: { id: string }[] };
    return {
      id: r.id,
      trip_date: r.trip_date,
      slot: r.slot,
      slot_position: r.slot_position,
      total_straight_km: r.total_straight_km,
      method: r.method,
      stop_count: r.trip_stops?.length ?? 0,
    };
  });
}

export async function getTrip(id: string): Promise<TripDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trips")
    .select(TRIP_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  type RawStop = Omit<TripStopView, "photos" | "contacts" | "company"> & {
    trip_stop_photos: Omit<TripStopPhotoView, "signed_url">[];
  };
  const raw = data as unknown as Omit<TripDetail, "stops"> & {
    trip_stops: RawStop[];
  };

  const stops = [...(raw.trip_stops ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  // One signed-URL call for the whole trip, not one per photo.
  const paths = stops.flatMap((s) =>
    (s.trip_stop_photos ?? []).map((p) => p.storage_path),
  );
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    for (const u of urls ?? []) {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }
  }

  // Contacts, note and gate photo come from the live company row, not the
  // snapshot: a rider standing at the gate wants today's phone number and
  // today's gate code.
  const companyIds = [
    ...new Set(
      stops.map((s) => s.company_id).filter((v): v is string => Boolean(v)),
    ),
  ];
  const contactsByCompany = new Map<
    string,
    { id: string; contact_name: string | null; phone: string | null }[]
  >();
  const companyById = new Map<string, TripStopCompany>();
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("companies")
      .select(
        "id, display_name, address, note, gate_photo_path, company_contacts(id, contact_name, phone, sort_order)",
      )
      .in("id", companyIds);

    type RawCompany = {
      id: string;
      display_name: string;
      address: string;
      note: string | null;
      gate_photo_path: string | null;
      company_contacts: {
        id: string;
        contact_name: string | null;
        phone: string | null;
        sort_order: number;
      }[];
    };
    const rows = (companies ?? []) as unknown as RawCompany[];
    const gateUrls = await signGatePhotos(
      supabase,
      rows.map((c) => c.gate_photo_path),
    );

    for (const c of rows) {
      contactsByCompany.set(
        c.id,
        [...(c.company_contacts ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(({ id, contact_name, phone }) => ({ id, contact_name, phone })),
      );
      companyById.set(c.id, {
        display_name: c.display_name,
        address: c.address,
        note: c.note,
        gate_photo_url: c.gate_photo_path
          ? (gateUrls.get(c.gate_photo_path) ?? null)
          : null,
      });
    }
  }

  return {
    id: raw.id,
    trip_date: raw.trip_date,
    slot: raw.slot,
    slot_position: raw.slot_position,
    travel_mode: raw.travel_mode,
    start_label: raw.start_label,
    start_lat: raw.start_lat,
    start_lng: raw.start_lng,
    end_label: raw.end_label,
    end_lat: raw.end_lat,
    end_lng: raw.end_lng,
    total_straight_km: raw.total_straight_km,
    method: raw.method,
    note: raw.note,
    stops: stops.map((s) => ({
      id: s.id,
      sort_order: s.sort_order,
      company_id: s.company_id,
      display_name: s.display_name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      leg_km: s.leg_km,
      delivered_at: s.delivered_at,
      sample_taken: s.sample_taken,
      note: s.note,
      photos: [...(s.trip_stop_photos ?? [])]
        .sort((a, b) => a.taken_at.localeCompare(b.taken_at))
        .map((p) => ({ ...p, signed_url: signed.get(p.storage_path) ?? null })),
      contacts: s.company_id ? (contactsByCompany.get(s.company_id) ?? []) : [],
      company: s.company_id ? (companyById.get(s.company_id) ?? null) : null,
    })),
  };
}
