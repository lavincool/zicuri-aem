import type {
  GeoJSONSourceSpecification,
  LayerSpecification,
  Map as MapLibreMap,
} from "maplibre-gl";
import { DEVICE_LEVELS, LEVEL_COLORS } from "@/config/devices";

export const SENSORS_SOURCE = "sensors";
export const SENSOR_LAYERS = {
  halo: "sensor-halo",
  icons: "sensor-icons",
} as const;

const PIXEL_RATIO = 2;
const SIZE = 34;

/** Rounded-square gauge (never mistaken for a round report pin). */
function sensorSvg(color: string, offline: boolean): string {
  const s = SIZE * PIXEL_RATIO;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 34 34">
  <rect x="2" y="2" width="30" height="30" rx="9" fill="${color}" stroke="#ffffff" stroke-width="2.5" ${offline ? 'stroke-dasharray="4 3"' : ""}/>
  <g fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round">
    <path d="M11 9v16"/><path d="M11 11h4"/><path d="M11 15h3"/><path d="M11 19h4"/>
    <path d="M17 21c1.6-1.3 3.2 1.3 4.8 0s3.2-1.3 4.2 0"/>
    <path d="M17 25c1.6-1.3 3.2 1.3 4.8 0s3.2-1.3 4.2 0"/>
  </g>
</svg>`;
}

let images: Promise<Map<string, ImageData>> | null = null;

function rasterize(svg: string): Promise<ImageData> {
  const size = SIZE * PIXEL_RATIO;
  return new Promise((resolve, reject) => {
    const image = new Image(size, size);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("2D canvas unavailable"));
      context.drawImage(image, 0, 0, size, size);
      resolve(context.getImageData(0, 0, size, size));
    };
    image.onerror = reject;
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export async function ensureSensorImages(map: MapLibreMap): Promise<void> {
  images ??= Promise.all(
    DEVICE_LEVELS.map(
      async (level) =>
        [
          `sensor-${level}`,
          await rasterize(sensorSvg(LEVEL_COLORS[level], level === "offline")),
        ] as const,
    ),
  ).then((entries) => new Map(entries));
  for (const [id, data] of await images) {
    if (!map.hasImage(id)) map.addImage(id, data, { pixelRatio: PIXEL_RATIO });
  }
}

export function sensorsSource(
  data: GeoJSONSourceSpecification["data"],
): GeoJSONSourceSpecification {
  return { type: "geojson", data, promoteId: "id" };
}

export function sensorLayers(theme: "light" | "dark"): LayerSpecification[] {
  return [
    {
      id: SENSOR_LAYERS.halo,
      type: "circle",
      source: SENSORS_SOURCE,
      paint: {
        "circle-color": [
          "match",
          ["get", "l"],
          "critical",
          LEVEL_COLORS.critical,
          "warning",
          LEVEL_COLORS.warning,
          "#000000",
        ],
        "circle-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          0.35,
          ["match", ["get", "l"], ["critical", "warning"], 0.28, 0],
        ],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 16, 16, 30],
      },
    },
    {
      id: SENSOR_LAYERS.icons,
      type: "symbol",
      source: SENSORS_SOURCE,
      layout: {
        "icon-image": ["concat", "sensor-", ["get", "l"]],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.75, 16, 1],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "text-field": [
          "case",
          ["all", ["has", "cm"], ["!=", ["get", "l"], "offline"]],
          ["concat", ["to-string", ["get", "cm"]], " cm"],
          "",
        ],
        "text-font": ["Noto Sans Bold"],
        "text-size": 12,
        "text-offset": [0, 1.7],
        "text-anchor": "top",
        "text-optional": true,
      },
      minzoom: 0,
      paint: {
        "text-color": theme === "dark" ? "#eef2f6" : "#0b1f33",
        "text-halo-color": theme === "dark" ? "#0a1826" : "#ffffff",
        "text-halo-width": 1.6,
      },
    },
  ];
}
