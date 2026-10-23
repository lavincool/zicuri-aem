"use client";

import { ArrowUpRight, MapPinned } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { CATEGORY_COLORS } from "@/config/categories";
import { CategoryIcon } from "@/features/reports/components/category-icon";
import { cn } from "@/lib/utils";
import type { DrainItem } from "../server/panel-data";
import { LevelPill } from "./level-pill";
import { topReasons } from "./reasons";

const COLLAPSED_COUNT = 5;

/** Ranked "clear these drains" list; the selected card expands with its details. */
export function DrainList({
  drains,
  baseline,
  selectedId,
  now,
  onSelect,
  onShowOnMap,
  className,
}: {
  drains: DrainItem[];
  baseline: boolean;
  selectedId: string | null;
  now: Date;
  onSelect: (drain: DrainItem | null) => void;
  onShowOnMap: (drain: DrainItem) => void;
  className?: string;
}) {
  const t = useTranslations("panel.drains");
  const [showAll, setShowAll] = useState(false);
  const selectedIndex = drains.findIndex((d) => d.id === selectedId);
  const expanded = showAll || selectedIndex >= COLLAPSED_COUNT;
  const visible = expanded ? drains : drains.slice(0, COLLAPSED_COUNT);
  const items = useRef(new Map<string, HTMLLIElement>());
  const pickedHere = useRef(false);

  // Keep a pin picked on the map in view in the list; taps in the list stay put.
  useEffect(() => {
    if (pickedHere.current) {
      pickedHere.current = false;
      return;
    }
    if (!selectedId) return;
    items.current
      .get(selectedId)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  return (
    <section
      aria-labelledby="drains-title"
      className={cn("flex min-h-0 flex-col gap-3", className)}
    >
      <header className="flex items-end justify-between gap-3 px-1">
        <div className="space-y-1">
          <h2 id="drains-title" className="text-2xl font-semibold">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("body")}</p>
        </div>
        {drains.length > COLLAPSED_COUNT ? (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="shrink-0 border-b-2 border-foreground pb-0.5 text-sm font-semibold"
          >
            {expanded ? t("seeLess") : t("seeAll", { count: drains.length })}
          </button>
        ) : null}
      </header>

      {baseline ? (
        <p className="rounded-2xl bg-card/70 px-4 py-3 text-sm font-semibold">
          {t("baselineNote")}
        </p>
      ) : null}

      {drains.length === 0 ? (
        <p className="rounded-3xl bg-card p-6 text-center text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ol className="-mx-1 min-h-0 flex-1 space-y-2.5 overflow-y-auto px-1 pb-1">
          {visible.map((drain, index) => (
            <li
              key={drain.id}
              ref={(node) => {
                if (node) items.current.set(drain.id, node);
                else items.current.delete(drain.id);
              }}
            >
              <DrainCard
                drain={drain}
                rank={index + 1}
                selected={drain.id === selectedId}
                now={now}
                onToggle={() => {
                  pickedHere.current = true;
                  onSelect(drain.id === selectedId ? null : drain);
                }}
                onShowOnMap={() => onShowOnMap(drain)}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DrainCard({
  drain,
  rank,
  selected,
  now,
  onToggle,
  onShowOnMap,
}: {
  drain: DrainItem;
  rank: number;
  selected: boolean;
  now: Date;
  onToggle: () => void;
  onShowOnMap: () => void;
}) {
  const t = useTranslations("panel");
  const tc = useTranslations("categories");
  const tr = useTranslations("report");
  const format = useFormatter();
  const title = drain.address || drain.colonia || tr("unknownPlace");
  const detailsId = `drain-${drain.id}`;

  return (
    <article
      className={cn(
        "rounded-3xl transition-[background-color,box-shadow]",
        selected
          ? "bg-card shadow-[0_12px_32px_-12px_rgb(11_31_51/0.25)] ring-1 ring-foreground/5"
          : "bg-card/65 hover:bg-card dark:bg-card/55",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={selected}
        aria-controls={detailsId}
        className="flex w-full items-center gap-3 rounded-3xl p-4 text-left sm:px-5"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-lg leading-tight font-semibold">
            {title}
          </p>
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <span
              className="flex size-5 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: CATEGORY_COLORS[drain.category] }}
            >
              <CategoryIcon category={drain.category} className="size-3" />
            </span>
            <span className="truncate">
              {t("drains.rank", { rank })} · {tc(drain.category)}
            </span>
          </p>
        </div>
        {drain.cell ? (
          <LevelPill level={drain.cell.level} baseline={drain.cell.baseline} />
        ) : null}
      </button>

      {selected ? (
        <div id={detailsId} className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
          {drain.cell ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{t("drains.zoneRisk")}</span>
                <span className="font-semibold tabular-nums">
                  {drain.cell.score}/100
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{ width: `${drain.cell.score}%` }}
                />
              </div>
              <ul className="space-y-0.5 pt-1 text-sm text-muted-foreground">
                {topReasons(t, drain.cell.factors).map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div className="min-w-0 space-y-0.5">
              <dt className="text-muted-foreground">{t("drains.colonia")}</dt>
              <dd className="truncate font-semibold">{drain.colonia ?? "—"}</dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-muted-foreground">
                {t("drains.confirmationsLabel")}
              </dt>
              <dd className="font-semibold tabular-nums">
                {drain.stillThereCount}
              </dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-muted-foreground">{t("drains.reported")}</dt>
              <dd className="font-semibold">
                {format.relativeTime(new Date(drain.createdAt), now)}
              </dd>
            </div>
          </dl>

          <div className="flex items-center gap-3">
            {/* biome-ignore lint/performance/noImgElement: report thumbnails come from storage. */}
            <img
              src={drain.thumbUrl}
              alt=""
              className="size-12 shrink-0 rounded-full object-cover"
              style={{ backgroundColor: drain.photoColor ?? undefined }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{tc(drain.category)}</p>
              <p className="text-sm text-muted-foreground">
                {drain.severity
                  ? t("drains.severity", { severity: drain.severity })
                  : t("drains.confirmations", {
                      count: drain.stillThereCount,
                    })}
              </p>
            </div>
            <button
              type="button"
              onClick={onShowOnMap}
              aria-label={t("drains.showOnMap")}
              title={t("drains.showOnMap")}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted transition-colors hover:bg-foreground/10"
            >
              <MapPinned className="size-5" />
            </button>
            <Link
              href={`/r/${drain.id}`}
              aria-label={t("drains.view")}
              title={t("drains.view")}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted transition-colors hover:bg-foreground/10"
            >
              <ArrowUpRight className="size-5" />
            </Link>
          </div>
        </div>
      ) : null}
    </article>
  );
}
