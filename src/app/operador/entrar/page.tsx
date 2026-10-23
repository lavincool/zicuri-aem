import type { Metadata } from "next";
import { connection } from "next/server";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/features/operators/components/login-form";
import { env } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("operator.login");
  return { title: t("title"), robots: { index: false } };
}

export default function OperatorLoginPage() {
  const t = useTranslations("operator.login");
  return (
    <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm space-y-6 rounded-3xl bg-card p-6 shadow-xl ring-1 ring-foreground/10 sm:p-7">
        <Logo />
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("body")}</p>
        </div>
        <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
          <LoginFormWithFlags />
        </Suspense>
        <p className="text-xs text-muted-foreground">{t("inviteOnly")}</p>
      </div>
    </main>
  );
}

/** DEMO_MODE is a runtime flag, so it is read at request time. */
async function LoginFormWithFlags() {
  await connection();
  return <LoginForm demoMode={env().DEMO_MODE} />;
}
