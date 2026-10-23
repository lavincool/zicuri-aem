import { isInsideServiceArea, type LngLat } from "@/config/service-area";

/**
 * Approximate visitor location from Vercel's IP geolocation headers (no permission
 * prompt, city-level accuracy). Null outside Mexico, or when the headers are
 * missing (local development, other hosts).
 */
export function approxLocation(headers: Headers): LngLat | null {
  const latHeader = headers.get("x-vercel-ip-latitude");
  const lngHeader = headers.get("x-vercel-ip-longitude");
  if (headers.get("x-vercel-ip-country") !== "MX" || !latHeader || !lngHeader) {
    return null;
  }
  const lat = Number(latHeader);
  const lng = Number(lngHeader);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return isInsideServiceArea(lng, lat) ? [lng, lat] : null;
}
