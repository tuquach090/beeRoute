import {
  FieldSkeleton,
  LoadingAnnounce,
  Skeleton,
} from "@/components/skeleton";
import { vi } from "@/lib/i18n/vi";

export default function Loading() {
  return (
    <div className="space-y-6 pb-28">
      <LoadingAnnounce label={vi.common.loading} />
      <Skeleton className="h-8 w-44" />
      <FieldSkeleton />
      <FieldSkeleton />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
      <FieldSkeleton />
    </div>
  );
}
