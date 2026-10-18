import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { vi } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: vi.authError.title };

export default async function AuthCodeErrorPage({
  searchParams,
}: PageProps<"/auth/auth-code-error">) {
  const { reason } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-5">
      <Logo size={48} />

      <div className="mt-8 w-full max-w-sm rounded-2xl border bg-card p-6 text-center">
        <AlertTriangle
          className="mx-auto size-8 text-destructive"
          aria-hidden
        />
        <h1 className="mt-3 text-lg font-semibold">{vi.authError.title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {vi.authError.body}
        </p>

        {typeof reason === "string" && reason && (
          <p className="mt-3 rounded-lg bg-muted p-3 text-left font-mono text-xs break-words">
            {reason}
          </p>
        )}

        <Button asChild className="mt-6 h-action w-full font-semibold">
          <Link href="/login">{vi.authError.retry}</Link>
        </Button>
      </div>
    </div>
  );
}
