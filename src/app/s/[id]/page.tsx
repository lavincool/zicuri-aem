import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { aiEnabled } from "@/features/ai/server/suggest";
import { getDeviceSummary } from "@/features/devices/server/queries";
import { MapScreen } from "@/features/map/components/map-screen";
import { env } from "@/lib/env";

export async function generateMetadata({
  params,
}: PageProps<"/s/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [device, t] = await Promise.all([
    getDeviceSummary(id),
    getTranslations(),
  ]);
  if (!device) return { title: t("sensors.notFound") };
  const title = t("sensors.metaTitle", { name: device.name });
  const description = t("sensors.metaDescription");
  return { title, description, openGraph: { title, description } };
}

export default function SensorPage({ params }: PageProps<"/s/[id]">) {
  return (
    <main className="flex-1">
      <Suspense
        fallback={<div className="h-dvh w-full animate-pulse bg-muted" />}
      >
        <SensorDeepLink params={params} />
      </Suspense>
    </main>
  );
}

async function SensorDeepLink({
  params,
}: Pick<PageProps<"/s/[id]">, "params">) {
  const { id } = await params;
  const device = await getDeviceSummary(id);
  if (!device) notFound();
  return (
    <MapScreen
      demoMode={env().DEMO_MODE}
      aiEnabled={aiEnabled()}
      initialFocus={{
        kind: "sensor",
        id: device.id,
        center: [device.lng, device.lat],
      }}
    />
  );
}
