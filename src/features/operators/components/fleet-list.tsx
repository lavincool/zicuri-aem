import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { FleetDevice } from "../server/fleet";
import { DeviceCard } from "./device-card";

export const FLEET_FILTERS = [
  "all",
  "attention",
  "critical",
  "warning",
  "offline",
  "normal",
  "retired",
] as const;
export type FleetFilter = (typeof FLEET_FILTERS)[number];

function matches(device: FleetDevice, filter: FleetFilter): boolean {
  const retired = device.status === "retired";
  const off = retired || device.status === "maintenance";
  switch (filter) {
    case "all":
      return !retired;
    case "attention":
      return device.issues.length > 0;
    case "retired":
      return retired;
    default:
      return !off && device.level === filter;
  }
}

export function FleetList({
  fleet,
  filter,
  orgName,
  now,
}: {
  fleet: FleetDevice[];
  filter: FleetFilter;
  orgName: string;
  now: Date;
}) {
  const t = useTranslations("operator.sensors");
  const shown = fleet.filter((d) => matches(d, filter));
  const live = fleet.filter((d) => d.status !== "retired");
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("subtitle", { count: live.length, org: orgName })}
        </p>
      </header>
      <nav
        aria-label={t("filterLabel")}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {FLEET_FILTERS.map((option) => {
          const count = fleet.filter((d) => matches(d, option)).length;
          const active = option === filter;
          return (
            <Link
              key={option}
              href={
                option === "all"
                  ? "/operador/sensores"
                  : `/operador/sensores?estado=${option}`
              }
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors hover:bg-muted",
                active &&
                  "border-foreground bg-foreground text-background hover:bg-foreground",
              )}
            >
              {t(`filters.${option}`)}
              <span className="tabular-nums opacity-70">{count}</span>
            </Link>
          );
        })}
      </nav>
      {shown.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-center text-muted-foreground ring-1 ring-foreground/10">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {shown.map((device) => (
            <li key={device.id}>
              <DeviceCard device={device} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
