import { type NextRequest, NextResponse } from "next/server";
import { isValidPanelToken, PANEL_COOKIE } from "@/lib/panel-auth";
import {
  BROWSER_COOKIE,
  BROWSER_HEADER,
  createBrowserToken,
  unsign,
} from "@/lib/signing";

const ONE_YEAR_S = 60 * 60 * 24 * 365;

/**
 * Guards the authorities panel and gives every browser a signed anonymous ID
 * (one signal per browser per report, rate limits). A new ID is also forwarded as a
 * request header so the first request can use it before the cookie round-trips.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protectedPanel =
    (pathname.startsWith("/panel") && pathname !== "/panel/entrar") ||
    pathname.startsWith("/api/insights");
  if (
    protectedPanel &&
    !isValidPanelToken(request.cookies.get(PANEL_COOKIE)?.value)
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Panel session required" } },
        { status: 401 },
      );
    }
    const login = request.nextUrl.clone();
    login.pathname = "/panel/entrar";
    login.search = "";
    return NextResponse.redirect(login);
  }

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
