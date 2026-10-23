"use client";

import { CircleHelp, Menu } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const floatingButton =
  "size-12 rounded-full bg-card/95 text-foreground shadow-md ring-1 ring-foreground/10 backdrop-blur hover:bg-card";

export function TopBar({ onOpenLegend }: { onOpenLegend: () => void }) {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();

  return (
    <header className="pointer-events-none flex items-center justify-between gap-2 px-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
      <div className="pointer-events-auto rounded-full bg-card/95 py-1.5 pr-4 pl-2 shadow-md ring-1 ring-foreground/10 backdrop-blur">
        <Logo />
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={floatingButton}
          onClick={onOpenLegend}
          aria-label={t("legend.open")}
        >
          <CircleHelp className="size-6" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className={floatingButton}
                aria-label={t("menu.open")}
              />
            }
          >
            <Menu className="size-6" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-1.5">
            <DropdownMenuItem
              render={<Link href="/acerca" />}
              className="min-h-11 text-base"
            >
              {t("menu.about")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("menu.theme")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={theme ?? "system"}
                onValueChange={(value) => setTheme(String(value))}
              >
                {(
                  [
                    ["system", "menu.themeSystem"],
                    ["light", "menu.themeLight"],
                    ["dark", "menu.themeDark"],
                  ] as const
                ).map(([value, label]) => (
                  <DropdownMenuRadioItem
                    key={value}
                    value={value}
                    className="min-h-11 text-base"
                  >
                    {t(label)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
