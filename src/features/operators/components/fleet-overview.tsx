import {
  Activity,
  ArrowRight,
  CircleCheck,
  CloudRain,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { type DeviceLevel, LEVEL_COLORS } from "@/config/devices";
import type { FleetOverview } from "../server/fleet";
import { DeviceCard } from "./device-card";
import { FleetMap } from "./fleet-map";

const LEVELS: DeviceLevel[] = ["normal", "warning", "critical", "offline"];

export function FleetOverviewView({
  data,
  orgName,
  now,
}: {
  data: FleetOverview;
  orgName: string;
  now: Date;
}) {
  const t = useTranslations("operator.overview");
  const live = data.fleet.filter((d) => d.status !== "retired");
  const attention = live.filter((d) => d.issues.length > 0);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("subtitle", { org: orgName, count: live.length })}
        </p>
      </header>

      {live.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-center text-muted-foreground ring-1 ring-foreground/10">
          {t("empty")}
        </p>
      ) : (
        <>
          <KpiTiles data={data} attention={attention.length} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="space-y-6">
              <ForecastCard data={data} now={now} />
              <section className="space-y-3">
                <div>
                  <h2 className="text-xl font-extrabold">
                    {t("attention.title")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("attention.body")}
                  </p>
                </div>
                {attention.length === 0 ? (
                  <p className="flex items-center gap-2 rounded-2xl bg-card p-4 font-semibold ring-1 ring-foreground/10">
                    <CircleCheck className="size-5 text-success" />
                    {t("attention.empty")}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {attention.map((device) => (
                      <li key={device.id}>
                        <DeviceCard device={device} now={now} />
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href="/operador/sensores"
                  className="inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
                >
                  {t("viewAll")}
                  <ArrowRight className="size-4" />
                </Link>
              </section>
            </div>
            <section className="space-y-3">
              <div>
                <h2 className="text-xl font-extrabold">{t("map.title")}</h2>
                <p className="text-sm text-muted-foreground">{t("map.hint")}</p>
              </div>
              <div className="relative h-[22rem] overflow-hidden rounded-2xl bg-muted ring-1 ring-foreground/10 lg:h-[32rem]">
                <FleetMap sensors={data.features} />
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function KpiTiles({
  data,
  attention,
}: {
  data: FleetOverview;
  attention: number;
}) {
  const t = useTranslations("operator");
  // Sensors in maintenance or retired are off on purpose, not "sin señal".
  const counted = data.fleet.filter(
    (d) => d.status !== "maintenance" && d.status !== "retired",
  );
  const byLevel = (level: DeviceLevel) =>
    counted.filter((d) => d.level === level).length;
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {LEVELS.map((level) => (
        <article
          key={level}
          className="space-y-1 rounded-2xl bg-card p-4 ring-1 ring-foreground/10"
        >
          <span
            className="block size-3 rounded-full"
            style={{ backgroundColor: LEVEL_COLORS[level] }}
          />
          <p className="font-display text-3xl font-extrabold tabular-nums">
            {byLevel(level)}
          </p>
          <p className="text-sm text-muted-foreground">
            {t(`levels.${level}`)}
          </p>
        </article>
      ))}
      <article className="space-y-1 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <TriangleAlert className="size-4 text-warning" />
        <p className="font-display text-3xl font-extrabold tabular-nums">
          {attention}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("overview.kpis.attention")}
        </p>
      </article>
      <article className="space-y-1 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <Activity className="size-4 text-muted-foreground" />
        <p className="font-display text-3xl font-extrabold tabular-nums">
          {data.events7d}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("overview.kpis.events7d")}
        </p>
      </article>
    </section>
  );
}

function ForecastCard({ data, now }: { data: FleetOverview; now: Date }) {
  const t = useTranslations("operator.overview.forecast");
  const format = useFormatter();
  const forecast = data.forecast.openMeteo;
  return (
    <article className="space-y-2 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <p className="text-sm font-semibold text-muted-foreground">
        {t("title")}
      </p>
      {forecast ? (
        <>
          <p className="flex items-center gap-2 font-display text-3xl font-extrabold">
            <CloudRain className="size-7 text-water" />
            {forecast.summary.next48hMm >= 1
              ? t("upTo", { mm: forecast.summary.next48hMm })
              : t("noRain")}
          </p>
          {forecast.summary.maxProbPct !== null ? (
            <p className="text-sm">
              {t("probability", { percent: forecast.summary.maxProbPct })}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t("source", {
              time: format.relativeTime(new Date(forecast.fetchedAt), now),
            })}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">{t("unavailable")}</p>
      )}
    </article>
  );
}
