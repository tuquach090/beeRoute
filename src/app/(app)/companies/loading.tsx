import { CardSkeleton, LoadingAnnounce, Skeleton } from "@/components/skeleton";
import { vi } from "@/lib/i18n/vi";

export default function Loading() {
  return (
    <div className="space-y-5 pb-24">
      <LoadingAnnounce label={vi.common.loading} />
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="space-y-2">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
