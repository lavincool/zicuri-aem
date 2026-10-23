import { Download } from "lucide-react";
import Form from "next/form";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EVENT_LEVELS } from "../schema";
import type { FleetDevice, FleetEvent } from "../server/fleet";
import { EventList } from "./event-list";

const selectClass =
  "h-12 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function EventsView({
  events,
  fleet,
  filters,
  now,
}: {
  events: FleetEvent[];
  fleet: FleetDevice[];
  filters: { sensor?: string; nivel?: FleetEvent["level"] };
  now: Date;
}) {
  const t = useTranslations("operator.events");
  const query = new URLSearchParams();
  if (filters.sensor) query.set("sensor", filters.sensor);
  if (filters.nivel) query.set("nivel", filters.nivel);
  const csvHref = `/api/operator/events.csv${query.size ? `?${query}` : ""}`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={csvHref} download />}
          className="h-11 rounded-full px-4 font-semibold"
        >
          <Download className="size-4" />
          {t("download")}
        </Button>
      </header>

      {/* A GET form: filters live in the URL and work without JavaScript. */}
      <Form
        action="/operador/eventos"
        className="grid grid-cols-1 gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
      >
        <label className="space-y-2">
          <span className="block font-semibold">{t("filterSensor")}</span>
          <select
            name="sensor"
            defaultValue={filters.sensor ?? ""}
            className={selectClass}
          >
            <option value="">{t("allSensors")}</option>
            {fleet.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="block font-semibold">{t("filterLevel")}</span>
          <select
            name="nivel"
            defaultValue={filters.nivel ?? ""}
            className={selectClass}
          >
            <option value="">{t("allLevels")}</option>
            {EVENT_LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(`levels.${level}`)}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="submit"
          className="h-12 rounded-xl px-6 text-base font-bold"
        >
          {t("apply")}
        </Button>
      </Form>

      {events.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-center text-muted-foreground ring-1 ring-foreground/10">
          {t("empty")}
        </p>
      ) : (
        <EventList events={events} now={now} showDevice />
      )}
    </div>
  );
}
