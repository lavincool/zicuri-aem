"use client";

import { LayoutDashboard, Map as MapIcon, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/panel", key: "overview", icon: LayoutDashboard },
  { href: "/panel/moderacion", key: "moderation", icon: ShieldCheck },
  { href: "/", key: "map", icon: MapIcon },
] as const;
type Section = (typeof LINKS)[number]["href"];

/** Round icon item of the panel rail; the label shows as a tooltip on wide screens. */
export const railItem =
  "group/rail relative flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-card lg:size-12";

export function RailTooltip({ children }: { children: string }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-full z-50 ml-3 hidden -translate-y-1/2 rounded-lg bg-foreground px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-background opacity-0 shadow-lg transition-opacity group-hover/rail:opacity-100 group-focus-visible/rail:opacity-100 lg:block"
    >
      {children}
    </span>
  );
}

/** The current path is runtime data, so the highlight streams in after the static shell. */
export function PanelNav() {
  return (
    <Suspense fallback={<RailLinks active={null} />}>
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
  return <RailLinks active={active} />;
}

function RailLinks({ active }: { active: Section | null }) {
  const t = useTranslations("panel.nav");
  return (
    <nav aria-label={t("label")} className="flex gap-1.5 lg:flex-col lg:gap-3">
      {LINKS.map(({ href, key, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-label={t(key)}
          aria-current={active === href ? "page" : undefined}
          className={cn(
            railItem,
            active === href &&
              "bg-primary text-primary-foreground hover:bg-primary",
          )}
        >
          <Icon className="size-5" strokeWidth={1.75} />
          <RailTooltip>{t(key)}</RailTooltip>
        </Link>
      ))}
    </nav>
  );
}
