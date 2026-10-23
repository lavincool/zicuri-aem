export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Spanish is the product language for the Matamoros pilot. The locale is resolved
 * statically so pages keep a static shell under Cache Components (see PLAN.md §16).
 */
export const DEFAULT_LOCALE: Locale = "es";
