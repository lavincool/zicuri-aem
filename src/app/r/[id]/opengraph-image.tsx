import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { CATEGORY_COLORS } from "@/config/categories";
import { CATEGORY_ICON_PATHS } from "@/config/category-icons";
import { getReportSummary } from "@/features/reports/server/queries";
import { appUrl } from "@/lib/env";
import { photoUrl } from "@/lib/storage/urls";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Cauce";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [summary, t] = await Promise.all([
    getReportSummary(id),
    getTranslations(),
  ]);
  const category = summary?.category ?? "other";
  const color = CATEGORY_COLORS[category];
  const label = summary ? t(`categories.${category}`) : t("common.appName");
  const place = summary?.colonia ?? t("report.unknownPlace");
  // Satori renders JPEG/PNG photos; seed illustrations (SVG) fall back to category art.
  const thumb =
    summary && !summary.thumbKey.endsWith(".svg")
      ? new URL(photoUrl(summary.thumbKey), appUrl()).toString()
      : null;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: "#0b1f33",
        color: "#ffffff",
      }}
    >
      <div
        style={{
          width: 560,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: `linear-gradient(135deg, ${color}, #0b1f33)`,
        }}
      >
        {thumb ? (
          // biome-ignore lint/performance/noImgElement: Satori only renders plain img elements.
          <img
            src={thumb}
            alt=""
            width={560}
            height={630}
            style={{ objectFit: "cover", width: 560, height: 630 }}
          />
        ) : (
          <svg
            width="240"
            height="240"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {CATEGORY_ICON_PATHS[category].map((d) => (
              <path key={d} d={d} />
            ))}
          </svg>
        )}
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 56px 48px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="56" height="56" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="2" y="2" width="28" height="28" rx="8" fill="#ffb000" />
            {[11, 16.5, 22].map((y) => (
              <path
                key={y}
                d={`M8 ${y}c2.7-2 5.3 2 8 0s5.3-2 8 0`}
                fill="none"
                stroke="#0b1f33"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            ))}
          </svg>
          <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -2 }}>
            cauce
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 26, color: "#ffc233" }}>
            {t("og.kicker")}
          </span>
          <span style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>
            {label}
          </span>
          <span style={{ fontSize: 34, color: "#a9b8c7" }}>{place}</span>
        </div>
        <span style={{ fontSize: 26, color: "#eef2f6" }}>{t("og.cta")}</span>
      </div>
    </div>,
    size,
  );
}
