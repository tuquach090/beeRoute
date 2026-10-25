import { LoadingAnnounce, Skeleton } from "@/components/skeleton";
import { vi } from "@/lib/i18n/vi";

export default function Loading() {
  return (
    <div className="space-y-5 pb-24">
      <LoadingAnnounce label={vi.common.loading} />
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}
