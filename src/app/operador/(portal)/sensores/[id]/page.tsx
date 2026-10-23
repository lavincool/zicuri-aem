import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { OPERATOR_READING_RANGES } from "@/features/devices/schema";
import { AutoRefresh } from "@/features/operators/components/auto-refresh";
import { DeviceDetailView } from "@/features/operators/components/device-detail";
import { getFleetDeviceDetail } from "@/features/operators/server/fleet";
import { requireOperator } from "@/features/operators/server/session";

const rangeSchema = z.enum(OPERATOR_READING_RANGES).catch("24h");

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("operator.sensors");
  return { title: t("title") };
}

export default function SensorDetailPage({
  params,
  searchParams,
}: PageProps<"/operador/sensores/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <DetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function DetailContent({
  params,
  searchParams,
}: Pick<PageProps<"/operador/sensores/[id]">, "params" | "searchParams">) {
  await connection();
  const [operator, { id }, query] = await Promise.all([
    requireOperator(),
    params,
    searchParams,
  ]);
  const range = rangeSchema.parse(query.rango);
  const now = new Date();
  // Another organization's sensor is indistinguishable from a missing one.
  const detail = await getFleetDeviceDetail(operator.orgId, id, range, now);
  if (!detail) notFound();
  return (
    <>
      <DeviceDetailView
        detail={detail}
        range={range}
        operator={operator}
        now={now}
      />
      <AutoRefresh />
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-12 w-2/3" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}
