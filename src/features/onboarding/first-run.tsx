"use client";

import { Camera, CheckCircle2, Map as MapIcon, Share, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  INSTALL_HINT_KEY,
  ONBOARDING_KEY,
  readFlag,
  VISITS_KEY,
  writeFlag,
} from "./storage";

const SLIDES = [
  { key: "report", icon: Camera },
  { key: "map", icon: MapIcon },
  { key: "signals", icon: CheckCircle2 },
] as const;

const COACHMARK_MS = 6000;

/** Count each page load once, even if the component remounts. */
let visitsCounted = false;

type Phase = "idle" | "intro" | "coachmark" | "done";

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return /iPad|iPhone|iPod/.test(ua) && !standalone;
}

/**
 * First-run experience: a skippable 3-card intro over the live map, then a coach
 * mark on the Report button. Also nudges iOS users to install on their second visit.
 */
export function FirstRun({ enabled }: { enabled: boolean }) {
  const t = useTranslations("onboarding");
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [index, setIndex] = useState(0);
  const [installHint, setInstallHint] = useState(false);

  useEffect(() => {
    let visits = Number(readFlag(VISITS_KEY) ?? "0");
    if (!visitsCounted) {
      visitsCounted = true;
      visits += 1;
      writeFlag(VISITS_KEY, String(visits));
    }
    if (!enabled) return;
    if (readFlag(ONBOARDING_KEY) !== "done") {
      setPhase("intro");
    } else if (
      visits >= 2 &&
      readFlag(INSTALL_HINT_KEY) !== "dismissed" &&
      isIosSafari()
    ) {
      setInstallHint(true);
    }
  }, [enabled]);

  useEffect(() => {
    if (phase !== "coachmark") return;
    const timer = setTimeout(() => setPhase("done"), COACHMARK_MS);
    const dismiss = () => setPhase("done");
    window.addEventListener("pointerdown", dismiss, { once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", dismiss);
    };
  }, [phase]);

  const finish = () => {
    writeFlag(ONBOARDING_KEY, "done");
    setPhase("coachmark");
  };

  const slide = SLIDES[index] ?? SLIDES[0];
  const Icon = slide.icon;
  const last = index === SLIDES.length - 1;

  return (
    <>
      <AnimatePresence>
        {phase === "intro" ? (
          <motion.div
            key="intro"
            role="dialog"
            aria-modal="true"
            aria-label={t("label")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end bg-navy/55 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] backdrop-blur-[2px] sm:items-center sm:justify-center"
          >
            <div className="w-full max-w-md overflow-hidden rounded-3xl bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">
                  {t("step", { current: index + 1, total: SLIDES.length })}
                </p>
                <Button
                  variant="ghost"
                  onClick={finish}
                  className="h-10 rounded-full px-3 font-semibold"
                >
                  {t("skip")}
                </Button>
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={slide.key}
                  initial={
                    reduceMotion ? { opacity: 0 } : { opacity: 0, x: 40 }
                  }
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -40 }}
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  className="space-y-3 py-5"
                >
                  <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <Icon className="size-8" />
                  </span>
                  <h2 className="text-3xl leading-tight font-extrabold">
                    {t(`slides.${slide.key}.title`)}
                  </h2>
                  <p className="text-lg text-muted-foreground">
                    {t(`slides.${slide.key}.body`)}
                  </p>
                </motion.div>
              </AnimatePresence>
              <div className="flex items-center justify-between gap-4">
                <div className="flex gap-1.5" aria-hidden="true">
                  {SLIDES.map((s, i) => (
                    <span
                      key={s.key}
                      className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-2 bg-border"}`}
                    />
                  ))}
                </div>
                <Button
                  onClick={() => (last ? finish() : setIndex(index + 1))}
                  className="h-14 rounded-2xl px-7 text-lg font-extrabold"
                >
                  {last ? t("start") : t("next")}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {phase === "coachmark" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(env(safe-area-inset-bottom),1.25rem)] z-30 flex flex-col items-center">
          <motion.p
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mb-3 rounded-2xl bg-navy px-4 py-2.5 text-base font-bold text-white shadow-lg"
            role="status"
          >
            {t("coachmark")}
            <span className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-navy" />
          </motion.p>
          <span className="h-16 w-44 animate-ping rounded-full ring-4 ring-primary/70" />
        </div>
      ) : null}

      {installHint ? (
        <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-30 mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-card p-4 shadow-xl ring-1 ring-foreground/10">
          <Share className="mt-0.5 size-5 shrink-0" />
          <div className="flex-1">
            <p className="font-bold">{t("installTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("installBody")}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("dismiss")}
            onClick={() => {
              writeFlag(INSTALL_HINT_KEY, "dismissed");
              setInstallHint(false);
            }}
            className="size-9 rounded-full"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}
    </>
  );
}
