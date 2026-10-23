import { useId } from "react";
import { cn } from "@/lib/utils";

const round = (n: number) => Math.round(n * 10) / 10;

/** Points along the gauge arc: an ellipse segment that rises from the left and crests near the end. */
function arcPoints(from: number, to: number, steps = 40) {
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps;
    const angle = Math.PI - t * Math.PI * 0.65;
    points.push([
      round(170 + 170 * Math.cos(angle)),
      round(96 - 58 * Math.sin(angle)),
    ]);
  }
  return points;
}

const toPath = (points: [number, number][]) =>
  points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");

/** Arc gauge: solid up to `value` (0–1) with a hatched area beneath, dotted after. */
export function ArcGauge({
  value,
  color,
  className,
}: {
  value: number;
  color: string;
  className?: string;
}) {
  const id = useId();
  const clamped = Math.min(1, Math.max(0, value));
  const filled = arcPoints(0, clamped);
  const rest = arcPoints(clamped, 1, 24);
  const [endX, endY] = filled.at(-1) ?? [0, 96];
  return (
    <svg
      viewBox="0 0 248 100"
      className={cn("w-full overflow-visible", className)}
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={`${id}-hatch`}
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="7" stroke={color} strokeWidth="1.6" />
        </pattern>
      </defs>
      <path
        d={toPath(rest)}
        fill="none"
        stroke={color}
        strokeOpacity="0.4"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="0 11"
      />
      {clamped > 0 ? (
        <>
          <path
            d={`${toPath(filled)} L${endX} 100 L0 100 Z`}
            fill={`url(#${id}-hatch)`}
            opacity="0.3"
          />
          <path
            d={toPath(filled)}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line
            x1={endX}
            y1={endY}
            x2={endX}
            y2="100"
            stroke={color}
            strokeWidth="2"
          />
        </>
      ) : null}
      <circle cx={endX} cy={endY} r="5.5" fill={color} />
    </svg>
  );
}

/** Daily bars, oldest first; the last (today) is drawn in full ink. */
export function SparkBars({
  values,
  label,
  className,
}: {
  values: number[];
  label: string;
  className?: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "flex h-12 shrink-0 items-end gap-[2px] sm:gap-[3px]",
        className,
      )}
    >
      {values.map((value, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: one bar per fixed day slot.
          key={index}
          className={cn(
            "w-[3px] rounded-full sm:w-[5px]",
            index === values.length - 1
              ? "bg-foreground"
              : "bg-muted-foreground/25",
          )}
          style={{ height: `${Math.max(10, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/** Smoothed daily line, oldest first. */
export function SparkLine({
  values,
  label,
  className,
}: {
  values: number[];
  label: string;
  className?: string;
}) {
  const max = Math.max(1, ...values);
  const step = 120 / Math.max(1, values.length - 1);
  const points = values.map((value, i): [number, number] => [
    round(i * step),
    round(44 - (value / max) * 38),
  ]);
  let d = "";
  points.forEach(([x, y], i) => {
    if (i === 0) d = `M${x} ${y}`;
    else {
      const [px, py] = points[i - 1] ?? [x, y];
      const mx = round((px + x) / 2);
      d += ` C${mx} ${py} ${mx} ${y} ${x} ${y}`;
    }
  });
  return (
    <svg
      viewBox="0 0 120 48"
      role="img"
      aria-label={label}
      className={cn("h-12 w-28 overflow-visible", className)}
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Rain gauge (pluviómetro): a funnel over a graduated tube filled to `mm`. */
export function RainGauge({
  mm,
  className,
}: {
  mm: number;
  className?: string;
}) {
  const id = useId();
  const scale = Math.max(50, Math.ceil(mm / 50) * 50);
  const top = 26;
  const bottom = 186;
  const level = bottom - (Math.min(mm, scale) / scale) * (bottom - top);
  const step = scale <= 50 ? 25 : scale <= 200 || scale % 100 ? 50 : 100;
  const ticks = Array.from({ length: scale / step + 1 }, (_, i) => ({
    y: round(bottom - ((i * step) / scale) * (bottom - top)),
    label: i * step,
  }));
  return (
    <svg
      viewBox="0 0 132 200"
      className={cn("h-full overflow-visible", className)}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`${id}-tube`}>
          <rect x="34" y={top} width="40" height={bottom - top} rx="14" />
        </clipPath>
        <pattern
          id={`${id}-hatch`}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="8"
            stroke="var(--water-foreground)"
            strokeOpacity="0.35"
            strokeWidth="2"
          />
        </pattern>
      </defs>
      <path
        d="M14 6h80l-18 18H32z"
        className="fill-muted stroke-foreground/15"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect
        x="34"
        y={top}
        width="40"
        height={bottom - top}
        rx="14"
        className="fill-muted"
      />
      <g clipPath={`url(#${id}-tube)`}>
        <rect
          x="34"
          y={level}
          width="40"
          height={bottom - level}
          fill="var(--water)"
          className="transition-all duration-700"
        />
        <rect
          x="34"
          y={level}
          width="40"
          height={bottom - level}
          fill={`url(#${id}-hatch)`}
        />
      </g>
      <rect
        x="34"
        y={top}
        width="40"
        height={bottom - top}
        rx="14"
        fill="none"
        className="stroke-foreground/15"
        strokeWidth="1.5"
      />
      {ticks.map((tick) => (
        <g key={tick.label}>
          <line
            x1="80"
            x2="88"
            y1={tick.y}
            y2={tick.y}
            className="stroke-muted-foreground/60"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <text
            x="94"
            y={tick.y + 4}
            className="fill-muted-foreground font-sans text-[11px]"
          >
            {tick.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
