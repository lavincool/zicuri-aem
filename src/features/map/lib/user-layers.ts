import type {
  ExpressionSpecification,
  GeoJSONSourceSpecification,
  LayerSpecification,
} from "maplibre-gl";

export const USER_SOURCE = "user-location";
export const USER_LAYERS = {
  accuracy: "user-accuracy",
  dot: "user-dot",
} as const;

export type UserLocation = {
  lng: number;
  lat: number;
  accuracyM: number | null;
};

const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

/** Circle radius in pixels that matches a distance in meters at every zoom. */
export function metersToPixelsExpression(
  meters: number,
  lat: number,
): ExpressionSpecification {
  const atZoom0 =
    (meters * 512) / (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180));
  return [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    0,
    atZoom0,
    22,
    atZoom0 * 2 ** 22,
  ];
}

export function userLocationData(
  location: UserLocation | null,
): GeoJSONSourceSpecification["data"] {
  return {
    type: "FeatureCollection",
    features: location
      ? [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Point",
              coordinates: [location.lng, location.lat],
            },
          },
        ]
      : [],
  };
}

export function userLayers(
  location: UserLocation | null,
): LayerSpecification[] {
  return [
    {
      id: USER_LAYERS.accuracy,
      type: "circle",
      source: USER_SOURCE,
      paint: {
        "circle-color": "#0e7c86",
        "circle-opacity": 0.14,
        "circle-stroke-color": "#0e7c86",
        "circle-stroke-opacity": 0.35,
        "circle-stroke-width": 1,
        "circle-radius":
          location?.accuracyM != null
            ? metersToPixelsExpression(location.accuracyM, location.lat)
            : 0,
      },
    },
    {
      id: USER_LAYERS.dot,
      type: "circle",
      source: USER_SOURCE,
      paint: {
        "circle-color": "#0e7c86",
        "circle-radius": 7,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
    },
  ];
}
