"use client";

import { Eye, EyeOff, Flag } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ReportCategory, ReportStatus } from "@/config/categories";
import { setReportHiddenAction } from "../server/actions";

type Item = {
  id: string;
  category: ReportCategory;
  status: ReportStatus;
  flagCount: number;
  colonia: string | null;
  note: string | null;
  thumbUrl: string;
  createdAt: string;
};

export function ModerationQueue({ items }: { items: Item[] }) {
  const t = useTranslations("panel.moderation");
  const tc = useTranslations("categories");
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <p className="rounded-2xl bg-card p-8 text-center text-muted-foreground ring-1 ring-foreground/10">
        {t("empty")}
      </p>
    );
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((item) => {
        const hidden = item.status === "hidden";
        return (
          <li
            key={item.id}
            className="flex gap-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/10"
          >
            {/* biome-ignore lint/performance/noImgElement: report thumbnails come from storage. */}
            <img
              src={item.thumbUrl}
              alt=""
              className="size-24 shrink-0 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="font-bold">{tc(item.category)}</p>
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Flag className="size-3.5" />
                  {t("flags", { count: item.flagCount })}
                </span>
                <span>· {hidden ? t("hidden") : t("visible")}</span>
                {item.colonia ? <span>· {item.colonia}</span> : null}
              </p>
              {item.note ? (
                <p className="line-clamp-2 text-sm">{item.note}</p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={hidden ? "default" : "outline"}
                  disabled={pending}
                  onClick={() =>
                    startTransition(() =>
                      setReportHiddenAction(item.id, !hidden),
                    )
                  }
                  className="h-9 rounded-full px-3 font-semibold"
                >
                  {hidden ? (
                    <Eye className="size-4" />
                  ) : (
                    <EyeOff className="size-4" />
                  )}
                  {hidden ? t("restore") : t("hide")}
                </Button>
                {!hidden ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    nativeButton={false}
                    render={<Link href={`/r/${item.id}`} />}
                    className="h-9 rounded-full px-3"
                  >
                    {item.id}
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
