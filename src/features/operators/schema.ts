import { z } from "zod";
import { normalizeEmail } from "./rules";

export const loginEmailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.email().max(254));
