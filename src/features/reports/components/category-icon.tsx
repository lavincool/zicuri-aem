import type { ReportCategory } from "@/config/categories";
import { CATEGORY_ICON_PATHS } from "@/config/category-icons";
import { cn } from "@/lib/utils";

export function CategoryIcon({
  category,
  className,
}: {
  category: ReportCategory;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-5 shrink-0", className)}
      aria-hidden="true"
    >
      {CATEGORY_ICON_PATHS[category].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
