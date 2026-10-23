import { LogOut } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { logout } from "@/features/insights/server/actions";

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  const t = useTranslations("panel.nav");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/panel" aria-label={t("overview")}>
            <Logo />
          </Link>
          <nav className="flex flex-1 items-center gap-1">
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href="/panel" />}
              className="h-10 rounded-full px-4 font-semibold"
            >
              {t("overview")}
            </Button>
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href="/panel/moderacion" />}
              className="h-10 rounded-full px-4 font-semibold"
            >
              {t("moderation")}
            </Button>
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href="/" />}
              className="h-10 rounded-full px-4 font-semibold"
            >
              {t("map")}
            </Button>
          </nav>
          <form action={logout}>
            <Button
              variant="outline"
              type="submit"
              className="h-10 rounded-full px-4 font-semibold"
            >
              <LogOut className="size-4" />
              {t("logout")}
            </Button>
          </form>
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {children}
      </div>
    </div>
  );
}
