import { Skeleton } from '@/components/ui/skeleton';

export function ChartSkeleton() {
  return <Skeleton className="h-[300px] w-full rounded-lg" />;
}

export function TableSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return <Skeleton className="h-32 w-full rounded-lg" />;
}
