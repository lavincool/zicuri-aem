import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { useMessages, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";

type LegalDocument = "privacy" | "terms";

const OTHER: Record<LegalDocument, { doc: LegalDocument; href: string }> = {
  privacy: { doc: "terms", href: "/terminos" },
  terms: { doc: "privacy", href: "/privacidad" },
};

/** Shared layout for the privacy notice and the terms of use. */
export function LegalPage({ doc }: { doc: LegalDocument }) {
  const t = useTranslations("legal");
  const { sections } = useMessages().legal[doc];
  const other = OTHER[doc];

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

      <header className="space-y-3 py-8">
        <h1 className="text-4xl leading-[1.05] font-extrabold sm:text-5xl">
          {t(`${doc}.title`)}
        </h1>
        <p className="text-sm font-semibold text-muted-foreground">
          {t("updated")}
        </p>
        <p className="text-lg">{t(`${doc}.intro`)}</p>
        <Suspense fallback={null}>
          <Contact />
        </Suspense>
      </header>

      <div className="space-y-8">
        {Object.entries(sections).map(
          ([key, section]: [string, { title: string; body: string[] }]) => (
            <section key={key} className="space-y-2">
              <h2 className="text-2xl font-extrabold">{section.title}</h2>
              {section.body.length > 1 ? (
                <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed">
                  {section.body.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-base leading-relaxed">{section.body[0]}</p>
              )}
            </section>
          ),
        )}
      </div>

      <p className="mt-12 text-sm text-muted-foreground">
        {t("seeAlso")}:{" "}
        <Link
          href={other.href}
          className="font-semibold text-foreground underline underline-offset-4"
        >
          {t(`${other.doc}.title`)}
        </Link>
      </p>
    </main>
  );
}

/** CONTACT_EMAIL is a runtime setting, so it is read at request time. */
async function Contact() {
  await connection();
  const email = env().CONTACT_EMAIL;
  if (!email) return null;
  const t = await getTranslations("legal");
  return (
    <p className="text-base font-semibold">
      {t.rich("contact", {
        email: () => (
          <a href={`mailto:${email}`} className="underline underline-offset-4">
            {email}
          </a>
        ),
      })}
    </p>
  );
}
