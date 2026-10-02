import { Skeleton } from '@/components/ui';

export default function DashboardLoading() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-6 lg:px-10 lg:pt-10" aria-busy="true">
        <Skeleton className="h-3 w-40 rounded" />
        <Skeleton className="mt-3 h-10 w-72 rounded-lg" />
        <Skeleton className="mt-6 h-40 w-full rounded-2xl" />
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-52 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-36 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
