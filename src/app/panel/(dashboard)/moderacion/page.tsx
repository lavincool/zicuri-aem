import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ModerationQueue } from "@/features/insights/components/moderation-queue";
import { getModerationQueue } from "@/features/insights/server/panel-data";
import { currentPanelRole } from "@/features/insights/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("panel.moderation");
  return { title: t("title"), robots: { index: false } };
}

export default async function ModerationPage() {
  const t = await getTranslations("panel.moderation");
  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-3xl font-semibold sm:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("body")}</p>
      </header>
      <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
        <QueueContent />
      </Suspense>
    </div>
  );
}

async function QueueContent() {
  await connection();
  const [items, role] = await Promise.all([
    getModerationQueue(),
    currentPanelRole(),
  ]);
  return <ModerationQueue items={items} readOnly={role !== "admin"} />;
}
