export default function Loading() {
  return (
    <div className="space-y-5" aria-busy>
      <div className="bg-muted h-8 w-40 animate-pulse rounded-lg" />
      <div className="bg-muted h-4 w-64 animate-pulse rounded" />
      <div className="bg-muted h-36 animate-pulse rounded-xl" />
      <div className="bg-muted h-11 animate-pulse rounded-lg" />
    </div>
  );
}
