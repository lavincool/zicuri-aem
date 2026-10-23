import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/features/insights/components/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("panel.login");
  return { title: t("title"), robots: { index: false } };
}

export default function PanelLoginPage() {
  const t = useTranslations("panel.login");
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-3xl bg-card p-7 shadow-xl ring-1 ring-foreground/10">
        <Logo />
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("body")}</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
