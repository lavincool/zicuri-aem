import type { ReportCategory } from "./categories";

/**
 * Category glyphs as 24×24 stroke paths (lucide conventions: stroke 2, round caps).
 * Shared by the React icon component and the map, which rasterizes them.
 */
export const CATEGORY_ICON_PATHS: Record<ReportCategory, string[]> = {
  blocked_drain: [
    "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
    "M8 5v14",
    "M12 5v14",
    "M16 5v14",
    "M3 14c2.5-2 5-2 7 0s4.5 2 7 0 3-1.5 4-1",
  ],
  broken_cover: [
    "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0",
    "M12 3l-1.5 5 3 2.5-2.5 4 1.5 6.5",
  ],
  flooded_street: [
    "M5 11l7-6 7 6",
    "M7 9.5V13",
    "M17 9.5V13",
    "M2 16c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0",
    "M2 20.5c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0",
  ],
  overflowing_canal: [
    "M4 10v8h16v-8",
    "M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0 2 1 2 1",
    "M4 12l-1.5 3",
    "M20 12l1.5 3",
  ],
  sewage_backflow: [
    "M4 20h16",
    "M12 16V5",
    "M8 9l4-4 4 4",
    "M6 13.5a1.5 1.5 0 1 0 0 .01",
    "M18 13.5a1.5 1.5 0 1 0 0 .01",
  ],
  other: [
    "M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0",
    "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3",
    "M12 17h.01",
  ],
};

export function categoryIconSvg(
  category: ReportCategory,
  { size = 24, stroke = "currentColor", strokeWidth = 2 } = {},
): string {
  const paths = CATEGORY_ICON_PATHS[category]
    .map((d) => `<path d="${d}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}
