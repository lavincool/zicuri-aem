"use client";

import { LoaderCircle, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  type ReactNode,
  useId,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEVICE_SITE_TYPES,
  DEVICE_VISIBILITIES,
  type DeviceSiteType,
  type DeviceStatus,
  type DeviceVisibility,
  EDITABLE_DEVICE_STATUSES,
  type EditableDeviceStatus,
  LEVEL_COLORS,
} from "@/config/devices";
import {
  isInsideServiceArea,
  MAP_ZOOM,
  MEXICO_VIEW,
} from "@/config/service-area";
import type { DeviceUpdate, EditField } from "@/features/devices/edits";
import { levelFor } from "@/features/devices/rules";
import { FloodMap } from "@/features/map/components/flood-map";
import { cn } from "@/lib/utils";
import { updateDeviceAction } from "../server/device-actions";

export type EditableDevice = {
  id: string;
  name: string;
  siteType: DeviceSiteType;
  status: DeviceStatus;
  visibility: DeviceVisibility;
  lat: number | null;
  lng: number | null;
  mountHeightCm: number | null;
  warningCm: number;
  criticalCm: number;
  reportingIntervalS: number;
  lastLevelCm: number | null;
};

const noopSubscribe = () => () => {};
const EMPTY_REPORTS = {
  type: "FeatureCollection" as const,
  truncated: false,
  features: [],
};
const round = (value: number, digits: number) => Number(value.toFixed(digits));

export function DeviceEditForm({ device }: { device: EditableDevice }) {
  const t = useTranslations("operator.edit");
  const tl = useTranslations("operator");
  const ts = useTranslations("sensors.sites");
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<EditField[]>([]);
  const [name, setName] = useState(device.name);
  const [siteType, setSiteType] = useState(device.siteType);
  const [status, setStatus] = useState<EditableDeviceStatus>(
    device.status === "pending" ? "active" : device.status,
  );
  const [visibility, setVisibility] = useState(device.visibility);
  const [location, setLocation] = useState({
    lat: device.lat ?? MEXICO_VIEW.center[1],
    lng: device.lng ?? MEXICO_VIEW.center[0],
  });
  const [pickingLocation, setPickingLocation] = useState(false);
  const [warning, setWarning] = useState(String(device.warningCm));
  const [critical, setCritical] = useState(String(device.criticalCm));
  const [mountHeight, setMountHeight] = useState(
    device.mountHeightCm === null ? "" : String(device.mountHeightCm),
  );
  const [intervalMinutes, setIntervalMinutes] = useState(
    String(round(device.reportingIntervalS / 60, 1)),
  );

  const warningCm = Number(warning);
  const criticalCm = Number(critical);
  const thresholdsValid =
    warning !== "" &&
    critical !== "" &&
    Number.isFinite(warningCm) &&
    Number.isFinite(criticalCm) &&
    criticalCm > warningCm;
  const previewLevel =
    thresholdsValid && device.lastLevelCm !== null
      ? levelFor(device.lastLevelCm, { warningCm, criticalCm })
      : null;

  const invalid = (field: EditField) => errors.includes(field);
  const errorId = (field: EditField) => `edit-${field}-error`;
  const fieldError = (field: EditField) =>
    invalid(field) ? (
      <p id={errorId(field)} className="text-sm font-semibold text-destructive">
        {t(`errors.${field}`)}
      </p>
    ) : null;
  const describedBy = (field: EditField) =>
    invalid(field) ? errorId(field) : undefined;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const input: DeviceUpdate = {
      name,
      siteType,
      status,
      visibility,
      lat: location.lat,
      lng: location.lng,
      mountHeightCm: mountHeight.trim() === "" ? null : Number(mountHeight),
      warningCm,
      criticalCm,
      reportingIntervalS: Math.round(Number(intervalMinutes) * 60),
    };
    startTransition(async () => {
      const result = await updateDeviceAction(device.id, input);
      if ("ok" in result) {
        setErrors([]);
        setPickingLocation(false);
        toast.success(result.changed.length ? t("saved") : t("noChanges"));
      } else if (result.error === "invalid") {
        setErrors(result.fields);
        toast.error(t("errors.summary"));
      } else {
        toast.error(
          result.error === "forbidden"
            ? tl("errors.forbidden")
            : tl("errors.notFound"),
        );
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Field label={t("name")} htmlFor="edit-name" help={t("nameHelp")}>
        <Input
          id="edit-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          required
          aria-invalid={invalid("name") || undefined}
          aria-describedby={describedBy("name")}
          className="h-12 rounded-xl text-base"
        />
        {fieldError("name")}
      </Field>

      <ChoiceGroup
        legend={t("siteType")}
        name="siteType"
        value={siteType}
        onChange={setSiteType}
        options={DEVICE_SITE_TYPES.map((value) => ({
          value,
          label: ts(value),
        }))}
      />

      <ChoiceGroup
        legend={t("status")}
        name="status"
        value={status}
        onChange={setStatus}
        options={EDITABLE_DEVICE_STATUSES.map((value) => ({
          value,
          label: tl(`status.${value}`),
          help: t(`statusHelp.${value}`),
        }))}
      />

      <ChoiceGroup
        legend={t("visibility")}
        name="visibility"
        value={visibility}
        onChange={setVisibility}
        options={DEVICE_VISIBILITIES.map((value) => ({
          value,
          label: tl(`visibility.${value}`),
          help: t(`visibilityHelp.${value}`),
        }))}
      />

      <fieldset className="space-y-2">
        <legend className="mb-2 font-semibold">{t("location")}</legend>
        <p className="flex items-center gap-2 text-sm tabular-nums">
          <MapPin className="size-4 text-muted-foreground" />
          {t("locationValue", {
            lat: location.lat.toFixed(5),
            lng: location.lng.toFixed(5),
          })}
        </p>
        {pickingLocation ? (
          <LocationPicker
            initial={location}
            initialZoom={device.lat === null ? MEXICO_VIEW.zoom : 17}
            onChange={setLocation}
            onDone={() => setPickingLocation(false)}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setPickingLocation(true)}
            className="h-11 rounded-full px-4 font-semibold"
          >
            {t("changeLocation")}
          </Button>
        )}
        {fieldError("location")}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold">{t("thresholds")}</legend>
        <p className="text-sm text-muted-foreground">{t("thresholdsHelp")}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("warningCm")} htmlFor="edit-warning">
            <Input
              id="edit-warning"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0}
              value={warning}
              onChange={(event) => setWarning(event.target.value)}
              aria-invalid={invalid("warningCm") || undefined}
              aria-describedby={describedBy("warningCm")}
              className="h-12 rounded-xl text-base"
            />
          </Field>
          <Field label={t("criticalCm")} htmlFor="edit-critical">
            <Input
              id="edit-critical"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0}
              value={critical}
              onChange={(event) => setCritical(event.target.value)}
              aria-invalid={invalid("criticalCm") || undefined}
              aria-describedby={describedBy("criticalCm")}
              className="h-12 rounded-xl text-base"
            />
          </Field>
        </div>
        {fieldError("warningCm")}
        {fieldError("criticalCm")}
        <p
          aria-live="polite"
          className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm font-semibold"
        >
          {device.lastLevelCm === null ? (
            t("previewNoData")
          ) : previewLevel ? (
            <>
              <span
                className="mt-1 size-3 shrink-0 rounded-full"
                style={{ backgroundColor: LEVEL_COLORS[previewLevel] }}
              />
              {t("preview", {
                cm: device.lastLevelCm.toFixed(1),
                level: tl(`levels.${previewLevel}`),
              })}
            </>
          ) : (
            t("errors.criticalCm")
          )}
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("reportingInterval")}
          htmlFor="edit-interval"
          help={t("reportingIntervalHelp")}
        >
          <Input
            id="edit-interval"
            type="number"
            inputMode="decimal"
            min={1}
            max={1440}
            step="1"
            value={intervalMinutes}
            onChange={(event) => setIntervalMinutes(event.target.value)}
            aria-invalid={invalid("reportingIntervalS") || undefined}
            aria-describedby={describedBy("reportingIntervalS")}
            className="h-12 rounded-xl text-base"
          />
          {fieldError("reportingIntervalS")}
        </Field>
        <Field
          label={t("mountHeightCm")}
          htmlFor="edit-mount"
          help={t("mountHeightHelp")}
        >
          <Input
            id="edit-mount"
            type="number"
            inputMode="decimal"
            min={1}
            step="0.5"
            value={mountHeight}
            onChange={(event) => setMountHeight(event.target.value)}
            aria-invalid={invalid("mountHeightCm") || undefined}
            aria-describedby={describedBy("mountHeightCm")}
            className="h-12 rounded-xl text-base"
          />
          {fieldError("mountHeightCm")}
        </Field>
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl text-base font-bold sm:w-auto sm:px-8"
      >
        {pending ? <LoaderCircle className="size-5 animate-spin" /> : null}
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  help,
  children,
}: {
  label: string;
  htmlFor: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="font-semibold">
        {label}
      </Label>
      {children}
      {help ? <p className="text-sm text-muted-foreground">{help}</p> : null}
    </div>
  );
}

/** Native radios styled as cards: keyboard and screen-reader support for free. */
function ChoiceGroup<T extends string>({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string;
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; help?: string }[];
}) {
  const id = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 font-semibold">{legend}</legend>
      <div
        className={cn(
          "grid gap-2",
          options.some((option) => option.help)
            ? "sm:grid-cols-2"
            : "grid-cols-2",
        )}
      >
        {options.map((option) => (
          <label
            key={option.value}
            htmlFor={`${id}-${option.value}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              value === option.value
                ? "border-foreground bg-card"
                : "border-border hover:bg-muted",
            )}
          >
            <input
              id={`${id}-${option.value}`}
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="mt-1 size-4 accent-foreground"
            />
            <span className="space-y-0.5">
              <span className="block font-semibold">{option.label}</span>
              {option.help ? (
                <span className="block text-sm text-muted-foreground">
                  {option.help}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The map moves under a fixed pin, like the report flow's location step. */
function LocationPicker({
  initial,
  initialZoom,
  onChange,
  onDone,
}: {
  initial: { lat: number; lng: number };
  initialZoom: number;
  onChange: (location: { lat: number; lng: number }) => void;
  onDone: () => void;
}) {
  const t = useTranslations("operator.edit");
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const [outside, setOutside] = useState(false);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t("locationHelp")}</p>
      <div className="relative h-72 overflow-hidden rounded-2xl bg-muted ring-1 ring-foreground/10">
        {mounted && resolvedTheme ? (
          <FloodMap
            className="absolute inset-0"
            styleUrl={`/map/styles/cauce-${theme}.json`}
            theme={theme}
            initialCenter={[initial.lng, initial.lat]}
            initialZoom={initialZoom}
            minZoom={MAP_ZOOM.min}
            maxZoom={MAP_ZOOM.max}
            reports={EMPTY_REPORTS}
            onViewChange={(view) => {
              const [lng, lat] = view.center;
              setOutside(!isInsideServiceArea(lng, lat));
              onChange({ lat: round(lat, 6), lng: round(lng, 6) });
            }}
            ariaLabel={t("locationAriaLabel")}
          />
        ) : null}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-full"
        >
          <svg
            viewBox="0 0 40 52"
            className="h-12 w-10 drop-shadow-lg"
            aria-hidden="true"
          >
            <path
              d="M20 51s17-17.4 17-31A17 17 0 0 0 3 20c0 13.6 17 31 17 31z"
              className={outside ? "fill-muted-foreground" : "fill-primary"}
              stroke="#0b1f33"
              strokeWidth="2.5"
            />
            <circle cx="20" cy="20" r="6.5" fill="#0b1f33" />
          </svg>
        </div>
      </div>
      {outside ? (
        <p className="text-sm font-semibold text-destructive">
          {t("errors.location")}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        onClick={onDone}
        className="h-11 rounded-full px-4 font-semibold"
      >
        {t("locationDone")}
      </Button>
    </div>
  );
}
