import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default function PrivacyPage() {
  return <LegalPage doc="privacy" />;
}
