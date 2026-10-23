import type { Metadata } from "next";
import { connection } from "next/server";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DeadLink,
  TokenForm,
} from "@/features/operators/components/token-form";
import { inspectLoginToken } from "@/features/operators/server/magic-link";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("operator.link");
  // Keep the token out of referrers sent by anything this page loads.
  return {
    title: t("title"),
    robots: { index: false },
    referrer: "no-referrer",
  };
}

export default function MagicLinkPage({
  params,
}: PageProps<"/operador/entrar/[token]">) {
  const t = useTranslations("operator.link");
  return (
    <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm space-y-6 rounded-3xl bg-card p-6 shadow-xl ring-1 ring-foreground/10 sm:p-7">
        <Logo />
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("body")}</p>
        </div>
        <Suspense fallback={<Skeleton className="h-12 rounded-xl" />}>
          <LinkState params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function LinkState({
  params,
}: Pick<PageProps<"/operador/entrar/[token]">, "params">) {
  await connection();
  const { token } = await params;
  const [state, t] = await Promise.all([
    inspectLoginToken(token),
    getTranslations("operator.link"),
  ]);
  if (state === "valid") return <TokenForm token={token} />;
  return <DeadLink message={t(state)} />;
}
