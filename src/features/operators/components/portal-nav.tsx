"use client";

import { Activity, Gauge, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/operador", key: "overview", icon: LayoutDashboard },
  { href: "/operador/sensores", key: "sensors", icon: Gauge },
  { href: "/operador/eventos", key: "events", icon: Activity },
] as const;
type Section = (typeof LINKS)[number]["href"];

/** The current path is runtime data, so the highlight streams in after the static shell. */
export function PortalNav() {
  return (
    <Suspense fallback={<NavLinks active={null} />}>
      <CurrentNav />
    </Suspense>
  );
}

function CurrentNav() {
  const pathname = usePathname();
  const active =
    LINKS.findLast(
      ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
    )?.href ?? null;
  return <NavLinks active={active} />;
}

function NavLinks({ active }: { active: Section | null }) {
  const t = useTranslations("operator.nav");
  return (
    <nav
      aria-label={t("label")}
      className="-mx-4 flex min-w-0 gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
    >
      {LINKS.map(({ href, key, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={active === href ? "page" : undefined}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 font-semibold transition-colors hover:bg-muted sm:px-4",
            active === href &&
              "bg-foreground text-background hover:bg-foreground",
          )}
        >
          <Icon className="size-4" />
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}
