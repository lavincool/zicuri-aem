import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { MAX_THUMB_BYTES, UPLOAD_MAX_AGE_MS } from "@/config/uploads";
import type { CreateReportInput } from "@/features/reports/schema";
import * as schema from "@/lib/db/schema";
import type { ServerEnv } from "@/lib/env";
import type { StoredObject } from "@/lib/storage";
import { PROMPT_VERSION, type Triage } from "../schema";

// Exercise the real SDK parser and report transaction without external services.
mock.module("server-only", () => ({}));
const client = createClient({ url: "file::memory:" });
const database = drizzle(client, { schema });
const config: ServerEnv = {
  NODE_ENV: "test",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  DEMO_MODE: false,
  SESSION_SECRET: "m7-test-secret-only",
  TURSO_DATABASE_URL: "file::memory:",
  TURSO_AUTH_TOKEN: undefined,
  STORAGE_DRIVER: "local",
  R2_ACCOUNT_ID: undefined,
  R2_ACCESS_KEY_ID: undefined,
  R2_SECRET_ACCESS_KEY: undefined,
  R2_BUCKET: undefined,
  R2_PUBLIC_BASE_URL: undefined,
  RATE_LIMIT_REPORTS_PER_HOUR: 10,
  GEOCODER_CONTACT_EMAIL: undefined,
  PANEL_PASSWORD: undefined,
  CRON_SECRET: undefined,
  OPEN_METEO_API_KEY: undefined,
  SMN_ENABLED: false,
  AI_SUGGESTIONS_ENABLED: true,
  OPENAI_API_KEY: "m7-test-key-only",
  OPENAI_MODEL: "gpt-6-luna",
  EMAIL_DRIVER: "console",
  EMAIL_FROM: "Cauce <test@cauce.example>",
};
const head = mock(
  async (_key: string): Promise<StoredObject | null> => ({
    bytes: 1024,
    contentType: "image/jpeg",
  }),
);
const localPhoto = Buffer.from("test-thumbnail");
let browserHash: string | null = "browser-test";
mock.module("@/lib/db/client", () => ({ db: () => database }));
mock.module("@/lib/env", () => ({
  env: () => config,
  appUrl: () => config.NEXT_PUBLIC_APP_URL,
}));
mock.module("@/lib/identity", () => ({
  getBrowserHash: async () => browserHash,
  getIpHash: async () => "ip-test",
}));
mock.module("@/lib/storage", () => ({
  storage: () => ({ head, delete: async () => {} }),
}));
mock.module("@/lib/storage/local", () => ({
  readLocal: async () => localPhoto,
}));
mock.module("@/lib/storage/urls", () => ({
  photoUrl: (key: string) => `https://photos.test/${key}`,
}));

const { POST } = await import("@/app/api/ai/suggest/route");
const { aiEnabled, SUGGEST_TIMEOUT_MS, suggestCategory } = await import(
  "./suggest"
);
const { createReport } = await import(
  "@/features/reports/server/create-report"
);
const triage: Triage = {
  category: "blocked_drain",
  is_relevant: true,
  description_es: "Alcantarilla obstruida con hojas",
  confidence: 0.9,
  privacy_concerns: [],
};

function completion(content: unknown = triage, status = "completed") {
  return {
    id: "resp_test",
    object: "response",
    model: config.OPENAI_MODEL,
    status,
    output: [
      {
        type: "message",
        id: "msg_test",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: JSON.stringify(content),
            annotations: [],
          },
        ],
      },
    ],
  };
}

let modelResponse: unknown = completion();
const apiFetch = mock<
  (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>
>(async () => Response.json(modelResponse));
const originalFetch = globalThis.fetch;
const warning = spyOn(console, "warn").mockImplementation(() => {});

function request(body: unknown = { uploadId: "upl_test" }) {
  return new Request("http://localhost/api/ai/suggest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function reportInput(
  overrides: Partial<CreateReportInput> = {},
): CreateReportInput {
  return {
    clientRequestId: crypto.randomUUID(),
    uploadId: "upl_test",
    category: "blocked_drain",
    location: { lat: 25.8226, lng: -97.562, source: "manual" },
    photo: { width: 1600, height: 1200 },
    ...overrides,
  };
}

beforeAll(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });
  globalThis.fetch = Object.assign(apiFetch, {
    preconnect: originalFetch.preconnect,
  });
});

beforeEach(async () => {
  await database.delete(schema.reportStatusEvents);
  await database.delete(schema.reports);
  await database.delete(schema.aiSuggestions);
  await database.delete(schema.uploads);
  await database.delete(schema.rateLimitBuckets);
  await database.insert(schema.uploads).values({
    id: "upl_test",
    fullKey: "reports/test/full.jpg",
    thumbKey: "reports/test/thumb.jpg",
    contentType: "image/jpeg",
    declaredBytes: 1024,
    browserHash: "browser-test",
  });
  config.AI_SUGGESTIONS_ENABLED = true;
  config.OPENAI_API_KEY = "m7-test-key-only";
  config.STORAGE_DRIVER = "local";
  browserHash = "browser-test";
  modelResponse = completion();
  apiFetch.mockReset();
  apiFetch.mockImplementation(async () => Response.json(modelResponse));
  head.mockReset();
  head.mockImplementation(async () => ({
    bytes: 1024,
    contentType: "image/jpeg",
  }));
  warning.mockClear();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  warning.mockRestore();
  client.close();
});

describe("AI suggestion endpoint", () => {
  test("disabled or missing-key requests return 204 without touching the model", async () => {
    config.AI_SUGGESTIONS_ENABLED = false;
    expect(aiEnabled()).toBe(false);
    expect((await POST(request())).status).toBe(204);
    config.AI_SUGGESTIONS_ENABLED = true;
    config.OPENAI_API_KEY = undefined;
    expect(aiEnabled()).toBe(false);
    expect((await POST(request())).status).toBe(204);
    expect(apiFetch).not.toHaveBeenCalled();
    expect(await database.select().from(schema.rateLimitBuckets)).toHaveLength(
      0,
    );
  });

  test("a clear drain photo is parsed and logged with its version and model", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.category).toBe("blocked_drain");
    expect(result.description).toBe(triage.description_es);
    const [row] = await database.select().from(schema.aiSuggestions);
    expect(row).toMatchObject({
      id: result.suggestionId,
      uploadId: "upl_test",
      provider: "openai",
      model: "gpt-6-luna",
      promptVersion: PROMPT_VERSION,
      category: "blocked_drain",
      accepted: null,
      raw: triage,
    });
    expect(row?.latencyMs).toBeGreaterThanOrEqual(0);
    const body = JSON.parse(String(apiFetch.mock.calls[0]?.[1]?.body));
    expect(body.store).toBe(false);
    expect(body.reasoning).toEqual({ effort: "none" });
    expect(body.text.format.type).toBe("json_schema");
    expect(body.text.format.strict).toBe(true);
    expect(body.input[0].content[1]).toEqual({
      type: "input_image",
      image_url: `data:image/jpeg;base64,${localPhoto.toString("base64")}`,
      detail: "low",
    });
  });

  test("R2 uses the public thumbnail URL", async () => {
    config.STORAGE_DRIVER = "r2";
    expect((await POST(request())).status).toBe(200);
    const body = JSON.parse(String(apiFetch.mock.calls[0]?.[1]?.body));
    expect(body.input[0].content[1].image_url).toBe(
      "https://photos.test/reports/test/thumb.jpg",
    );
  });

  test("irrelevant photos are logged without a category or description", async () => {
    modelResponse = completion({
      ...triage,
      is_relevant: false,
      category: "unclear",
      description_es: "",
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      category: null,
      description: null,
      isRelevant: false,
    });
    const [row] = await database.select().from(schema.aiSuggestions);
    expect(row?.isRelevant).toBe(false);
    expect(row?.category).toBeNull();
  });

  test("missing identity and invalid input never call OpenAI", async () => {
    browserHash = null;
    expect((await POST(request())).status).toBe(401);
    browserHash = "browser-test";
    expect((await POST(request({ uploadId: "" }))).status).toBe(400);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test("uploads must belong to the browser and remain unused and unexpired", async () => {
    browserHash = "other-browser";
    expect((await POST(request())).status).toBe(404);
    browserHash = "browser-test";
    await database.update(schema.uploads).set({ consumedAt: new Date() });
    expect((await POST(request())).status).toBe(409);
    await database.update(schema.uploads).set({
      consumedAt: null,
      createdAt: new Date(Date.now() - UPLOAD_MAX_AGE_MS - 1000),
    });
    expect((await POST(request())).status).toBe(404);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test("missing and oversized thumbnails never call OpenAI", async () => {
    head.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(422);
    head.mockResolvedValue({
      bytes: MAX_THUMB_BYTES + 1,
      contentType: "image/jpeg",
    });
    expect((await POST(request())).status).toBe(413);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test.each(["browser:browser-test", "ip:ip-test"])(
    "the 20-per-hour limit for %s stops further model calls",
    async (key) => {
      const windowStart = Math.floor(Date.now() / 3_600_000) * 3_600_000;
      await database.insert(schema.rateLimitBuckets).values({
        key: `ai:${key}:${windowStart}`,
        count: 20,
        expiresAt: new Date(windowStart + 3_600_000),
      });
      expect((await POST(request())).status).toBe(204);
      expect(apiFetch).not.toHaveBeenCalled();
    },
  );

  test("model refusals, malformed output and incomplete responses fall back to 204", async () => {
    const refusal = completion();
    modelResponse = {
      ...refusal,
      output: [
        {
          ...refusal.output[0],
          content: [{ type: "refusal", refusal: "Cannot classify" }],
        },
      ],
    };
    expect((await POST(request())).status).toBe(204);
    modelResponse = completion({ ...triage, category: "invented_category" });
    expect((await POST(request())).status).toBe(204);
    modelResponse = completion(triage, "incomplete");
    expect((await POST(request())).status).toBe(204);
    expect(await database.select().from(schema.aiSuggestions)).toHaveLength(0);
  });

  test("provider errors return 204 without retries", async () => {
    apiFetch.mockImplementation(async () =>
      Response.json(
        { error: { message: "Provider unavailable" } },
        { status: 503 },
      ),
    );
    expect((await POST(request())).status).toBe(204);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  test("a stalled model returns 204 after the four-second deadline", async () => {
    apiFetch.mockImplementation(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) reject(signal.reason);
          else
            signal?.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            });
        }),
    );
    const started = Date.now();
    expect((await POST(request())).status).toBe(204);
    expect(Date.now() - started).toBeGreaterThanOrEqual(
      SUGGEST_TIMEOUT_MS - 100,
    );
    expect(Date.now() - started).toBeLessThan(SUGGEST_TIMEOUT_MS + 1000);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(await database.select().from(schema.aiSuggestions)).toHaveLength(0);
  }, 6500);

  test("cancelling while storage is loading prevents a late model request", async () => {
    let release: (value: StoredObject) => void = () => {};
    let entered: () => void = () => {};
    const loading = new Promise<void>((resolve) => {
      entered = resolve;
    });
    head.mockImplementation(async () => {
      entered();
      return new Promise<StoredObject>((resolve) => {
        release = resolve;
      });
    });
    const controller = new AbortController();
    const pending = suggestCategory(
      "upl_test",
      "browser-test",
      controller.signal,
    );
    await loading;
    controller.abort();
    await expect(pending).rejects.toHaveProperty("name", "AbortError");
    release({ bytes: 1024, contentType: "image/jpeg" });
    await Bun.sleep(10);
    expect(apiFetch).not.toHaveBeenCalled();
    expect(await database.select().from(schema.aiSuggestions)).toHaveLength(0);
  });
});

describe("suggestion acceptance on report submission", () => {
  test.each(["blocked_drain", "flooded_street"] as const)(
    "records whether the resident chose %s",
    async (category) => {
      const suggestion = await suggestCategory("upl_test", "browser-test");
      const report = await createReport(
        reportInput({ category, aiSuggestionId: suggestion.suggestionId }),
        "browser-test",
      );
      const [row] = await database.select().from(schema.aiSuggestions);
      expect(report.aiSuggestionId).toBe(suggestion.suggestionId);
      expect(row?.accepted).toBe(category === "blocked_drain");
    },
  );

  test("another photo's suggestion cannot change its acceptance record", async () => {
    await database.insert(schema.aiSuggestions).values({
      id: "ais_other",
      uploadId: "upl_other",
      provider: "openai",
      model: "gpt-6-luna",
      promptVersion: PROMPT_VERSION,
      category: "blocked_drain",
    });
    const report = await createReport(
      reportInput({ aiSuggestionId: "ais_other" }),
      "browser-test",
    );
    expect(report.aiSuggestionId).toBeNull();
    const [row] = await database
      .select()
      .from(schema.aiSuggestions)
      .where(eq(schema.aiSuggestions.id, "ais_other"));
    expect(row?.accepted).toBeNull();
  });

  test("a stale outbox suggestion does not block a re-uploaded report", async () => {
    const report = await createReport(
      reportInput({ aiSuggestionId: "ais_expired" }),
      "browser-test",
    );
    expect(report.id).toBeTruthy();
    expect(report.aiSuggestionId).toBeNull();
  });

  test("an irrelevant result has no acceptance decision", async () => {
    modelResponse = completion({
      ...triage,
      is_relevant: false,
      category: "unclear",
      description_es: "",
    });
    const suggestion = await suggestCategory("upl_test", "browser-test");
    await createReport(
      reportInput({ aiSuggestionId: suggestion.suggestionId }),
      "browser-test",
    );
    const [row] = await database.select().from(schema.aiSuggestions);
    expect(row?.accepted).toBeNull();
  });
});
