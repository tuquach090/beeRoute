import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Google sends the user back here with ?code=. Exchange it for a session, which
 * writes the auth cookies, then send them on to wherever they were headed.
 *
 * When anything fails, forward the provider's own error text to the error page.
 * Swallowing it leaves nothing to debug but "it didn't work".
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Only allow same-origin paths, so a crafted link cannot bounce the user off
  // to another site carrying a fresh session.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  function fail(reason: string) {
    const url = new URL("/auth/auth-code-error", origin);
    url.searchParams.set("reason", reason);
    return NextResponse.redirect(url);
  }

  // Supabase/Google report refusals as query params, not as a missing code.
  const providerError =
    searchParams.get("error_description") ??
    searchParams.get("error_code") ??
    searchParams.get("error");
  if (providerError) {
    return fail(providerError);
  }

  if (!code) {
    // Reaching here means the redirect carried neither a code nor an error.
    // Listing what did arrive is the fastest way to see what sent us here.
    const got = [...searchParams.keys()];
    return fail(
      got.length
        ? `Callback không có "code". Tham số nhận được: ${got.join(", ")}`
        : 'Callback không có tham số nào. Kiểm tra "Redirect URLs" trong Supabase → Authentication → URL Configuration.',
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return fail(error.message);
  }

  // Behind a proxy (Vercel) the public host is in x-forwarded-host, while
  // `origin` is the internal one.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const base = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;

  return NextResponse.redirect(`${base}${safeNext}`);
}
