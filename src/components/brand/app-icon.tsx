import { ImageResponse } from "next/og";

/**
 * PNG app icon for the manifest and iOS. `maskable` keeps the glyph inside the
 * safe zone (80%) on a full-bleed background, as Android adaptive icons require.
 */
export function appIconResponse(size: number, { maskable = false } = {}) {
  const glyph = maskable ? size * 0.6 : size * 0.86;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: maskable ? "#0b1f33" : "transparent",
      }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="2" y="2" width="28" height="28" rx="8" fill="#0b1f33" />
        {[11, 16.5, 22].map((y) => (
          <path
            key={y}
            d={`M8 ${y}c2.7-2 5.3 2 8 0s5.3-2 8 0`}
            fill="none"
            stroke="#ffb000"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>,
    { width: size, height: size },
  );
}
