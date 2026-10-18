import { CardSkeleton, LoadingAnnounce, Skeleton } from "@/components/skeleton";
import { vi } from "@/lib/i18n/vi";

export default function Loading() {
  return (
    <div className="space-y-5 pb-28">
      <LoadingAnnounce label={vi.common.loading} />
      <Skeleton className="h-8 w-40" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </div>
  );
}
