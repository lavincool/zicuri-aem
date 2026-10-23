import { Map as MapIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountChip } from "@/features/operators/components/account-chip";
import { PortalNav } from "@/features/operators/components/portal-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("operator");
  return {
    title: { default: t("metaTitle"), template: `%s · ${t("metaTitle")}` },
    robots: { index: false },
  };
}

export default function OperatorLayout({ children }: LayoutProps<"/operador">) {
  const t = useTranslations("operator.nav");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        {/* One row on wide screens; on phones the nav wraps under logo and account. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
          <Link href="/operador" aria-label={t("overview")}>
            <Logo />
          </Link>
          <div className="order-3 flex min-w-0 basis-full items-center justify-between gap-2 sm:order-none sm:flex-1 sm:basis-auto">
            <PortalNav />
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-muted lg:inline-flex"
            >
              <MapIcon className="size-4" />
              {t("map")}
            </Link>
          </div>
          <div className="flex min-w-0 flex-1 basis-0 justify-end sm:flex-none sm:basis-auto">
            <Suspense
              fallback={<Skeleton className="h-10 w-40 rounded-full" />}
            >
              <AccountChip />
            </Suspense>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:py-6">
        {children}
      </div>
    </div>
  );
}
