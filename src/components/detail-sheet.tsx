"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";

/** From this width, detail sheets float beside the map instead of rising from the bottom. */
export const DESKTOP_SHEET_QUERY = "(min-width: 1024px)";

type SnapPoint = number | string | null;

/**
 * Non-modal detail over the map (a report or a sensor). Phones get a bottom sheet with
 * snap points, tablets the same sheet centered at a readable width, and desktops a
 * floating card at the bottom left that fits its content, with a close button.
 */
export function DetailSheet({
  open,
  onClose,
  title,
  snapPoints,
  snapPoint,
  onSnapPointChange,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Accessible name; the visible heading lives in the content. */
  title: string;
  snapPoints: number[];
  snapPoint: SnapPoint;
  onSnapPointChange: (snapPoint: SnapPoint) => void;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const desktop = useMediaQuery(DESKTOP_SHEET_QUERY);

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      modal={false}
      snapPoints={desktop ? undefined : snapPoints}
      snapPoint={snapPoint}
      onSnapPointChange={onSnapPointChange}
      showSwipeHandle={!desktop}
    >
      <DrawerContent className="shadow-[0_-8px_30px_rgba(11,31,51,0.18)] md:mx-auto md:max-w-lg lg:mx-4 lg:max-h-[calc(100dvh-10rem)] lg:max-w-sm lg:rounded-b-xl lg:border lg:shadow-[0_12px_40px_rgba(11,31,51,0.24)] lg:[--drawer-inset:1rem] lg:after:hidden">
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <DrawerDescription className="sr-only">{title}</DrawerDescription>
        {desktop ? (
          <div className="flex shrink-0 justify-end px-2 pt-2">
            <DrawerClose
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-full"
                  aria-label={t("common.close")}
                />
              }
            >
              <XIcon className="size-5" />
            </DrawerClose>
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-1 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
