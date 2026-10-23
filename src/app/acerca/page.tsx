import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Gauge,
  Satellite,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

const STEPS = [
  { key: "report", icon: Camera },
  { key: "confirm", icon: CheckCircle2 },
  { key: "measure", icon: Gauge },
  { key: "anticipate", icon: Satellite },
] as const;

const CREDITS = [
  "osm",
  "geocoding",
  "places",
  "boundary",
  "weather",
  "elevation",
  "news",
] as const;

export default function AboutPage() {
  const t = useTranslations("about");
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-16">
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

      <header className="space-y-4 py-8">
        <p className="inline-flex rounded-full bg-navy px-3 py-1.5 text-sm font-semibold text-white">
          {t("hackathon")}
        </p>
        <h1 className="text-4xl leading-[1.05] font-extrabold sm:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="text-lg text-muted-foreground">{t("heroBody")}</p>
      </header>

      <section className="space-y-2 rounded-3xl bg-card p-6 ring-1 ring-foreground/10">
        <h2 className="text-2xl font-extrabold">{t("problemTitle")}</h2>
        <p className="text-base leading-relaxed">{t("problemBody")}</p>
      </section>

      <section className="space-y-4 py-10">
        <h2 className="text-2xl font-extrabold">{t("howTitle")}</h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {STEPS.map(({ key, icon: Icon }, index) => (
            <li
              key={key}
              className="space-y-2 rounded-2xl bg-card p-5 ring-1 ring-foreground/10"
            >
              <span className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Icon className="size-6" />
                </span>
                <span className="text-sm font-bold text-muted-foreground">
                  {index + 1}
                </span>
              </span>
              <h3 className="text-xl font-extrabold">
                {t(`how.${key}.title`)}
              </h3>
              <p className="text-muted-foreground">{t(`how.${key}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-2 py-4">
        <h2 className="text-2xl font-extrabold">{t("sensorsTitle")}</h2>
        <p className="text-base leading-relaxed">{t("sensorsBody")}</p>
      </section>

      <section className="space-y-3 py-4">
        <h2 className="text-2xl font-extrabold">{t("authoritiesTitle")}</h2>
        <p className="text-base leading-relaxed">{t("authoritiesBody")}</p>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/panel" />}
          className="h-11 rounded-full px-5 font-bold"
        >
          {t("authoritiesLink")}
        </Button>
      </section>

      <section className="space-y-2 py-4">
        <h2 className="flex items-center gap-2 text-2xl font-extrabold">
          <ShieldCheck className="size-6" />
          {t("privacyTitle")}
        </h2>
        <p className="text-base leading-relaxed">{t("privacyBody")}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 font-semibold">
          <Link href="/privacidad" className="underline underline-offset-4">
            {t("privacyLink")}
          </Link>
          <Link href="/terminos" className="underline underline-offset-4">
            {t("termsLink")}
          </Link>
        </p>
      </section>

      <section className="my-6 space-y-2 rounded-2xl border-2 border-dashed border-border p-5">
        <h2 className="text-xl font-extrabold">{t("demoTitle")}</h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          {t("demoBody")}
        </p>
      </section>

      <section className="space-y-3 py-4">
        <h2 className="text-2xl font-extrabold">{t("creditsTitle")}</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {CREDITS.map((key) => (
            <li key={key}>{t(`credits.${key}`)}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
