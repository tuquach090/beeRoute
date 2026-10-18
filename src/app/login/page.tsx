import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { vi } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: vi.login.title };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Set by the middleware when it bounced an unauthenticated request.
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 pb-16">
        <div className="flex flex-col items-center text-center">
          <Logo size={64} />
          <p className="mt-3 text-base text-muted-foreground">
            {vi.app.tagline}
          </p>
        </div>

        <div className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-card-foreground">
            {vi.login.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {vi.login.subtitle}
          </p>

          <Suspense>
            <GoogleSignInButton next={nextPath} />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {vi.login.note}
        </p>
      </main>
    </div>
  );
}
