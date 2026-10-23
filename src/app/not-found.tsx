import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
      <Logo />
      <h1 className="max-w-sm text-3xl font-extrabold">{t("title")}</h1>
      <p className="max-w-sm text-muted-foreground">{t("body")}</p>
      <Button
        nativeButton={false}
        render={<Link href="/" />}
        className="h-12 rounded-full px-6 text-base font-bold"
      >
        {t("back")}
      </Button>
    </main>
  );
}
