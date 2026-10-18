import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchNominatim } from "@/lib/geocoding/nominatim";

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
