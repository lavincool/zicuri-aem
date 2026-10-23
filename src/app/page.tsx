import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function Home() {
  const t = useTranslations("common");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <Logo />
      <h1 className="max-w-sm text-4xl font-extrabold">{t("tagline")}</h1>
      <Button size="lg" className="h-14 rounded-full px-8 text-base font-bold">
        {t("report")}
      </Button>
    </main>
  );
}
