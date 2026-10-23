import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { LEVEL_COLORS } from "@/config/devices";
import type { FleetEvent } from "../server/fleet";
import { useDuration } from "./badges";

const TIME = {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
} as const;

/** Alert and outage periods; `showDevice` adds the sensor name for fleet-wide lists. */
export function EventList({
  events,
  now,
  showDevice = false,
}: {
  events: FleetEvent[];
  now: Date;
  showDevice?: boolean;
}) {
  const t = useTranslations("operator.events");
  const format = useFormatter();
  const duration = useDuration();
  return (
    <ol className="space-y-2">
      {events.map((event) => {
        const end = event.endedAt ?? now;
        return (
          <li
            key={event.id}
            className="flex gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
          >
            <span
              aria-hidden="true"
              className="mt-1 w-1.5 shrink-0 self-stretch rounded-full"
              style={{ backgroundColor: LEVEL_COLORS[event.level] }}
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="flex flex-wrap items-center gap-x-2 font-bold">
                <span>{t(`levels.${event.level}`)}</span>
                {showDevice ? (
                  <Link
                    href={`/operador/sensores/${event.deviceId}`}
                    className="truncate font-semibold text-muted-foreground underline-offset-4 hover:underline"
                  >
                    {event.deviceName}
                  </Link>
                ) : null}
                {event.endedAt ? null : (
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-xs font-extrabold text-background">
                    {t("ongoing")}
                  </span>
                )}
              </p>
              <p className="text-sm">
                {event.endedAt
                  ? t("range", {
                      start: format.dateTime(event.startedAt, TIME),
                      end: format.dateTime(event.endedAt, TIME),
                    })
                  : t("since", {
                      time: format.dateTime(event.startedAt, TIME),
                    })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("duration", {
                  duration: duration(end.getTime() - event.startedAt.getTime()),
                })}
                {event.peakCm !== null
                  ? ` · ${t("peak", { cm: event.peakCm.toFixed(1) })}`
                  : null}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
