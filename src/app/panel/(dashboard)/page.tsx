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
      <Skeleton className="h-10 w-2/3" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
