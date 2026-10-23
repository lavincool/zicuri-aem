import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MapScreen } from "@/features/map/components/map-screen";
import { getReportSummary } from "@/features/reports/server/queries";
import { env } from "@/lib/env";

export async function generateMetadata({
  params,
}: PageProps<"/r/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [summary, t] = await Promise.all([
    getReportSummary(id),
    getTranslations(),
  ]);
  if (!summary || summary.hidden) return { title: t("report.notFound") };
  const title = t("report.metaTitle", {
    category: t(`categories.${summary.category}`),
    place: summary.colonia ?? t("report.unknownPlace"),
  });
  const description = t("report.metaDescription");
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function ReportPage({ params }: PageProps<"/r/[id]">) {
  return (
    <main className="flex-1">
      <Suspense
        fallback={<div className="h-dvh w-full animate-pulse bg-muted" />}
      >
        <ReportDeepLink params={params} />
      </Suspense>
    </main>
  );
}

async function ReportDeepLink({
  params,
}: Pick<PageProps<"/r/[id]">, "params">) {
  const { id } = await params;
  const summary = await getReportSummary(id);
  if (!summary || summary.hidden) notFound();
  return (
    <MapScreen
      demoMode={env().DEMO_MODE}
      initialReport={{ id: summary.id, center: [summary.lng, summary.lat] }}
    />
  );
}
