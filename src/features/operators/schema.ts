import { z } from "zod";
import { normalizeEmail } from "./rules";

export const loginEmailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.email().max(254));

export const EVENT_LEVELS = ["warning", "critical", "offline"] as const;

/** `?sensor=&nivel=` on the events page and the CSV export; bad values mean "all". */
export const eventFiltersSchema = z.object({
  sensor: z.string().startsWith("dev_").max(64).optional().catch(undefined),
  nivel: z.enum(EVENT_LEVELS).optional().catch(undefined),
});
