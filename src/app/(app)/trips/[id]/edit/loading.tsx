import { CardSkeleton, LoadingAnnounce, Skeleton } from "@/components/skeleton";
import { vi } from "@/lib/i18n/vi";

export default function Loading() {
  return (
    <div className="space-y-5 pb-28">
      <LoadingAnnounce label={vi.common.loading} />
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <CardSkeleton />
      <CardSkeleton />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  );
}
