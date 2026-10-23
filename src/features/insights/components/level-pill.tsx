import { useTranslations } from "next-intl";
import { RISK_COLORS } from "@/features/map/lib/risk-layers";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "../risk/model";

/** Ink with at least 4.5:1 contrast on each level's fill. */
const INK: Record<RiskLevel, string> = {
  low: "#07131f",
  moderate: "#07131f",
  high: "#07131f",
  very_high: "#ffffff",
};

export function LevelPill({
  level,
  score,
  baseline = false,
  className,
}: {
  level: RiskLevel;
  score?: number;
  baseline?: boolean;
  className?: string;
}) {
  const t = useTranslations("panel");
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-bold whitespace-nowrap",
        className,
      )}
      style={{ backgroundColor: RISK_COLORS[level], color: INK[level] }}
    >
      {baseline ? `${t("baseline")} · ` : null}
      {t(`levels.${level}`)}
      {score === undefined ? null : ` · ${score}`}
    </span>
  );
}
