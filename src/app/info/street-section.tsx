import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import "./street-section.css";

const label = "absolute text-[13px] leading-tight font-bold sm:text-sm";
const chip = "rounded-md bg-background/85 px-1.5 py-0.5";

/**
 * Cross-section of a Matamoros street: the satellite overhead, a resident's report at
 * a blocked storm drain, the level sensor inside it, and the pipe out to the canal.
 * Drawn on a 400×300 grid; labels are HTML placed in percentages of that grid.
 */
export function StreetSection() {
  const t = useTranslations("info.diagram");
  return (
    <div
      role="img"
      aria-label={t("alt")}
      className="relative aspect-[4/3] w-full"
    >
      <svg
        viewBox="0 0 400 300"
        className="absolute inset-0 size-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="street-section-soil"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="7" height="7" fill="var(--secondary)" />
            <line y2="7" stroke="var(--border)" strokeWidth="2" />
          </pattern>
          <linearGradient id="street-section-fade" x2="0" y2="1">
            <stop offset="0.55" stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id="street-section-mask">
            <rect
              y="150"
              width="400"
              height="150"
              fill="url(#street-section-fade)"
            />
          </mask>
          <clipPath id="street-section-cavity">
            <rect x="202" y="162" width="34" height="86" />
            <rect x="236" y="215" width="78" height="14" />
            <polygon points="300,160 318,250 372,250 390,160" />
          </clipPath>
        </defs>

        {/* Satellite swath over the pilot area */}
        <polygon
          points="52,52 8,160 296,160"
          fill="var(--foreground)"
          opacity="0.045"
        />
        <path
          d="M52 52 8 160M52 52l244 108"
          stroke="var(--foreground)"
          strokeOpacity="0.3"
          strokeDasharray="3 5"
        />

        {/* Satellite */}
        <g stroke="var(--foreground)" strokeLinejoin="round">
          <path d="M42 40h3M59 40h3" strokeWidth="2" />
          <rect
            x="24"
            y="36"
            width="18"
            height="8"
            fill="var(--water)"
            strokeWidth="1.5"
          />
          <rect
            x="62"
            y="36"
            width="18"
            height="8"
            fill="var(--water)"
            strokeWidth="1.5"
          />
          <path d="M33 36v8M71 36v8" stroke="var(--card)" />
          <rect
            x="45"
            y="34"
            width="14"
            height="12"
            rx="2"
            fill="var(--card)"
            strokeWidth="2"
          />
          <path d="M52 46v5" strokeWidth="2" />
        </g>

        {/* Rain cloud */}
        <path
          d="M328 60H374A13 13 0 0 0 376 34.2A17 17 0 0 0 344 30A12 12 0 0 0 326 37A11.5 11.5 0 0 0 328 60Z"
          fill="var(--card)"
          stroke="var(--foreground)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <g
          stroke="var(--water)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="8 10"
        >
          {[332, 345, 358, 371].map((x) => (
            <path key={x} d={`M${x} 70l-14 70`} />
          ))}
        </g>

        {/* Ground, cut open where the drain, pipe and canal are */}
        <g mask="url(#street-section-mask)">
          <rect
            y="152"
            width="24"
            height="8"
            fill="url(#street-section-soil)"
          />
          <rect
            y="160"
            width="400"
            height="140"
            fill="url(#street-section-soil)"
          />
          <rect
            x="200"
            y="160"
            width="38"
            height="90"
            fill="var(--background)"
          />
          <rect
            x="238"
            y="214"
            width="76"
            height="16"
            fill="var(--background)"
          />
          <polygon
            points="300,160 318,250 372,250 390,160"
            fill="var(--background)"
          />
        </g>

        {/* Water, rising through every cavity at once */}
        <g clipPath="url(#street-section-cavity)">
          <g className="street-section-water">
            <rect
              y="204"
              width="400"
              height="96"
              fill="var(--water)"
              opacity="0.9"
            />
            <path
              d="M0 204H400"
              stroke="var(--water-foreground)"
              strokeOpacity="0.5"
              strokeWidth="1.5"
            />
          </g>
        </g>

        {/* Pavement, drain walls, pipe and canal banks */}
        <g fill="var(--foreground)">
          <rect y="152" width="24" height="4" opacity="0.6" />
          <rect x="24" y="160" width="176" height="4" />
          <rect x="238" y="160" width="62" height="4" />
          <rect x="390" y="160" width="10" height="4" />
        </g>
        <path
          d="M24 152v8M200 162v88h38v-20M238 214v-52M238 214h73M238 230h76M300 160l18 90h54l18-90"
          fill="none"
          stroke="var(--foreground)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Grate, with the trash that blocks it */}
        <rect x="198" y="157" width="42" height="5" fill="var(--foreground)" />
        <g fill="var(--background)">
          {[204, 212, 220, 228].map((x) => (
            <rect key={x} x={x} y="158" width="3.5" height="3" />
          ))}
        </g>
        <g fill="var(--muted-foreground)">
          <path d="M205 157q1-7 8-6.5 6-3 8.5 2.5 3 4-1 4z" />
          <rect x="225" y="151.5" width="10" height="5.5" rx="2" />
        </g>

        {/* Level sensor, ultrasound pointing at the water */}
        <path d="M230 173h6" stroke="var(--foreground)" strokeWidth="2" />
        <path
          d="M194 182 213 175"
          stroke="var(--foreground)"
          strokeOpacity="0.6"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <rect
          x="214"
          y="166"
          width="16"
          height="14"
          rx="4"
          className="street-section-sensor"
          stroke="var(--foreground)"
          strokeWidth="2"
        />
        <path
          d="M216 188q6 4 12 0M213 195q9 6 18 0"
          fill="none"
          stroke="var(--foreground)"
          strokeOpacity="0.7"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Resident's report */}
        <ellipse
          cx="172"
          cy="161"
          rx="12"
          ry="3.5"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          className="origin-center animate-pin-ripple [transform-box:fill-box] [animation-delay:450ms] [animation-fill-mode:both] motion-reduce:hidden"
        />
        <g className="origin-bottom animate-pin-drop [transform-box:fill-box]">
          <path
            d="M172 160c-2-6-13-14-13-24a13 13 0 1 1 26 0c0 10-11 18-13 24z"
            fill="var(--primary)"
            stroke="var(--foreground)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="172" cy="136" r="4.5" fill="var(--foreground)" />
        </g>
      </svg>

      <span className={cn(label, "top-[9%] left-[22%]")}>{t("satellite")}</span>
      <span className={cn(label, chip, "top-[27%] left-[14%]")}>
        {t("resident")}
      </span>
      <span className={cn(label, chip, "top-[56.5%] right-[52%]")}>
        {t("sensor")}
      </span>
      <span
        className={cn(label, chip, "top-[85%] left-[86.25%] -translate-x-1/2")}
      >
        {t("canal")}
      </span>
    </div>
  );
}
