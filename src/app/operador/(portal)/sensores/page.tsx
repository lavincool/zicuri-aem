import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoRefresh } from "@/features/operators/components/auto-refresh";
import {
  FLEET_FILTERS,
  FleetList,
} from "@/features/operators/components/fleet-list";
import { getFleet } from "@/features/operators/server/fleet";
import { requireOperator } from "@/features/operators/server/session";

const filterSchema = z.enum(FLEET_FILTERS).catch("all");

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("operator.sensors");
  return { title: t("title") };
}

export default function SensorsPage({
  searchParams,
}: PageProps<"/operador/sensores">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <SensorsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SensorsContent({
  searchParams,
}: Pick<PageProps<"/operador/sensores">, "searchParams">) {
  await connection();
  const [operator, query] = await Promise.all([
    requireOperator(),
    searchParams,
  ]);
  const now = new Date();
  const fleet = await getFleet(operator.orgId, now);
  return (
    <>
      <FleetList
        fleet={fleet}
        filter={filterSchema.parse(query.estado)}
        orgName={operator.orgName}
        now={now}
      />
      <AutoRefresh />
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="h-10 w-full rounded-full" />
      <div className="grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
