import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function TableCardSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card className="overflow-hidden shadow-sm max-w-5xl mx-auto">
      <div className="grid grid-cols-3 gap-4 px-5 py-3 border-b border-border bg-muted/30">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-24 justify-self-end" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="grid grid-cols-3 gap-4 px-5 py-3 items-center">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <div className="flex justify-end gap-2">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border bg-muted/20 px-5 py-3">
        <Skeleton className="h-6 w-56" />
      </div>
    </Card>
  );
}

export function TwoPaneSkeleton() {
  return (
    <div className="flex w-full justify-center gap-4">
      <Card className="p-2 h-fit shadow-sm max-w-sm w-[280px]">
        <Skeleton className="h-4 w-28 mx-3 my-2" />
        <div className="space-y-2 px-2 pb-2">
          {Array.from({ length: 8 }).map((_, idx) => (
            <Skeleton key={idx} className="h-8 w-full" />
          ))}
        </div>
      </Card>
      <Card className="overflow-hidden shadow-sm h-fit w-[760px]">
        <div className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-border bg-muted/30">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20 justify-self-end" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx} className="grid grid-cols-4 gap-4 px-5 py-3 items-center">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <div className="flex justify-end gap-2">
                <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-7 w-7 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
