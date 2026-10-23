import { NextResponse } from "next/server";
import { approxLocation } from "@/features/map/ip-location";

/** Approximate visitor location, used to open the map on their city. */
export function GET(request: Request) {
  return NextResponse.json(
    { center: approxLocation(request.headers) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
