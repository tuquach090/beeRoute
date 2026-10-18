"use client";

import { useLinkStatus } from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";

/**
 * Trailing affordance for a list row, which turns into a spinner while that
 * row's navigation is pending. Must live inside the <Link> it reports on.
 */
export function RowChevron() {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2
      className="text-primary size-5 shrink-0 animate-spin"
      aria-hidden
    />
  ) : (
    <ChevronRight
      className="text-muted-foreground size-5 shrink-0"
      aria-hidden
    />
  );
}
