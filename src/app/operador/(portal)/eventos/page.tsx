import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoRefresh } from "@/features/operators/components/auto-refresh";
import { EventsView } from "@/features/operators/components/events-view";
import { eventFiltersSchema } from "@/features/operators/schema";
import { getFleet, getFleetEvents } from "@/features/operators/server/fleet";
import { requireOperator } from "@/features/operators/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("operator.events");
  return { title: t("title") };
}

export default function EventsPage({
  searchParams,
}: PageProps<"/operador/eventos">) {
  return (
    <Suspense fallback={<EventsSkeleton />}>
      <EventsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function EventsContent({
  searchParams,
}: Pick<PageProps<"/operador/eventos">, "searchParams">) {
  await connection();
  const [operator, query] = await Promise.all([
    requireOperator(),
    searchParams,
  ]);
  const filters = eventFiltersSchema.parse(query);
  const now = new Date();
  const [fleet, events] = await Promise.all([
    getFleet(operator.orgId, now),
    getFleetEvents(
      operator.orgId,
      { deviceId: filters.sensor, level: filters.nivel },
      now,
    ),
  ]);
  return (
    <>
      <EventsView events={events} fleet={fleet} filters={filters} now={now} />
      <AutoRefresh intervalMs={60_000} />
    </>
  );
}

function EventsSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="h-24 rounded-2xl" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}
