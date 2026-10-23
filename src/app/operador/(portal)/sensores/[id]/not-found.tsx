import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function SensorNotFound() {
  const t = useTranslations("operator.detail");
  return (
    <div className="space-y-4 rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
      <p className="text-lg font-semibold">{t("notFound")}</p>
      <Link
        href="/operador/sensores"
        className="inline-flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>
    </div>
  );
}
