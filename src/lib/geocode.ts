import "server-only";
import { env } from "@/lib/env";

type NominatimResponse = {
  address?: Record<string, string | undefined>;
};

export type ReverseGeocode = {
  address: string | null;
  colonia: string | null;
  municipality: string | null;
  state: string | null;
};

const MIN_INTERVAL_MS = 1100;
let queue: Promise<unknown> = Promise.resolve();
let last = 0;

/**
 * Street, colonia, municipio and state for a point, from OpenStreetMap Nominatim. Calls are spaced
 * ≥ 1 s apart per instance (Nominatim usage policy) and identify the app.
 * Returns null when geocoding is disabled or fails; reports work without it.
 */
export function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocode | null> {
  const contact = env().GEOCODER_CONTACT_EMAIL;
  if (!contact) return Promise.resolve(null);

  const run = async () => {
    const wait = last + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    last = Date.now();
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(lat),
      lon: String(lng),
      zoom: "18",
      addressdetails: "1",
      "accept-language": "es",
    });
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params}`,
      {
        headers: { "User-Agent": `Cauce/0.1 (${contact})` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as NominatimResponse;
    const a = data.address ?? {};
    const street = a.road ?? a.pedestrian ?? a.footway ?? null;
    const address = street
      ? a.house_number
        ? `${street} ${a.house_number}`
        : street
      : null;
    const colonia =
      a.suburb ??
      a.neighbourhood ??
      a.quarter ??
      a.residential ??
      a.city_district ??
      null;
    // In Mexico, OSM tags the municipio as county (alcaldías as borough).
    const municipality =
      a.county ?? a.borough ?? a.municipality ?? a.city ?? a.town ?? null;
    return { address, colonia, municipality, state: a.state ?? null };
  };

  const result = queue.then(run, run).catch(() => null);
  queue = result;
  return result;
}
