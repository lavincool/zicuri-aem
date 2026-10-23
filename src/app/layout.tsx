import type { Metadata, Viewport } from "next";
import {
  Atkinson_Hyperlegible_Next,
  Bricolage_Grotesque,
} from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { LocalTimeZone } from "@/components/local-time-zone";
import { Providers } from "@/components/providers";
import { appUrl } from "@/lib/env";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const body = Atkinson_Hyperlegible_Next({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  // next/font has no fallback metrics for this family yet.
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    metadataBase: new URL(appUrl()),
    title: { default: t("appName"), template: `%s · ${t("appName")}` },
    description: t("description"),
    applicationName: t("appName"),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#07131f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-MX"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <LocalTimeZone>
            <Providers>{children}</Providers>
          </LocalTimeZone>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
