import type { Map as MapLibreMap } from "maplibre-gl";
import { REPORT_CATEGORIES } from "@/config/categories";
import { categoryIconSvg } from "@/config/category-icons";
import { categoryImageId } from "./report-layers";

const PIXEL_RATIO = 2;
const SIZE = 24 * PIXEL_RATIO;

let cache: Promise<Map<string, ImageData>> | null = null;

function rasterize(svg: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const image = new Image(SIZE, SIZE);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("2D canvas unavailable"));
      context.drawImage(image, 0, 0, SIZE, SIZE);
      resolve(context.getImageData(0, 0, SIZE, SIZE));
    };
    image.onerror = reject;
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function loadImages(): Promise<Map<string, ImageData>> {
  cache ??= Promise.all(
    REPORT_CATEGORIES.map(async (category) => {
      const svg = categoryIconSvg(category, {
        size: SIZE,
        stroke: "#ffffff",
        strokeWidth: 2.4,
      });
      return [categoryImageId(category), await rasterize(svg)] as const;
    }),
  ).then((entries) => new Map(entries));
  return cache;
}

/** Adds the white category glyphs used on report pins (idempotent; images are lost on setStyle). */
export async function ensureCategoryImages(map: MapLibreMap): Promise<void> {
  const images = await loadImages();
  for (const [id, data] of images) {
    if (!map.hasImage(id)) map.addImage(id, data, { pixelRatio: PIXEL_RATIO });
  }
}
