import type { useTranslations } from "next-intl";
import type { RiskFactor } from "../risk/model";

type Translator = ReturnType<typeof useTranslations<"panel">>;

/** Plain-language reason for one factor, or null when it adds nothing. */
export function reasonText(t: Translator, factor: RiskFactor): string | null {
  if (factor.contribution <= 0 || factor.value === null) return null;
  switch (factor.key) {
    case "rain":
      return t("reasons.rain", { mm: factor.value });
    case "blockages":
      return t("reasons.blockages", { count: factor.value });
    case "history":
      return t("reasons.history", { count: factor.value });
    case "sensors":
      return t("reasons.sensors", { percent: factor.value });
    case "terrain":
      return t("reasons.terrain", {
        meters: Math.abs(factor.value).toFixed(1),
      });
  }
}

export function topReasons(t: Translator, factors: RiskFactor[], limit = 3) {
  return factors
    .map((factor) => reasonText(t, factor))
    .filter((text): text is string => text !== null)
    .slice(0, limit);
}
