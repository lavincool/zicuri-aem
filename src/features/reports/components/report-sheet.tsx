"use client";

import {
  CheckCircle2,
  Clock,
  Flag,
  LoaderCircle,
  MapPin,
  MoreHorizontal,
  Share2,
  ShieldAlert,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DetailSheet } from "@/components/detail-sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_COLORS } from "@/config/categories";
import { useLiveNow } from "@/hooks/use-live-now";
import { cn } from "@/lib/utils";
import {
  ApiRequestError,
  fetchReport,
  postFlag,
  postSignal,
} from "../client/api";
import { placeLabel } from "../place";
import type { SignalKind } from "../rules";
import { FLAG_REASONS, type ReportDetail } from "../schema";
import { CategoryIcon } from "./category-icon";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; report: ReportDetail }
  | { kind: "not_found" }
  | { kind: "error" };

const SNAP_POINTS = [0.6, 0.94];

export function ReportSheet({
  reportId,
  onClose,
  onResolved,
  onLoaded,
}: {
  reportId: string | null;
  onClose: () => void;
  onResolved?: () => void;
  /** Called with fresh detail so the map can show this pin even if filters hide it. */
  onLoaded?: (report: ReportDetail) => void;
}) {
  const t = useTranslations();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [snapPoint, setSnapPoint] = useState<number | string | null>(
    SNAP_POINTS[0] ?? null,
  );
  const [reload, setReload] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload is an intentional retry trigger; onLoaded is a notification, not an input.
  useEffect(() => {
    if (!reportId) return;
    const controller = new AbortController();
    setState({ kind: "loading" });
    setSnapPoint(SNAP_POINTS[0] ?? null);
    fetchReport(reportId, controller.signal)
      .then((report) => {
        setState({ kind: "ready", report });
        onLoaded?.(report);
      })
      .catch((error: unknown) => {
        if ((error as Error).name === "AbortError") return;
        setState(
          error instanceof ApiRequestError && error.status === 404
            ? { kind: "not_found" }
            : { kind: "error" },
        );
      });
    return () => controller.abort();
  }, [reportId, reload]);

  return (
    <DetailSheet
      open={reportId !== null}
      onClose={onClose}
      title={t("report.sheetTitle")}
      snapPoints={SNAP_POINTS}
      snapPoint={snapPoint}
      onSnapPointChange={setSnapPoint}
    >
      {state.kind === "loading" ? <SheetSkeleton /> : null}
      {state.kind === "not_found" ? (
        <p className="py-10 text-center text-lg font-semibold">
          {t("report.notFound")}
        </p>
      ) : null}
      {state.kind === "error" ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-lg font-semibold">{t("report.loadError")}</p>
          <Button
            className="h-11 rounded-full px-5 font-bold"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("common.retry")}
          </Button>
        </div>
      ) : null}
      {state.kind === "ready" ? (
        <ReportBody
          report={state.report}
          onChange={(report) => setState({ kind: "ready", report })}
          onResolved={onResolved}
        />
      ) : null}
    </DetailSheet>
  );
}

function SheetSkeleton() {
  return (
    <div className="space-y-4 py-2" aria-hidden="true">
      <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="h-14 rounded-2xl" />
      </div>
    </div>
  );
}

function ReportBody({
  report,
  onChange,
  onResolved,
}: {
  report: ReportDetail;
  onChange: (report: ReportDetail) => void;
  onResolved?: () => void;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const now = useLiveNow(60_000);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [pending, setPending] = useState<SignalKind | null>(null);
  const [thumbLoaded, setThumbLoaded] = useState(false);

  const categoryLabel = t(`categories.${report.category}`);
  const place = placeLabel(report) ?? t("report.unknownPlace");
  const isOpen = report.status === "open";

  const severityLabel =
    report.waterDepthCm !== null
      ? t(`report.depth.${String(report.waterDepthCm)}` as "report.depth.5")
      : report.severityDetail
        ? t(`report.severity.${report.severityDetail}`)
        : null;

  const signal = useCallback(
    async (kind: SignalKind) => {
      if (pending || report.mySignal === kind) return;
      const previous = report;
      // Optimistic update; rolled back on error.
      const optimistic = { ...report, mySignal: kind };
      if (report.mySignal === "still_there") optimistic.stillThereCount -= 1;
      if (report.mySignal === "fixed") optimistic.fixedCount -= 1;
      if (kind === "still_there") optimistic.stillThereCount += 1;
      else optimistic.fixedCount += 1;
      onChange(optimistic);
      setPending(kind);
      try {
        const result = await postSignal(report.id, kind);
        onChange({
          ...optimistic,
          status: result.status,
          stillThereCount: result.stillThereCount,
          fixedCount: result.fixedCount,
          resolvedAt: result.statusChanged
            ? new Date().toISOString()
            : optimistic.resolvedAt,
        });
        if (result.statusChanged) {
          toast.success(t("report.nowResolved"));
          onResolved?.();
        } else {
          toast.success(
            kind === "fixed"
              ? t("report.thanksFixed")
              : t("report.thanksStillThere"),
          );
        }
      } catch {
        onChange(previous);
        toast.error(t("report.signalError"));
      } finally {
        setPending(null);
      }
    },
    [onChange, onResolved, pending, report, t],
  );

  const share = useCallback(async () => {
    const url = `${window.location.origin}/r/${report.id}`;
    const text = t("report.shareText", { category: categoryLabel, place });
    try {
      if (navigator.share) {
        await navigator.share({ title: categoryLabel, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success(t("report.linkCopied"));
    } catch {
      // The user closed the share sheet; nothing to do.
    }
  }, [categoryLabel, place, report.id, t]);

  const flag = useCallback(
    async (reason: (typeof FLAG_REASONS)[number]) => {
      try {
        await postFlag(report.id, reason);
        onChange({ ...report, myFlagged: true });
        toast.success(t("report.flagThanks"));
      } catch {
        toast.error(t("report.signalError"));
      }
    },
    [onChange, report, t],
  );

  return (
    <article className="space-y-4">
      <button
        type="button"
        onClick={() => setPhotoOpen(true)}
        aria-label={t("report.openPhoto")}
        className="relative block aspect-[16/9] max-h-56 w-full overflow-hidden rounded-2xl"
        style={{ backgroundColor: report.photo.color ?? undefined }}
      >
        {/* biome-ignore lint/performance/noImgElement: photos come from R2/public with their own sizing; next/image optimization is not used for user uploads. */}
        <img
          src={report.photo.thumbUrl}
          alt={t("report.photoAlt", { category: categoryLabel })}
          onLoad={() => setThumbLoaded(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            thumbLoaded ? "opacity-100" : "opacity-0",
          )}
        />
        {report.isDemo ? (
          <span className="absolute bottom-2 left-2 rounded-full bg-navy/80 px-2.5 py-1 text-xs font-semibold text-white">
            {t("report.illustrationNote")}
          </span>
        ) : null}
      </button>
      {report.photo.credit ? (
        <p className="-mt-3 text-xs text-muted-foreground">
          <a
            href={report.photo.credit.source}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            {t("report.photoCredit", {
              author: report.photo.credit.author,
            })}
          </a>
          {" · "}
          {report.photo.credit.licenseUrl ? (
            <a
              href={report.photo.credit.licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {report.photo.credit.license}
            </a>
          ) : (
            report.photo.credit.license
          )}
          {" · "}
          {t("report.photoAdaptation")}
        </p>
      ) : null}

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: CATEGORY_COLORS[report.category] }}
          >
            <CategoryIcon category={report.category} className="size-5" />
          </span>
          <h2 className="font-display text-2xl leading-tight font-extrabold">
            {categoryLabel}
          </h2>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" />
            {t("report.reportedAgo", {
              time: format.relativeTime(new Date(report.createdAt), now),
            })}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-4" />
            {report.address ? `${report.address}, ${place}` : place}
          </span>
        </p>
        {severityLabel ? (
          <p className="inline-flex rounded-full bg-secondary px-3 py-1 text-sm font-semibold">
            {severityLabel}
          </p>
        ) : null}
        {report.note ? (
          <p className="rounded-xl bg-muted px-3 py-2 text-base">
            {report.note}
          </p>
        ) : null}
      </header>

      {report.status === "resolved" ? (
        <p className="flex items-start gap-2 rounded-xl bg-success/12 px-3 py-2.5 text-sm font-semibold text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          {t("report.resolvedBanner", {
            date: report.resolvedAt
              ? format.relativeTime(new Date(report.resolvedAt), now)
              : "",
          })}
        </p>
      ) : null}
      {report.status === "expired" ? (
        <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm font-semibold text-muted-foreground">
          <Clock className="mt-0.5 size-4 shrink-0" />
          {t("report.expiredBanner")}
        </p>
      ) : null}

      <section aria-labelledby="signal-question" className="space-y-2">
        <h3 id="signal-question" className="text-base font-bold">
          {t("report.signalQuestion")}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {(["still_there", "fixed"] as const).map((kind) => {
            const selected = report.mySignal === kind;
            return (
              <Button
                key={kind}
                variant="outline"
                disabled={!isOpen || pending !== null}
                aria-pressed={selected}
                onClick={() => void signal(kind)}
                className={cn(
                  "h-14 rounded-2xl text-base font-bold",
                  selected &&
                    kind === "still_there" &&
                    "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                  selected &&
                    kind === "fixed" &&
                    "border-success bg-success text-white hover:bg-success/90",
                )}
              >
                {pending === kind ? (
                  <LoaderCircle className="size-5 animate-spin" />
                ) : kind === "fixed" ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <ShieldAlert className="size-5" />
                )}
                {t(kind === "fixed" ? "report.fixed" : "report.stillThere")}
              </Button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("report.stillThereCount", { count: report.stillThereCount })}
          {report.fixedCount > 0
            ? ` · ${t("report.fixedCount", { count: report.fixedCount })}`
            : null}
        </p>
      </section>

      <footer className="flex items-center justify-between gap-2 border-t pt-3">
        <Button
          variant="ghost"
          className="h-11 gap-2 rounded-full px-4 text-base font-semibold"
          onClick={() => void share()}
        >
          <Share2 className="size-5" />
          {t("report.share")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-11 rounded-full"
                aria-label={t("report.more")}
              />
            }
          >
            <MoreHorizontal className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-60 p-1.5">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2">
                <Flag className="size-4" />
                {report.myFlagged ? t("report.flagged") : t("report.flag")}
              </DropdownMenuLabel>
              {FLAG_REASONS.map((reason) => (
                <DropdownMenuItem
                  key={reason}
                  disabled={report.myFlagged}
                  onClick={() => void flag(reason)}
                  className="min-h-11 text-base"
                >
                  {t(`report.flagReasons.${reason}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </footer>

      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="max-w-[min(96vw,64rem)] p-2">
          <DialogTitle className="sr-only">{categoryLabel}</DialogTitle>
          <DialogDescription className="sr-only">{place}</DialogDescription>
          {/* biome-ignore lint/performance/noImgElement: full-size photo from storage. */}
          <img
            src={report.photo.fullUrl}
            alt={t("report.photoAlt", { category: categoryLabel })}
            className="max-h-[85dvh] w-full rounded-lg object-contain"
          />
        </DialogContent>
      </Dialog>
    </article>
  );
}
