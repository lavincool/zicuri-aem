import {
  ArrowLeft,
  Check,
  Gauge,
  Landmark,
  Minus,
  Satellite,
  Smartphone,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { RISK_FACTORS, RISK_WEIGHTS } from "@/features/insights/risk/model";
import { cn } from "@/lib/utils";
import { StreetSection } from "./street-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("info");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

const EVENTS = [
  { key: "drain2022", dateTime: "2022-05" },
  { key: "storm2024", dateTime: "2024-09" },
  { key: "francine2024", dateTime: "2024-09" },
  { key: "storm2025", dateTime: "2025-03" },
  { key: "front2026", dateTime: "2026-10-02" },
] as const;

const AUDIENCES = [
  { key: "residents", icon: Smartphone, href: "/" },
  { key: "operators", icon: Gauge, href: "/operador" },
  { key: "authorities", icon: Landmark, href: "/panel" },
] as const;

const IN_SCOPE = [
  "reports",
  "signals",
  "sensors",
  "panel",
  "operators",
  "ai",
  "pwa",
] as const;

const OUT_OF_SCOPE = [
  "alerts",
  "prediction",
  "hardware",
  "accounts",
  "area",
  "demo",
] as const;

const SPACE_SOURCES = ["imerg", "sentinel", "inegi", "smap"] as const;

const NEXT_STEPS = ["pilot", "alerts", "push", "accounts", "openData"] as const;

const textLink =
  "inline-flex min-h-11 items-center font-bold underline decoration-primary decoration-2 underline-offset-4 hover:decoration-foreground";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-5 py-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 lg:py-16">
      <h2 className="text-3xl leading-tight font-extrabold text-balance lg:sticky lg:top-8 lg:self-start">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

export default function InfoPage() {
  const t = useTranslations("info");
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] lg:px-8">
      <nav className="flex items-center justify-between py-3">
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href="/" />}
          className="h-11 gap-2 rounded-full px-3 text-base font-semibold"
        >
          <ArrowLeft className="size-5" />
          {t("back")}
        </Button>
        <Logo />
      </nav>

      <header className="grid items-center gap-8 pt-6 pb-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 lg:pt-14 lg:pb-10">
        <div className="space-y-5">
          <h1 className="text-[2.5rem] leading-[0.95] font-extrabold tracking-tighter text-balance sm:text-6xl">
            {t("title")}
          </h1>
          <p className="max-w-[60ch] text-lg leading-relaxed">{t("lede")}</p>
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            {t("context")}
          </p>
        </div>
        <StreetSection />
      </header>

      <Section title={t("why.title")}>
        <p className="max-w-[65ch] leading-relaxed">{t("why.body")}</p>
        <ol className="mt-8 space-y-6 border-l-2 border-border pl-6">
          {EVENTS.map(({ key, dateTime }, index) => (
            <li key={key} className="relative">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-1.5 -left-[31px] size-3 rounded-full ring-4 ring-background",
                  index === EVENTS.length - 1
                    ? "bg-primary"
                    : "bg-muted-foreground",
                )}
              />
              <time dateTime={dateTime} className="font-bold">
                {t(`why.events.${key}.date`)}
              </time>
              <p className="max-w-[60ch] text-muted-foreground">
                {t(`why.events.${key}.body`)}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t("audiences.title")}>
        <ul className="divide-y divide-border">
          {AUDIENCES.map(({ key, icon: Icon, href }) => (
            <li key={key} className="flex gap-4 py-6 first:pt-0 last:pb-0">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy text-primary dark:bg-primary dark:text-primary-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="space-y-1.5">
                <h3 className="text-xl font-extrabold">
                  {t(`audiences.${key}.name`)}
                </h3>
                <p className="max-w-[60ch] text-muted-foreground">
                  {t(`audiences.${key}.body`)}
                </p>
                <Link href={href} className={textLink}>
                  {t(`audiences.${key}.link`)}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("scope.title")}>
        <p className="max-w-[65ch] leading-relaxed">{t("scope.intro")}</p>
        <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-8">
          <div>
            <h3 className="border-t-4 border-success pt-3 text-lg font-extrabold">
              {t("scope.inTitle")}
            </h3>
            <ul className="mt-5 space-y-4">
              {IN_SCOPE.map((key) => (
                <li key={key} className="flex gap-3">
                  <Check
                    className="mt-0.5 size-5 shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-bold">{t(`scope.in.${key}.title`)}</p>
                    <p className="text-muted-foreground">
                      {t(`scope.in.${key}.body`)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="border-t-4 border-muted-foreground/50 pt-3 text-lg font-extrabold">
              {t("scope.outTitle")}
            </h3>
            <ul className="mt-5 space-y-4">
              {OUT_OF_SCOPE.map((key) => (
                <li key={key} className="flex gap-3">
                  <Minus
                    className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-bold">{t(`scope.out.${key}.title`)}</p>
                    <p className="text-muted-foreground">
                      {t(`scope.out.${key}.body`)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title={t("risk.title")}>
        <p className="max-w-[65ch] leading-relaxed">{t("risk.body")}</p>
        <figure className="mt-8 max-w-xl">
          <figcaption className="text-sm font-bold text-muted-foreground">
            {t("risk.caption")}
          </figcaption>
          <ul className="mt-4 space-y-4">
            {RISK_FACTORS.map((key) => (
              <li key={key}>
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2">
                    {key === "terrain" && (
                      <Satellite
                        className="size-4 shrink-0 self-center text-water"
                        aria-hidden="true"
                      />
                    )}
                    {t(`risk.factors.${key}`)}
                  </span>
                  <span className="font-bold tabular-nums">
                    {t("risk.weight", { weight: RISK_WEIGHTS[key] })}
                  </span>
                </div>
                <div aria-hidden="true" className="mt-1.5 h-2.5 bg-water/15">
                  <div
                    className="h-full rounded-r-[4px] bg-water"
                    style={{ width: `${RISK_WEIGHTS[key]}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </figure>
        <p className="mt-6 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          {t("risk.baseline")}
        </p>
      </Section>

      <Section title={t("space.title")}>
        <p className="max-w-[65ch] leading-relaxed">{t("space.body")}</p>
        <h3 className="mt-8 text-lg font-extrabold">{t("space.nextTitle")}</h3>
        <dl className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {SPACE_SOURCES.map((key) => (
            <div key={key}>
              <dt className="font-bold">{t(`space.next.${key}.name`)}</dt>
              <dd className="text-muted-foreground">
                {t(`space.next.${key}.body`)}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={t("next.title")}>
        <ul className="max-w-[65ch] list-disc space-y-3 pl-5 marker:text-primary">
          {NEXT_STEPS.map((key) => (
            <li key={key} className="pl-1 leading-relaxed">
              {t(`next.items.${key}`)}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("built.title")}>
        <p className="max-w-[65ch] leading-relaxed">{t("built.body")}</p>
        <p className="mt-4 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
          {t("built.stack")}
        </p>
      </Section>

      <footer className="flex flex-col gap-4 border-t border-border py-10 sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <nav className="flex flex-col sm:flex-row sm:gap-6">
          <Link href="/acerca" className={textLink}>
            {t("footer.about")}
          </Link>
          <Link href="/" className={textLink}>
            {t("footer.map")}
          </Link>
        </nav>
      </footer>
    </main>
  );
}
