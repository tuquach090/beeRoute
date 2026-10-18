import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Every path except Next internals and static assets. Icon files are
     * excluded so the favicon does not take a round trip through auth.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
