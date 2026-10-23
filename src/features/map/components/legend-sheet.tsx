"use client";

import { useTranslations } from "next-intl";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { CATEGORY_COLORS, REPORT_CATEGORIES } from "@/config/categories";
import { CategoryIcon } from "@/features/reports/components/category-icon";

export function LegendSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-display text-2xl font-extrabold">
            {t("legend.title")}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {t("legend.title")}
          </DrawerDescription>
        </DrawerHeader>
        <div className="space-y-6 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <section>
            <h3 className="mb-3 text-sm font-bold tracking-wide text-muted-foreground uppercase">
              {t("legend.categories")}
            </h3>
            <ul className="grid gap-3">
              {REPORT_CATEGORIES.map((category) => (
                <li key={category} className="flex items-center gap-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-white ring-2 ring-card"
                    style={{ backgroundColor: CATEGORY_COLORS[category] }}
                  >
                    <CategoryIcon category={category} className="size-5" />
                  </span>
                  <span>
                    <span className="block text-base font-semibold">
                      {t(`categories.${category}`)}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {t(`categoryHelp.${category}`)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-bold tracking-wide text-muted-foreground uppercase">
              {t("legend.states")}
            </h3>
            <ul className="grid gap-3 text-base">
              <li className="flex items-center gap-3">
                <span className="size-6 shrink-0 rounded-full bg-cat-flooded-street ring-2 ring-card" />
                {t("legend.stateOpen")}
              </li>
              <li className="flex items-center gap-3">
                <span className="size-6 shrink-0 rounded-full bg-sensor-offline ring-2 ring-card" />
                {t("legend.stateResolved")}
              </li>
              <li className="flex items-center gap-3">
                <span className="size-6 shrink-0 rounded-full bg-cat-flooded-street opacity-40 ring-2 ring-card" />
                {t("legend.stateExpired")}
              </li>
            </ul>
          </section>

          <section className="space-y-1">
            <h3 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
              {t("legend.clusters")}
            </h3>
            <p className="flex items-center gap-3 text-base">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cat-blocked-drain text-sm font-bold text-white ring-2 ring-card">
                12
              </span>
              {t("legend.clustersBody")}
            </p>
          </section>

          <section className="space-y-1">
            <h3 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
              {t("legend.signals")}
            </h3>
            <p className="text-base">{t("legend.signalsBody")}</p>
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
