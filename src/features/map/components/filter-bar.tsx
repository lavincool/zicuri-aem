"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CATEGORY_COLORS,
  REPORT_CATEGORIES,
  type ReportCategory,
} from "@/config/categories";
import { CategoryIcon } from "@/features/reports/components/category-icon";
import {
  SINCE_OPTIONS,
  type SinceOption,
  STATUS_FILTERS,
  type StatusFilter,
} from "@/features/reports/schema";
import { cn } from "@/lib/utils";
import type { ReportFilters } from "../hooks/use-reports-feed";

const chip =
  "h-10 shrink-0 gap-1.5 rounded-full border-0 bg-card/95 px-3.5 text-sm font-semibold text-foreground shadow-md ring-1 ring-foreground/10 backdrop-blur hover:bg-card";

export function FilterBar({
  filters,
  onChange,
}: {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
}) {
  const t = useTranslations();

  const toggleCategory = (category: ReportCategory) => {
    const selected = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category];
    onChange({
      ...filters,
      categories: selected.length === REPORT_CATEGORIES.length ? [] : selected,
    });
  };

  return (
    <nav
      aria-label={t("filters.label")}
      className="pointer-events-auto flex snap-x gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" className={chip} />}
        >
          {t(`filters.statusOptions.${filters.status}`)}
          <ChevronDown className="size-4 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 p-1.5">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("filters.status")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.status}
              onValueChange={(value) =>
                onChange({ ...filters, status: value as StatusFilter })
              }
            >
              {STATUS_FILTERS.map((status) => (
                <DropdownMenuRadioItem
                  key={status}
                  value={status}
                  closeOnClick
                  className="min-h-11 text-base"
                >
                  {t(`filters.statusOptions.${status}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" className={chip} />}
        >
          {t(`filters.sinceOptions.${filters.since}`)}
          <ChevronDown className="size-4 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-44 p-1.5">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("filters.since")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.since}
              onValueChange={(value) =>
                onChange({ ...filters, since: value as SinceOption })
              }
            >
              {SINCE_OPTIONS.map((since) => (
                <DropdownMenuRadioItem
                  key={since}
                  value={since}
                  closeOnClick
                  className="min-h-11 text-base"
                >
                  {t(`filters.sinceOptions.${since}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {REPORT_CATEGORIES.map((category) => {
        const active =
          filters.categories.length === 0 ||
          filters.categories.includes(category);
        return (
          <Button
            key={category}
            variant="outline"
            aria-pressed={filters.categories.includes(category)}
            onClick={() => toggleCategory(category)}
            className={cn(chip, "snap-start", !active && "opacity-55")}
          >
            <span
              className="flex size-6 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: CATEGORY_COLORS[category] }}
            >
              <CategoryIcon category={category} className="size-4" />
            </span>
            {t(`categories.${category}`)}
          </Button>
        );
      })}
    </nav>
  );
}
