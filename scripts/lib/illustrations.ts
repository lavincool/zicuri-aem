/**
 * Category illustrations used as stand-in photos for seeded reports until real
 * photos are added to public/seed/photos/<category>/.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CATEGORY_COLORS,
  REPORT_CATEGORIES,
  type ReportCategory,
} from "@/config/categories";
import { CATEGORY_ICON_PATHS } from "@/config/category-icons";

export const ILLUSTRATION_VARIANTS = 2;
const DIR = path.join(process.cwd(), "public/seed/illustrations");

function illustration(category: ReportCategory, variant: number): string {
  const color = CATEGORY_COLORS[category];
  const angle = variant === 0 ? "0 0 1 1" : "1 0 0 1";
  const [x1, y1, x2, y2] = angle.split(" ");
  const rain = Array.from({ length: 18 }, (_, i) => {
    const x = (i * 37 + variant * 19) % 420;
    const y = (i * 53 + variant * 31) % 300;
    return `<path d="M${x} ${y}l-14 34" />`;
  }).join("");
  const glyph = CATEGORY_ICON_PATHS[category]
    .map((d) => `<path d="${d}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="1600" height="1200">
  <defs>
    <linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
      <stop offset="0" stop-color="${color}"/>
      <stop offset="1" stop-color="#0b1f33"/>
    </linearGradient>
  </defs>
  <rect width="400" height="300" fill="url(#g)"/>
  <g stroke="#ffffff" stroke-opacity="0.12" stroke-width="3" stroke-linecap="round">${rain}</g>
  <circle cx="200" cy="150" r="78" fill="#0b1f33" fill-opacity="0.28"/>
  <g transform="translate(140 90) scale(5)" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
</svg>
`;
}

export function illustrationKey(
  category: ReportCategory,
  variant: number,
): string {
  return `seed/illustrations/${category}-${variant + 1}.svg`;
}

export async function writeIllustrations(): Promise<void> {
  await mkdir(DIR, { recursive: true });
  for (const category of REPORT_CATEGORIES) {
    for (let v = 0; v < ILLUSTRATION_VARIANTS; v++) {
      await writeFile(
        path.join(DIR, `${category}-${v + 1}.svg`),
        illustration(category, v),
      );
    }
  }
}
