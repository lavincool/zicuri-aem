import { cn } from "@/lib/utils";

/** Drain-grate glyph whose bars read as flowing water. */
export function LogoMark({ className }: { className?: string }) {
  const wave = (y: number) => `M8 ${y}c2.7-2 5.3 2 8 0s5.3-2 8 0`;
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0", className)}
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="8"
        className="fill-navy dark:fill-primary"
      />
      {[11, 16.5, 22].map((y) => (
        <path
          key={y}
          d={wave(y)}
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="round"
          className="stroke-primary dark:stroke-primary-foreground"
        />
      ))}
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-display text-2xl font-extrabold tracking-tighter text-foreground">
        cauce
      </span>
    </span>
  );
}
