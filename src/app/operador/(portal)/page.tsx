import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoRefresh } from "@/features/operators/components/auto-refresh";
import { FleetOverviewView } from "@/features/operators/components/fleet-overview";
import { getFleetOverview } from "@/features/operators/server/fleet";
import { requireOperator } from "@/features/operators/server/session";

export default function OperatorOverviewPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewContent />
    </Suspense>
  );
}

async function OverviewContent() {
  await connection();
  const operator = await requireOperator();
  const now = new Date();
  const data = await getFleetOverview(operator.orgId, now);
  return (
    <>
      <FleetOverviewView data={data} orgName={operator.orgName} now={now} />
      <AutoRefresh />
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-10 w-2/3" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
