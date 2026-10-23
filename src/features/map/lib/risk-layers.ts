import { cellToBoundary } from "h3-js";
import type {
  GeoJSONSourceSpecification,
  LayerSpecification,
} from "maplibre-gl";
import type { RiskLevel } from "@/features/insights/risk/model";

export const RISK_SOURCE = "risk-cells";
export const RISK_LAYERS = {
  fill: "risk-fill",
  outline: "risk-outline",
} as const;

export type RiskCellInput = { h3r8: string; level: RiskLevel; score: number };

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#2bb3bf",
  moderate: "#f0b400",
  high: "#e8701a",
  very_high: "#d7263d",
};

/** Cells below this score stay off the map to keep it readable. */
export const MIN_VISIBLE_SCORE = 10;

export function riskData(
  cells: RiskCellInput[],
): GeoJSONSourceSpecification["data"] {
  return {
    type: "FeatureCollection",
    features: cells
      .filter((cell) => cell.score >= MIN_VISIBLE_SCORE)
      .map((cell) => {
        const ring = cellToBoundary(cell.h3r8, true);
        const first = ring[0];
        return {
          type: "Feature" as const,
          id: cell.h3r8,
          properties: { id: cell.h3r8, level: cell.level, score: cell.score },
          geometry: {
            type: "Polygon" as const,
            coordinates: [first ? [...ring, first] : ring],
          },
        };
      }),
  };
}

export function riskLayers(): LayerSpecification[] {
  const color = [
    "match",
    ["get", "level"],
    "very_high",
    RISK_COLORS.very_high,
    "high",
    RISK_COLORS.high,
    "moderate",
    RISK_COLORS.moderate,
    RISK_COLORS.low,
  ] as unknown as string;
  return [
    {
      id: RISK_LAYERS.fill,
      type: "fill",
      source: RISK_SOURCE,
      paint: {
        "fill-color": color,
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          0.7,
          ["interpolate", ["linear"], ["get", "score"], 10, 0.18, 100, 0.55],
        ],
      },
    },
    {
      id: RISK_LAYERS.outline,
      type: "line",
      source: RISK_SOURCE,
      paint: {
        "line-color": color,
        "line-width": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          3,
          0.8,
        ],
        "line-opacity": 0.9,
      },
    },
  ];
}
