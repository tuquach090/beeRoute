import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reverseNominatim, searchNominatim } from "@/lib/geocoding/nominatim";

export const runtime = "nodejs";

/** Below this, results are noise and we would waste a rate-limited call. */
const MIN_QUERY_LENGTH = 4;

export async function GET(request: NextRequest) {
  // Signed-in only: this endpoint spends a shared rate limit, so it is not
  // something anonymous traffic should be able to burn through.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;

  // Reverse lookup: ?lat=&lng= instead of ?q=
  const latRaw = sp.get("lat");
  const lngRaw = sp.get("lng");
  if (latRaw !== null && lngRaw !== null) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: "Toạ độ không hợp lệ" },
        { status: 400 },
      );
    }
    try {
      const label = await reverseNominatim(lat, lng, request.signal);
      return NextResponse.json({ label });
    } catch (error) {
      if (request.signal.aborted) return NextResponse.json({ label: null });
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Không tra được địa chỉ",
        },
        { status: 502 },
      );
    }
  }

  const q = sp.get("q")?.trim() ?? "";

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchNominatim(q, request.signal);
    return NextResponse.json({ results });
  } catch (error) {
    if (request.signal.aborted) {
      // The user kept typing; the client already discarded this response.
      return NextResponse.json({ results: [] });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Không tìm được địa chỉ",
      },
      { status: 502 },
    );
  }
}
