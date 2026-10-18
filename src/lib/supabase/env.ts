/**
 * Both variables are NEXT_PUBLIC_, so Next inlines them at build time. They
 * must be read as full literals — `process.env[name]` would not be replaced.
 */
export function requireSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Chép .env.example thành .env.local và điền giá trị từ Supabase Dashboard " +
        "(Project Settings → API).",
    );
  }

  return { url, anonKey };
}

/** True when the app has been pointed at a Supabase project. */
export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
