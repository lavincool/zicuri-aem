import type { Metadata } from "next";
import { after, connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelDashboard } from "@/features/insights/components/panel-dashboard";
import { getPanelData } from "@/features/insights/server/panel-data";
import {
  FORECAST_STALE_MS,
  refreshInsights,
} from "@/features/insights/server/refresh";
import {
  computeRiskScores,
  latestRunId,
} from "@/features/insights/server/risk";
import { env } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("panel");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default function PanelPage() {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <PanelContent />
    </Suspense>
  );
}

async function PanelContent() {
  await connection();
  const now = new Date();
  // First visit ever: score cells right away (no network); the forecast follows.
  if (!(await latestRunId())) await computeRiskScores(now);
  const data = await getPanelData(now);

  const fetchedAt = data.forecast.openMeteo?.fetchedAt.getTime() ?? 0;
  if (now.getTime() - fetchedAt > FORECAST_STALE_MS && !data.scenario) {
    after(() => refreshInsights());
  }
  return <PanelDashboard data={data} demoMode={env().DEMO_MODE} />;
}

function PanelSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-4 w-48 rounded-full bg-card" />
        <Skeleton className="h-10 w-2/3 rounded-xl bg-card" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        <Skeleton className="h-80 rounded-[1.75rem] bg-card" />
        <div className="grid grid-cols-2 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-3xl bg-card" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-[1.75rem] bg-card lg:col-span-2 2xl:col-span-1 2xl:h-80" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
        <div className="space-y-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-3xl bg-card" />
          ))}
        </div>
        <Skeleton className="h-[34rem] rounded-[2rem] bg-card lg:h-[46rem]" />
      </div>
    </div>
  );
}
