import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { RetryButton } from "./retry-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offlinePage");
  return { title: t("title"), robots: { index: false } };
}

export default function OfflinePage() {
  const t = useTranslations("offlinePage");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
      <Logo />
      <h1 className="text-3xl font-extrabold">{t("title")}</h1>
      <p className="max-w-sm text-muted-foreground">{t("body")}</p>
      <RetryButton label={t("retry")} />
    </main>
  );
}
