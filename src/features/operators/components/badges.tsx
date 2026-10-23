import { EyeOff, Wrench } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import {
  type DeviceLevel,
  type DeviceStatus,
  type DeviceVisibility,
  LEVEL_COLORS,
} from "@/config/devices";
import type { HealthIssue } from "@/features/devices/health";
import { cn } from "@/lib/utils";
import { durationParts } from "../rules";

/** The level badge, replaced by the status while a sensor is off on purpose. */
export function StateBadge({
  level,
  status,
  className,
}: {
  level: DeviceLevel;
  status: DeviceStatus;
  className?: string;
}) {
  const t = useTranslations("operator");
  if (status === "maintenance" || status === "retired") {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-extrabold",
          className,
        )}
      >
        <Wrench className="size-3.5" />
        {t(`status.${status}`)}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-extrabold text-white",
        className,
      )}
      style={{ backgroundColor: LEVEL_COLORS[level] }}
    >
      {t(`levels.${level}`)}
    </span>
  );
}

export function VisibilityBadge({
  visibility,
}: {
  visibility: DeviceVisibility;
}) {
  const t = useTranslations("operator.visibility");
  if (visibility === "public") return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold">
      <EyeOff className="size-3.5" />
      {t(visibility)}
    </span>
  );
}

export function IssueText({ issue, now }: { issue: HealthIssue; now: Date }) {
  const t = useTranslations("operator.issues");
  const format = useFormatter();
  switch (issue.kind) {
    case "never_reported":
      return t("never_reported");
    case "silent":
      return t("silent", { time: format.relativeTime(issue.since, now) });
    case "spikes":
      return t("spikes", { count: issue.count });
    case "flat_line":
      return t("flat_line", { days: issue.days });
    case "low_battery":
      return t("low_battery", { percent: issue.percent });
  }
}

/** "45 min", "2 h 15 min", "3 d 4 h"; works in server and client components. */
export function useDuration() {
  const t = useTranslations("operator.duration");
  return (ms: number) => {
    const parts = durationParts(ms);
    switch (parts.unit) {
      case "minutes":
        return t("minutes", { minutes: parts.minutes });
      case "hours":
        return t("hours", { hours: parts.hours, minutes: parts.minutes });
      case "days":
        return t("days", { days: parts.days, hours: parts.hours });
    }
  };
}
