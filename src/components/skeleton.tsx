import { cn } from "@/lib/utils";

/**
 * Placeholder block. Pages are server-rendered per user, so a navigation is
 * always a round trip — without these the screen sits on the old page and a
 * tap looks like it did nothing.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-muted animate-pulse rounded-md", className)}
      aria-hidden
    />
  );
}

/** A card the shape of one company row. */
export function CardSkeleton() {
  return (
    <div className="bg-card space-y-2 rounded-xl border p-4">
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-1/4" />
    </div>
  );
}

/** A labelled form field. */
export function FieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

/**
 * Screen-reader announcement for the skeletons above, which are aria-hidden.
 * Without it the page change is silent to assistive tech.
 */
export function LoadingAnnounce({ label }: { label: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {label}
    </span>
  );
}
