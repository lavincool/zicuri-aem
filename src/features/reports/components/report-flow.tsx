"use client";

import {
  ArrowLeft,
  Camera,
  Check,
  ImageIcon,
  LoaderCircle,
  MapPin,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORY_COLORS,
  CATEGORY_SEVERITY,
  REPORT_CATEGORIES,
  type ReportCategory,
  type SeverityDetail,
  type WaterDepthCm,
} from "@/config/categories";
import { isInsideServiceArea, type LngLat } from "@/config/service-area";
import { fetchSuggestion } from "@/features/ai/client/suggest";
import type { Suggestion } from "@/features/ai/schema";
import { haversineMeters } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { ApiRequestError } from "../client/api";
import { enqueueReport } from "../client/outbox";
import {
  type ExifLocation,
  PhotoError,
  type ProcessedPhoto,
  processPhoto,
  readExifLocation,
} from "../client/photo";
import { type ReportDraft, submitReport, uploadPhoto } from "../client/upload";
import type { CreatedReport, LocationSource } from "../schema";
import { CategoryIcon } from "./category-icon";

type Step = "closed" | "photo" | "location" | "details" | "sending";
type Gps =
  | { status: "idle" | "locating" | "denied" | "unavailable" }
  | { status: "ready"; lat: number; lng: number; accuracyM: number };
type Placement = {
  lat: number;
  lng: number;
  source: LocationSource;
  accuracyM: number | null;
};

/** Map controls the flow needs; MapScreen adapts its FloodMap handle to this. */
export type FlowMapControls = {
  getCenter: () => LngLat | null;
  focusOn: (center: LngLat, zoom: number) => void;
  showAccuracy: (
    location: { lat: number; lng: number; accuracyM: number } | null,
  ) => void;
};

/** Moving the pin farther than this turns a GPS/EXIF location into a manual one. */
const MANUAL_THRESHOLD_M = 15;
/** The map starts country-wide without GPS; a pin needs at least street-level zoom. */
const MIN_PIN_ZOOM = 14;

export function ReportFlow({
  map,
  viewCenter,
  viewZoom,
  aiEnabled,
  onSearch,
  onActiveChange,
  onCreated,
  onQueued,
}: {
  map: FlowMapControls;
  aiEnabled: boolean;
  /** Latest map center and zoom (update on moveend) for live placement checks. */
  viewCenter: LngLat | null;
  viewZoom: number | null;
  /** Opens the place search so people without GPS can jump to their town. */
  onSearch: () => void;
  onActiveChange: (step: Step) => void;
  onCreated: (created: CreatedReport) => void;
  onQueued: (draft: ReportDraft) => void;
}) {
  const t = useTranslations();
  const [step, setStepState] = useState<Step>("closed");
  const [photo, setPhoto] = useState<ProcessedPhoto | null>(null);
  const [processing, setProcessing] = useState(false);
  const [exif, setExif] = useState<ExifLocation | null>(null);
  const [gps, setGps] = useState<Gps>({ status: "idle" });
  const [anchor, setAnchor] = useState<Placement | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [severityDetail, setSeverityDetail] = useState<SeverityDetail | null>(
    null,
  );
  const [waterDepthCm, setWaterDepthCm] = useState<WaterDepthCm | null>(null);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const clientRequestId = useRef<string>("");
  const upload = useRef<Promise<string> | null>(null);
  const suggestionRequest = useRef<AbortController | null>(null);
  const categoryChosen = useRef(false);
  const fileVersion = useRef(0);
  const stepRef = useRef<Step>("closed");
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const setStep = useCallback(
    (next: Step) => {
      stepRef.current = next;
      setStepState(next);
      onActiveChange(next);
    },
    [onActiveChange],
  );

  const reset = useCallback(() => {
    suggestionRequest.current?.abort();
    suggestionRequest.current = null;
    categoryChosen.current = false;
    fileVersion.current += 1;
    clientRequestId.current = "";
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    setPhoto(null);
    setProcessing(false);
    setExif(null);
    setGps({ status: "idle" });
    setAnchor(null);
    setPlacement(null);
    setCategory(null);
    setSeverityDetail(null);
    setWaterDepthCm(null);
    setNote("");
    setNoteOpen(false);
    setProgress(0);
    setUploadState("idle");
    setSuggestion(null);
    setAnalyzing(false);
    upload.current = null;
    map.showAccuracy(null);
  }, [map, photo]);

  const close = useCallback(() => {
    reset();
    setStep("closed");
  }, [reset, setStep]);

  const open = useCallback(() => {
    reset();
    clientRequestId.current = crypto.randomUUID();
    const session = clientRequestId.current;
    setStep("photo");
    // Ask for location right away, in parallel with taking the photo.
    if (!("geolocation" in navigator)) {
      setGps({ status: "unavailable" });
      return;
    }
    setGps({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (clientRequestId.current !== session) return;
        setGps({
          status: "ready",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: Math.round(position.coords.accuracy),
        });
      },
      (error) => {
        if (clientRequestId.current !== session) return;
        setGps({
          status:
            error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 10_000 },
    );
  }, [reset, setStep]);

  const startUpload = useCallback(
    (processed: ProcessedPhoto) => {
      setUploadState("uploading");
      setProgress(0);
      const promise = uploadPhoto(processed, (fraction) => {
        if (upload.current === promise) setProgress(fraction);
      });
      upload.current = promise;
      promise.then(
        (uploadId) => {
          if (upload.current !== promise) return;
          setUploadState("done");
          if (!aiEnabled || stepRef.current === "sending") return;
          const controller = new AbortController();
          suggestionRequest.current = controller;
          setAnalyzing(true);
          void fetchSuggestion(uploadId, controller.signal).then((result) => {
            if (upload.current !== promise || controller.signal.aborted) return;
            suggestionRequest.current = null;
            setAnalyzing(false);
            if (!result) return;
            setSuggestion(result);
            // A manual choice always takes precedence over a late suggestion.
            if (result.category && !categoryChosen.current) {
              setCategory(result.category);
            }
          });
        },
        () => {
          if (upload.current !== promise) return;
          setUploadState("error");
          upload.current = null;
        },
      );
    },
    [aiEnabled],
  );

  useEffect(
    () => () => {
      suggestionRequest.current?.abort();
      upload.current = null;
      fileVersion.current += 1;
    },
    [],
  );

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file || stepRef.current === "sending") return;
      const version = ++fileVersion.current;
      setProcessing(true);
      try {
        const [location, processed] = await Promise.all([
          readExifLocation(file),
          processPhoto(file),
        ]);
        if (version !== fileVersion.current) {
          URL.revokeObjectURL(processed.previewUrl);
          return;
        }
        suggestionRequest.current?.abort();
        suggestionRequest.current = null;
        setSuggestion(null);
        setAnalyzing(false);
        if (!categoryChosen.current) {
          setCategory(null);
          setSeverityDetail(null);
          setWaterDepthCm(null);
        }
        if (photo) URL.revokeObjectURL(photo.previewUrl);
        setPhoto(processed);
        setExif(location);
        startUpload(processed);
        setStep(placement ? "details" : "location");
      } catch (error) {
        if (version !== fileVersion.current) return;
        const code = error instanceof PhotoError ? error.code : "FAILED";
        toast.error(
          code === "TOO_LARGE"
            ? t("flow.photoTooLarge")
            : code === "UNSUPPORTED"
              ? t("flow.photoUnsupported")
              : t("flow.photoFailed"),
        );
      } finally {
        if (version === fileVersion.current) {
          setProcessing(false);
          if (cameraInput.current) cameraInput.current.value = "";
          if (galleryInput.current) galleryInput.current.value = "";
        }
      }
    },
    [photo, placement, setStep, startUpload, t],
  );

  // Choose the starting pin when entering the location step, and follow GPS
  // if it arrives before the person moves the map.
  useEffect(() => {
    if (step !== "location") return;
    let start: Placement | null = null;
    if (gps.status === "ready" && isInsideServiceArea(gps.lng, gps.lat)) {
      start = {
        lat: gps.lat,
        lng: gps.lng,
        source: "gps",
        accuracyM: gps.accuracyM,
      };
      map.showAccuracy({
        lat: gps.lat,
        lng: gps.lng,
        accuracyM: gps.accuracyM,
      });
    } else if (exif && isInsideServiceArea(exif.lng, exif.lat)) {
      start = { lat: exif.lat, lng: exif.lng, source: "exif", accuracyM: null };
    }
    if (start && (!anchor || anchor.source === "manual")) {
      setAnchor(start);
      map.focusOn([start.lng, start.lat], 17);
    } else if (!anchor) {
      const center = map.getCenter();
      if (center) {
        setAnchor({
          lng: center[0],
          lat: center[1],
          source: "manual",
          accuracyM: null,
        });
      }
    }
  }, [anchor, exif, gps, map, step]);

  const center = viewCenter;
  const outside = center ? !isInsideServiceArea(center[0], center[1]) : false;
  const tooFar = viewZoom !== null && viewZoom < MIN_PIN_ZOOM;

  const confirmLocation = () => {
    const current = map.getCenter();
    if (!current || !isInsideServiceArea(current[0], current[1])) return;
    const [lng, lat] = current;
    const moved = anchor
      ? haversineMeters(anchor, { lat, lng }) > MANUAL_THRESHOLD_M
      : true;
    setPlacement(
      !anchor || moved || anchor.source === "manual"
        ? { lat, lng, source: "manual", accuracyM: null }
        : { ...anchor, lat, lng },
    );
    map.showAccuracy(null);
    setStep("details");
  };

  const submit = async () => {
    if (!photo || !placement || !category || processing) return;
    suggestionRequest.current?.abort();
    suggestionRequest.current = null;
    setAnalyzing(false);
    const draft: ReportDraft = {
      clientRequestId: clientRequestId.current,
      category,
      severityDetail,
      waterDepthCm,
      note: note.trim() ? note.trim() : null,
      location: placement,
      photo: { width: photo.width, height: photo.height, color: photo.color },
      aiSuggestionId: suggestion?.suggestionId ?? null,
    };
    setStep("sending");
    try {
      if (!upload.current) startUpload(photo);
      const uploadId = await (upload.current as Promise<string>);
      const created = await submitReport(draft, uploadId);
      onCreated(created);
      close();
    } catch (error) {
      const status = error instanceof ApiRequestError ? error.status : 0;
      const code = error instanceof ApiRequestError ? error.code : "";
      if (status === 0 || status >= 500 || !navigator.onLine) {
        let uploadId: string | null = null;
        try {
          uploadId = upload.current ? await upload.current : null;
        } catch {
          uploadId = null;
        }
        await enqueueReport({
          draft,
          photo: {
            full: photo.full,
            thumb: photo.thumb,
            contentType: photo.contentType,
            width: photo.width,
            height: photo.height,
          },
          uploadId,
          queuedAt: Date.now(),
        });
        onQueued(draft);
        toast.info(t("flow.queued"));
        close();
        return;
      }
      if (code === "RATE_LIMITED") toast.error(t("flow.rateLimited"));
      else if (code === "VERIFICATION_FAILED") {
        toast.error(t("flow.verificationFailed"));
      } else if (code === "CONTENT_REJECTED") {
        toast.error(t("flow.contentRejected"));
      } else if (code === "OUTSIDE_SERVICE_AREA") {
        toast.error(t("flow.outsideArea"));
        setStep("location");
        return;
      } else toast.error(t("flow.failed"));
      setStep("details");
    }
  };

  const severityInput = category ? CATEGORY_SEVERITY[category] : null;

  return (
    <>
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />

      {step === "closed" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(env(safe-area-inset-bottom),1.25rem)] z-20 flex justify-center">
          <Button
            onClick={open}
            data-coachmark="report"
            className="pointer-events-auto h-16 gap-2.5 rounded-full px-8 text-lg font-extrabold shadow-[0_10px_30px_rgba(224,142,0,0.45)] ring-4 ring-background/70"
          >
            <Camera className="size-6" />
            {t("common.report")}
          </Button>
        </div>
      ) : null}

      {step === "photo" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="flow-photo-title"
          className="absolute inset-0 z-40 flex flex-col bg-navy text-white"
        >
          <div className="flex justify-end p-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
            <Button
              variant="ghost"
              size="icon"
              onClick={close}
              aria-label={t("flow.close")}
              className="size-12 rounded-full text-white hover:bg-white/10 hover:text-white"
            >
              <X className="size-6" />
            </Button>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
            <span className="flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {processing ? (
                <LoaderCircle className="size-11 animate-spin" />
              ) : (
                <Camera className="size-11" />
              )}
            </span>
            <div className="space-y-2">
              <h2 id="flow-photo-title" className="text-3xl font-extrabold">
                {processing ? t("flow.processing") : t("flow.photoTitle")}
              </h2>
              <p className="text-lg text-white/75">{t("flow.photoBody")}</p>
            </div>
          </div>
          <div className="space-y-3 px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
            <Button
              disabled={processing}
              onClick={() => cameraInput.current?.click()}
              className="h-16 w-full rounded-2xl text-lg font-extrabold"
            >
              <Camera className="size-6" />
              {t("flow.takePhoto")}
            </Button>
            <Button
              variant="outline"
              disabled={processing}
              onClick={() => galleryInput.current?.click()}
              className="h-14 w-full rounded-2xl border-white/30 bg-transparent text-base font-bold text-white hover:bg-white/10 hover:text-white"
            >
              <ImageIcon className="size-5" />
              {t("flow.pickPhoto")}
            </Button>
            <p className="text-center text-sm text-white/70">
              {t("flow.photoTip")}
            </p>
          </div>
        </div>
      ) : null}

      {step === "location" ? (
        <>
          {/* Fixed pin: the map moves underneath it. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-full"
          >
            <svg
              viewBox="0 0 40 52"
              className="h-14 w-11 drop-shadow-lg"
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
          <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between p-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStep("photo")}
              aria-label={t("flow.back")}
              className="size-12 rounded-full bg-card text-foreground shadow-md hover:bg-card"
            >
              <ArrowLeft className="size-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={close}
              aria-label={t("flow.close")}
              className="size-12 rounded-full bg-card text-foreground shadow-md hover:bg-card"
            >
              <X className="size-6" />
            </Button>
          </div>
          <section
            aria-labelledby="flow-location-title"
            className="absolute inset-x-0 bottom-0 z-30 space-y-3 rounded-t-3xl bg-card p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-[0_-8px_30px_rgba(11,31,51,0.18)]"
          >
            <div className="flex items-start gap-3">
              {photo ? (
                // biome-ignore lint/performance/noImgElement: local object URL preview.
                <img
                  src={photo.previewUrl}
                  alt={t("flow.photoAlt")}
                  className="size-14 shrink-0 rounded-xl object-cover"
                />
              ) : null}
              <div className="space-y-1">
                <h2 id="flow-location-title" className="text-xl font-extrabold">
                  {t("flow.locationTitle")}
                </h2>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {outside
                    ? t("flow.outsideArea")
                    : gps.status === "locating" && tooFar
                      ? t("flow.locating")
                      : tooFar
                        ? t("flow.zoomCloser")
                        : anchor?.source === "gps"
                          ? anchor.accuracyM
                            ? t("flow.locationGps", {
                                meters: anchor.accuracyM,
                              })
                            : t("flow.locationGpsNoAccuracy")
                          : anchor?.source === "exif"
                            ? t("flow.locationExif")
                            : gps.status === "locating"
                              ? t("flow.locating")
                              : gps.status === "denied"
                                ? t("flow.locationDenied")
                                : t("flow.locationManual")}
                </p>
              </div>
            </div>
            {aiEnabled && analyzing ? (
              <p
                role="status"
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
                {t("flow.analyzing")}
              </p>
            ) : null}
            {tooFar && gps.status !== "locating" ? (
              <Button
                variant="outline"
                onClick={onSearch}
                className="h-12 w-full rounded-2xl text-base font-bold"
              >
                <Search className="size-5" />
                {t("flow.searchPlace")}
              </Button>
            ) : null}
            <Button
              disabled={outside || tooFar}
              onClick={confirmLocation}
              className="h-14 w-full rounded-2xl text-lg font-extrabold"
            >
              <MapPin className="size-5" />
              {t("flow.confirmLocation")}
            </Button>
          </section>
        </>
      ) : null}

      {step === "details" || step === "sending" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="flow-details-title"
          className="absolute inset-0 z-40 flex flex-col bg-background"
        >
          <header className="flex items-center gap-2 border-b px-3 py-2 pt-[max(env(safe-area-inset-top),0.5rem)]">
            <Button
              variant="ghost"
              size="icon"
              disabled={step === "sending"}
              onClick={() => setStep("location")}
              aria-label={t("flow.back")}
              className="size-11 rounded-full"
            >
              <ArrowLeft className="size-6" />
            </Button>
            <h2
              id="flow-details-title"
              className="flex-1 text-xl font-extrabold"
            >
              {t("flow.detailsTitle")}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              disabled={step === "sending"}
              onClick={close}
              aria-label={t("flow.close")}
              className="size-11 rounded-full"
            >
              <X className="size-6" />
            </Button>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {photo ? (
              <div className="flex items-center gap-3">
                {/* biome-ignore lint/performance/noImgElement: local object URL preview. */}
                <img
                  src={photo.previewUrl}
                  alt={t("flow.photoAlt")}
                  className="h-20 w-28 rounded-xl object-cover"
                />
                <Button
                  variant="outline"
                  disabled={step === "sending" || processing}
                  onClick={() => galleryInput.current?.click()}
                  className="h-11 rounded-full px-4 font-semibold"
                >
                  <ImageIcon className="size-4" />
                  {processing ? t("flow.processing") : t("flow.changePhoto")}
                </Button>
              </div>
            ) : null}

            <fieldset className="space-y-2">
              <legend className="mb-2 text-base font-bold">
                {t("flow.chooseCategory")}
              </legend>
              {aiEnabled && analyzing ? (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                  {t("flow.analyzing")}
                </p>
              ) : null}
              {suggestion?.category && suggestion.description ? (
                <div
                  role="status"
                  className="space-y-2 rounded-xl bg-muted p-3 text-sm"
                >
                  <p>
                    {t("flow.aiSees", { description: suggestion.description })}
                  </p>
                  {!note.trim() ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={step === "sending"}
                      onClick={() => {
                        setNote(suggestion.description ?? "");
                        setNoteOpen(true);
                      }}
                    >
                      {t("flow.useAsNote")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                {REPORT_CATEGORIES.map((option) => {
                  const selected = category === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      disabled={step === "sending"}
                      onClick={() => {
                        categoryChosen.current = true;
                        setCategory(option);
                        setSeverityDetail(null);
                        setWaterDepthCm(null);
                      }}
                      className={cn(
                        "relative flex min-h-28 flex-col items-start justify-between gap-2 rounded-2xl border-2 bg-card p-3 text-left transition active:scale-[0.97]",
                        selected
                          ? "border-primary ring-4 ring-primary/30"
                          : "border-border",
                      )}
                    >
                      <span
                        className="flex size-11 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: CATEGORY_COLORS[option] }}
                      >
                        <CategoryIcon category={option} className="size-6" />
                      </span>
                      <span className="text-base leading-tight font-bold">
                        {t(`categories.${option}`)}
                      </span>
                      {suggestion?.category === option ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-xs font-bold">
                          <Sparkles aria-hidden="true" className="size-3" />
                          {t("flow.suggested")}
                        </span>
                      ) : null}
                      {selected ? (
                        <Check className="absolute top-3 right-3 size-5 text-foreground" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {category ? (
                <p className="text-sm text-muted-foreground">
                  {t(`categoryHelp.${category}`)}
                </p>
              ) : null}
            </fieldset>

            {severityInput && severityInput.kind !== "none" ? (
              <fieldset className="space-y-2">
                <legend className="mb-2 text-base font-bold">
                  {severityInput.kind === "depth"
                    ? t("flow.depthQuestion")
                    : category === "broken_cover"
                      ? t("flow.coverQuestion")
                      : t("flow.drainQuestion")}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({t("flow.optional")})
                  </span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {severityInput.kind === "depth"
                    ? severityInput.options.map((depth) => (
                        <ChoiceChip
                          key={depth}
                          selected={waterDepthCm === depth}
                          onClick={() =>
                            setWaterDepthCm(
                              waterDepthCm === depth ? null : depth,
                            )
                          }
                        >
                          {t(
                            `report.depth.${String(depth)}` as "report.depth.5",
                          )}
                        </ChoiceChip>
                      ))
                    : severityInput.options.map((detail) => (
                        <ChoiceChip
                          key={detail}
                          selected={severityDetail === detail}
                          onClick={() =>
                            setSeverityDetail(
                              severityDetail === detail ? null : detail,
                            )
                          }
                        >
                          {t(`report.severity.${detail}`)}
                        </ChoiceChip>
                      ))}
                </div>
              </fieldset>
            ) : null}

            {noteOpen ? (
              <div className="space-y-1">
                <Textarea
                  value={note}
                  maxLength={280}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t("flow.notePlaceholder")}
                  aria-label={t("flow.addNote")}
                  className="min-h-24 rounded-xl text-base"
                />
                <p className="text-right text-xs text-muted-foreground">
                  {t("flow.noteCounter", { count: note.length })}
                </p>
              </div>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setNoteOpen(true)}
                className="h-11 rounded-full px-3 font-semibold"
              >
                + {t("flow.addNote")}
              </Button>
            )}
          </div>

          <footer className="space-y-2 border-t bg-background px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
            {step === "sending" || uploadState === "uploading" ? (
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
              >
                <div
                  className="h-full rounded-full bg-water transition-[width]"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            ) : null}
            <Button
              disabled={!category || step === "sending" || processing}
              onClick={() => void submit()}
              className="h-14 w-full rounded-2xl text-lg font-extrabold"
            >
              {step === "sending" ? (
                <>
                  <LoaderCircle className="size-5 animate-spin" />
                  {uploadState === "uploading"
                    ? t("flow.uploading", {
                        percent: Math.round(progress * 100),
                      })
                    : t("flow.sending")}
                </>
              ) : (
                t("flow.submit")
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t.rich("flow.legalNote", {
                terms: (chunks) => (
                  <Link
                    href="/terminos"
                    className="font-semibold underline underline-offset-2"
                  >
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link
                    href="/privacidad"
                    className="font-semibold underline underline-offset-2"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </footer>
        </div>
      ) : null}
    </>
  );
}

function ChoiceChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border-2 px-4 py-2 text-sm font-semibold transition active:scale-[0.97]",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card",
      )}
    >
      {children}
    </button>
  );
}
