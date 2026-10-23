import { LogOut } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo, LogoMark } from "@/components/brand/logo";
import {
  PanelNav,
  RailTooltip,
  railItem,
} from "@/features/insights/components/panel-nav";
import { logout } from "@/features/insights/server/actions";

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  const t = useTranslations("panel.nav");
  return (
    <div className="panel-surface flex min-h-dvh flex-col bg-background text-foreground">
      {/* A top bar on phones; a fixed icon rail on wide screens. */}
      <aside className="sticky top-0 z-30 flex items-center gap-2 bg-background/90 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur lg:fixed lg:inset-y-0 lg:left-0 lg:w-22 lg:flex-col lg:gap-10 lg:bg-transparent lg:px-0 lg:py-6 lg:backdrop-blur-none">
        <Link
          href="/panel"
          aria-label={t("overview")}
          className="mr-auto rounded-full lg:mr-0"
        >
          <Logo className="lg:hidden" />
          <span className="hidden size-12 items-center justify-center rounded-full bg-card shadow-xs lg:flex">
            <LogoMark className="size-7" />
          </span>
        </Link>
        <PanelNav />
        <form action={logout} className="lg:mt-auto">
          <button type="submit" aria-label={t("logout")} className={railItem}>
            <LogOut className="size-5" strokeWidth={1.75} />
            <RailTooltip>{t("logout")}</RailTooltip>
          </button>
        </form>
      </aside>
      <main className="mx-auto w-full max-w-[110rem] flex-1 px-4 pt-2 pb-8 sm:px-6 lg:py-8 lg:pr-8 lg:pl-28">
        {children}
      </main>
    </div>
  );
}
