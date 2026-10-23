"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId } from "react";
import type { ReadingRange, ReadingSeries } from "../schema";

const RANGE_MS: Record<ReadingRange, number> = {
  "1h": 3_600_000,
  "24h": 24 * 3_600_000,
  "7d": 7 * 24 * 3_600_000,
};
const TICKS: Record<ReadingRange, number> = {
  "1h": 15 * 60_000,
  "24h": 6 * 3_600_000,
  "7d": 24 * 3_600_000,
};

const WIDTH = 320;
const HEIGHT = 168;
const PAD = { top: 10, right: 8, bottom: 22, left: 30 };

/** Water level over time with warning/critical bands (plain SVG, no chart library). */
export function LevelChart({
  series,
  now,
}: {
  series: ReadingSeries;
  now: number;
}) {
  const t = useTranslations("sensors");
  const format = useFormatter();
  const gradientId = useId();
  const { points, thresholds, range } = series;

  if (points.length === 0) {
    return (
      <p className="flex h-40 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
        {t("chartEmpty")}
      </p>
    );
  }

  const start = now - RANGE_MS[range];
  const max = Math.max(...points.map((p) => p.level));
  const yMax = Math.max(thresholds.criticalCm * 1.2, max * 1.1, 1);
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (time: number) =>
    PAD.left + ((time - start) / (now - start)) * innerW;
  const y = (level: number) =>
    PAD.top + innerH - (Math.max(0, level) / yMax) * innerH;

  const line = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)} ${y(p.level).toFixed(1)}`,
    )
    .join(" ");
  const first = points[0];
  const last = points.at(-1);
  const area =
    first && last
      ? `${line} L${x(last.t).toFixed(1)} ${y(0)} L${x(first.t).toFixed(1)} ${y(0)} Z`
      : "";

  const ticks: number[] = [];
  const step = TICKS[range];
  for (let tick = Math.ceil(start / step) * step; tick <= now; tick += step) {
    ticks.push(tick);
  }
  const tickLabel = (time: number) =>
    range === "7d"
      ? format.dateTime(new Date(time), { weekday: "short" })
      : format.dateTime(new Date(time), { hour: "2-digit", minute: "2-digit" });

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full"
      role="img"
      aria-label={t("chartLabel", {
        range: t(`ranges.${range}`),
        max: max.toFixed(1),
      })}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--water)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--water)" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Bands above the thresholds. */}
      <rect
        x={PAD.left}
        y={y(yMax)}
        width={innerW}
        height={y(thresholds.criticalCm) - y(yMax)}
        fill="var(--sensor-critical)"
        opacity="0.08"
      />
      <rect
        x={PAD.left}
        y={y(thresholds.criticalCm)}
        width={innerW}
        height={y(thresholds.warningCm) - y(thresholds.criticalCm)}
        fill="var(--sensor-warning)"
        opacity="0.1"
      />

      {[0, thresholds.warningCm, thresholds.criticalCm].map((level) => (
        <text
          key={level}
          x={PAD.left - 4}
          y={y(level) + 3}
          textAnchor="end"
          className="fill-muted-foreground text-[9px]"
        >
          {level}
        </text>
      ))}
      <line
        x1={PAD.left}
        x2={WIDTH - PAD.right}
        y1={y(thresholds.warningCm)}
        y2={y(thresholds.warningCm)}
        stroke="var(--sensor-warning)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <line
        x1={PAD.left}
        x2={WIDTH - PAD.right}
        y1={y(thresholds.criticalCm)}
        y2={y(thresholds.criticalCm)}
        stroke="var(--sensor-critical)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />

      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--water)"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last ? (
        <circle cx={x(last.t)} cy={y(last.level)} r="3.5" fill="var(--water)" />
      ) : null}

      <line
        x1={PAD.left}
        x2={WIDTH - PAD.right}
        y1={y(0)}
        y2={y(0)}
        className="stroke-border"
      />
      {ticks.map((tick) => (
        <text
          key={tick}
          x={x(tick)}
          y={HEIGHT - 6}
          textAnchor="middle"
          className="fill-muted-foreground text-[9px]"
        >
          {tickLabel(tick)}
        </text>
      ))}
    </svg>
  );
}
