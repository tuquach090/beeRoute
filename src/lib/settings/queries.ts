import "server-only";
import { createClient } from "@/lib/supabase/server";
import { NO_SETTINGS, type UserSettings } from "./types";

export type { DefaultStart, UserSettings } from "./types";

/**
 * Preferences live on the caller's own profile row, which RLS already limits
 * to them. A missing row is not an error — it just means nothing has been set
 * yet, and the route form keeps asking each time.
 */
export async function getSettings(): Promise<UserSettings> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NO_SETTINGS;

  const { data, error } = await supabase
    .from("profiles")
    .select("default_start_label, default_start_lat, default_start_lng")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return NO_SETTINGS;

  // The check constraint keeps these three in step, but a half-set row would
  // preselect a point with no coordinates, so re-check rather than assume.
  const { default_start_label, default_start_lat, default_start_lng } = data;
  if (
    default_start_label === null ||
    default_start_lat === null ||
    default_start_lng === null
  ) {
    return NO_SETTINGS;
  }

  return {
    defaultStart: {
      label: default_start_label,
      lat: default_start_lat,
      lng: default_start_lng,
    },
  };
}
