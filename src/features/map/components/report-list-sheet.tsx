"use client";

import { useFormatter, useTranslations } from "next-intl";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { CATEGORY_COLORS } from "@/config/categories";
import { CategoryIcon } from "@/features/reports/components/category-icon";
import type { ReportFeature } from "@/features/reports/schema";
import { useLiveNow } from "@/hooks/use-live-now";

const MAX_ITEMS = 50;

/** Non-visual alternative to the map: the reports in view as a list. */
export function ReportListSheet({
  open,
  onOpenChange,
  reports,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reports: ReportFeature[];
  onSelect: (report: ReportFeature) => void;
}) {
  const t = useTranslations();
  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="md:mx-auto md:max-w-lg">
        <DrawerHeader>
          <DrawerTitle className="font-display text-2xl font-extrabold">
            {t("list.title")}
          </DrawerTitle>
          <DrawerDescription>{t("list.description")}</DrawerDescription>
        </DrawerHeader>
        {open ? <ListBody reports={reports} onSelect={onSelect} /> : null}
      </DrawerContent>
    </Drawer>
  );
}

function ListBody({
  reports,
  onSelect,
}: {
  reports: ReportFeature[];
  onSelect: (report: ReportFeature) => void;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const now = useLiveNow(60_000);
  const sorted = [...reports]
    .filter((r) => !r.properties.p)
    .sort((a, b) => b.properties.t - a.properties.t);
  const shown = sorted.slice(0, MAX_ITEMS);

  if (sorted.length === 0) {
    return (
      <p className="px-4 pb-8 text-center text-muted-foreground">
        {t("list.empty")}
      </p>
    );
  }

  return (
    <div className="overflow-y-auto px-2 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
      <ul className="divide-y">
        {shown.map((report) => (
          <li key={report.properties.id}>
            <button
              type="button"
              onClick={() => onSelect(report)}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-muted"
            >
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
                style={{
                  backgroundColor: CATEGORY_COLORS[report.properties.c],
                }}
              >
                <CategoryIcon
                  category={report.properties.c}
                  className="size-5"
                />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">
                  {t(`categories.${report.properties.c}`)}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {t(`statuses.${report.properties.s}`)} ·{" "}
                  {format.relativeTime(new Date(report.properties.t), now)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {sorted.length > shown.length ? (
        <p className="px-2 pt-3 text-sm text-muted-foreground">
          {t("list.more", { shown: shown.length, total: sorted.length })}
        </p>
      ) : null}
    </div>
  );
}
