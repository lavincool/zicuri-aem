import type { Metadata } from "next";
import { connection } from "next/server";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/features/insights/components/login-form";
import { env } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("panel.login");
  return { title: t("title"), robots: { index: false } };
}

export default function PanelLoginPage() {
  const t = useTranslations("panel.login");
  return (
    <main className="panel-surface flex flex-1 items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-sm space-y-6 rounded-[2rem] bg-card p-7 shadow-[0_24px_60px_-28px_rgb(11_31_51/0.35)] sm:p-8">
        <Logo />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("body")}</p>
        </div>
        <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
          <LoginFormWithFlags />
        </Suspense>
      </div>
    </main>
  );
}

/** DEMO_MODE is a runtime flag, so it is read at request time. */
async function LoginFormWithFlags() {
  await connection();
  return <LoginForm demoMode={env().DEMO_MODE} />;
}
