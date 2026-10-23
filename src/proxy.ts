import { type NextRequest, NextResponse } from "next/server";
import {
  BROWSER_COOKIE,
  BROWSER_HEADER,
  createBrowserToken,
  unsign,
} from "@/lib/signing";

const ONE_YEAR_S = 60 * 60 * 24 * 365;

/**
 * Gives every browser a signed anonymous ID (one signal per browser per report,
 * rate limits). The new token is also forwarded as a request header so the very
 * first request can use it before the cookie round-trips.
 */
export function proxy(request: NextRequest) {
  const current = request.cookies.get(BROWSER_COOKIE)?.value;
  if (current && unsign(current)) return NextResponse.next();

  const token = createBrowserToken();
  const headers = new Headers(request.headers);
  headers.set(BROWSER_HEADER, token);
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(BROWSER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_S,
    path: "/",
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/|map/|seed/|icons/|favicon.ico|sw.js|manifest.webmanifest|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico|json|mjs|js|css|txt)$).*)",
  ],
};
