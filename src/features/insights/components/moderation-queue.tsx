"use client";

import { ArrowUpRight, Eye, EyeOff, Flag } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ReportCategory, ReportStatus } from "@/config/categories";
import { cn } from "@/lib/utils";
import { setReportHiddenAction } from "../server/actions";

type Item = {
  id: string;
  category: ReportCategory;
  status: ReportStatus;
  flagCount: number;
  place: string | null;
  note: string | null;
  thumbUrl: string;
  createdAt: string;
};

export function ModerationQueue({
  items,
  readOnly,
}: {
  items: Item[];
  /** Demo viewers see the queue but cannot hide or restore reports. */
  readOnly: boolean;
}) {
  const t = useTranslations("panel");
  const tc = useTranslations("categories");
  const tr = useTranslations("report");
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <p className="rounded-3xl bg-card p-8 text-center text-muted-foreground">
        {t("moderation.empty")}
      </p>
    );
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {items.map((item) => {
        const hidden = item.status === "hidden";
        return (
          <li key={item.id} className="flex gap-4 rounded-3xl bg-card p-4">
            {/* biome-ignore lint/performance/noImgElement: report thumbnails come from storage. */}
            <img
              src={item.thumbUrl}
              alt=""
              className="size-24 shrink-0 rounded-2xl object-cover"
            />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-lg leading-tight font-semibold">
                    {tc(item.category)}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {item.place ?? tr("unknownPlace")} · {item.id}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-bold",
                    hidden
                      ? "bg-foreground text-background"
                      : "bg-success/12 text-success",
                  )}
                >
                  {hidden ? t("moderation.hidden") : t("moderation.visible")}
                </span>
              </div>
              <p className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-sm font-semibold">
                <Flag className="size-3.5" />
                {t("moderation.flags", { count: item.flagCount })}
              </p>
              {item.note ? (
                <p className="line-clamp-2 text-sm">{item.note}</p>
              ) : null}
              <div className="flex items-center gap-2">
                {readOnly ? null : (
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(() =>
                        setReportHiddenAction(item.id, !hidden),
                      )
                    }
                    className={cn(
                      "h-10 rounded-full px-4 font-semibold",
                      hidden &&
                        "border-transparent bg-foreground text-background hover:bg-foreground/85 hover:text-background dark:bg-foreground dark:hover:bg-foreground/85",
                    )}
                  >
                    {hidden ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                    {hidden ? t("moderation.restore") : t("moderation.hide")}
                  </Button>
                )}
                {!hidden ? (
                  <Link
                    href={`/r/${item.id}`}
                    aria-label={t("drains.view")}
                    title={t("drains.view")}
                    className="flex size-10 items-center justify-center rounded-full bg-muted transition-colors hover:bg-foreground/10"
                  >
                    <ArrowUpRight className="size-4" />
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
