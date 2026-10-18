"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleMark } from "@/components/google-mark";
import { createClient } from "@/lib/supabase/client";
import { vi } from "@/lib/i18n/vi";

export function GoogleSignInButton({ next }: { next?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);

    const callback = new URL("/auth/callback", window.location.origin);
    if (next) callback.searchParams.set("next", next);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });

    if (error) {
      // On success the browser has already navigated to Google, so reaching
      // here at all means the redirect never started.
      setError(error.message);
      setPending(false);
    }
  }

  return (
    <>
      <Button
        className="mt-6 h-action w-full gap-3 text-base font-semibold"
        variant="outline"
        onClick={signIn}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <GoogleMark className="size-5" />
        )}
        {pending ? vi.login.signingIn : vi.login.google}
      </Button>

      {error && (
        <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {vi.login.error} {error}
        </p>
      )}
    </>
  );
}
