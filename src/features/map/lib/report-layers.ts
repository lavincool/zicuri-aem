import type {
  ExpressionSpecification,
  GeoJSONSourceSpecification,
  LayerSpecification,
} from "maplibre-gl";
import {
  CATEGORY_COLORS,
  REPORT_CATEGORIES,
  type ReportCategory,
} from "@/config/categories";

export const REPORTS_SOURCE = "reports";

export const REPORT_LAYERS = {
  clusters: "report-clusters",
  clusterCount: "report-cluster-count",
  points: "report-points",
  icons: "report-icons",
} as const;

const RESOLVED_COLOR = "#8a96a3";
const FONT = ["Noto Sans Bold"];

export const categoryImageId = (category: ReportCategory) => `cat-${category}`;

const categoryColor = [
  "match",
  ["get", "c"],
  ...REPORT_CATEGORIES.flatMap((c) => [c, CATEGORY_COLORS[c]]),
  CATEGORY_COLORS.other,
] as unknown as ExpressionSpecification;

/** Cluster color = the most common category inside it (ties go to the first in order). */
const dominantCategoryColor: ExpressionSpecification = [
  "case",
  ...REPORT_CATEGORIES.flatMap((c) => [
    [
      "all",
      ...REPORT_CATEGORIES.filter((o) => o !== c).map(
        (o): ExpressionSpecification => [">=", ["get", c], ["get", o]],
      ),
    ] as ExpressionSpecification,
    CATEGORY_COLORS[c],
  ]),
  "#0b1f33",
] as ExpressionSpecification;

export function reportsSource(
  data: GeoJSONSourceSpecification["data"],
): GeoJSONSourceSpecification {
  return {
    type: "geojson",
    data,
    promoteId: "id",
    cluster: true,
    clusterRadius: 46,
    clusterMaxZoom: 15,
    clusterProperties: Object.fromEntries(
      REPORT_CATEGORIES.map((c) => [
        c,
        ["+", ["case", ["==", ["get", "c"], c], 1, 0]],
      ]),
    ),
  };
}

export function reportLayers(theme: "light" | "dark"): LayerSpecification[] {
  const stroke = theme === "dark" ? "#0e2236" : "#ffffff";
  return [
    {
      id: REPORT_LAYERS.clusters,
      type: "circle",
      source: REPORTS_SOURCE,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": dominantCategoryColor,
        "circle-opacity": 0.92,
        "circle-radius": [
          "step",
          ["get", "point_count"],
          17,
          10,
          21,
          50,
          27,
          200,
          33,
        ],
        "circle-stroke-width": 3,
        "circle-stroke-color": stroke,
      },
    },
    {
      id: REPORT_LAYERS.clusterCount,
      type: "symbol",
      source: REPORTS_SOURCE,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": FONT,
        "text-size": 13,
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "rgba(11,31,51,0.45)",
        "text-halo-width": 1,
      },
    },
    {
      id: REPORT_LAYERS.points,
      type: "circle",
      source: REPORTS_SOURCE,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": [
          "case",
          ["==", ["get", "s"], "resolved"],
          RESOLVED_COLOR,
          categoryColor,
        ],
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          11,
          5,
          14,
          10,
          17,
          15,
        ],
        "circle-opacity": ["case", ["==", ["get", "s"], "expired"], 0.4, 1],
        "circle-stroke-width": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          4,
          2.5,
        ],
        "circle-stroke-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          "#ffb000",
          stroke,
        ],
        "circle-stroke-opacity": [
          "case",
          ["==", ["get", "s"], "expired"],
          0.5,
          1,
        ],
      },
    },
    {
      id: REPORT_LAYERS.icons,
      type: "symbol",
      source: REPORTS_SOURCE,
      filter: ["!", ["has", "point_count"]],
      minzoom: 13,
      layout: {
        "icon-image": ["concat", "cat-", ["get", "c"]],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.55, 17, 0.9],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-opacity": ["case", ["==", ["get", "s"], "expired"], 0.5, 1],
      },
    },
  ];
}
