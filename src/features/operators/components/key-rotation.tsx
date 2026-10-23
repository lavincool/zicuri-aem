"use client";

import { Copy, KeyRound, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { rotateDeviceKeyAction } from "../server/device-actions";

/** Confirms, rotates, and shows the new key exactly once. */
export function KeyRotation({
  deviceId,
  prefix,
}: {
  deviceId: string;
  prefix: string;
}) {
  const t = useTranslations("operator.key");
  const te = useTranslations("operator.errors");
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rotate = () =>
    startTransition(async () => {
      const result = await rotateDeviceKeyAction(deviceId);
      if ("ok" in result) setKey(result.key);
      else {
        setOpen(false);
        toast.error(
          result.error === "forbidden" ? te("forbidden") : te("notFound"),
        );
      }
    });

  const copy = async () => {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      toast.success(t("copied"));
    } catch {
      // Clipboard can be blocked; the key stays selectable on screen.
    }
  };

  const close = (next: boolean) => {
    if (next || pending) return;
    setOpen(false);
    setKey(null);
  };

  return (
    <section className="space-y-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <KeyRound className="size-5" />
        {t("title")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("body", { prefix })}</p>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-11 rounded-full px-4 font-semibold"
      >
        {t("rotate")}
      </Button>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent showCloseButton={!pending && !key}>
          {key ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-extrabold">
                  {t("newKey")}
                </DialogTitle>
                <DialogDescription>{t("newKeyHelp")}</DialogDescription>
              </DialogHeader>
              <code className="block rounded-lg bg-muted p-3 font-mono text-sm break-all select-all">
                {key}
              </code>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={copy}
                  className="h-11 rounded-full font-semibold"
                >
                  <Copy className="size-4" />
                  {t("copy")}
                </Button>
                <Button
                  onClick={() => close(false)}
                  className="h-11 rounded-full font-bold"
                >
                  {t("done")}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-extrabold">
                  {t("confirmTitle")}
                </DialogTitle>
                <DialogDescription>{t("confirmBody")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => close(false)}
                  className="h-11 rounded-full font-semibold"
                >
                  {t("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={rotate}
                  className="h-11 rounded-full font-bold"
                >
                  {pending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : null}
                  {pending ? t("generating") : t("confirm")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
