import { CardSkeleton, LoadingAnnounce, Skeleton } from "@/components/skeleton";
import { vi } from "@/lib/i18n/vi";

export default function Loading() {
  return (
    <div className="space-y-5 pb-24">
      <LoadingAnnounce label={vi.common.loading} />
      <Skeleton className="h-10 w-48" />
      <CardSkeleton />
      <CardSkeleton />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}
