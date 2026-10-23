import "server-only";
import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((value) => value === "true" || value === "1");

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined));

const serverEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
    DEMO_MODE: booleanFromString,
    SESSION_SECRET: z
      .string()
      .min(16, "SESSION_SECRET must be at least 16 characters"),

    TURSO_DATABASE_URL: z.string().min(1).default("file:local.db"),
    TURSO_AUTH_TOKEN: optionalString,

    STORAGE_DRIVER: z.enum(["local", "r2"]).default("local"),
    R2_ACCOUNT_ID: optionalString,
    R2_ACCESS_KEY_ID: optionalString,
    R2_SECRET_ACCESS_KEY: optionalString,
    R2_BUCKET: optionalString,
    R2_PUBLIC_BASE_URL: optionalString,

    RATE_LIMIT_REPORTS_PER_HOUR: z.coerce.number().int().positive().default(10),
    GEOCODER_CONTACT_EMAIL: optionalString,

    PANEL_PASSWORD: optionalString,
    CRON_SECRET: optionalString,

    OPEN_METEO_API_KEY: optionalString,
    SMN_ENABLED: booleanFromString,

    AI_SUGGESTIONS_ENABLED: booleanFromString,
    OPENAI_API_KEY: optionalString,
    OPENAI_MODEL: z.string().default("gpt-6-luna"),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === "r2") {
      for (const key of [
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET",
        "R2_PUBLIC_BASE_URL",
      ] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=r2`,
          });
        }
      }
    }
    if (
      env.TURSO_DATABASE_URL.startsWith("libsql://") &&
      !env.TURSO_AUTH_TOKEN
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["TURSO_AUTH_TOKEN"],
        message: "TURSO_AUTH_TOKEN is required for a remote Turso database",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function parseEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** Validated server environment, parsed on first use so builds don't need every secret. */
export function env(): ServerEnv {
  cached ??= parseEnv();
  return cached;
}

/** Absolute base URL for links and Open Graph images. */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}
