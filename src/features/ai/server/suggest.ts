import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { MAX_THUMB_BYTES, UPLOAD_MAX_AGE_MS } from "@/config/uploads";
import { db } from "@/lib/db/client";
import { aiSuggestions, uploads } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "@/lib/errors";
import { prefixedId } from "@/lib/ids";
import { storage } from "@/lib/storage";
import { readLocal } from "@/lib/storage/local";
import { photoUrl } from "@/lib/storage/urls";
import {
  PROMPT_VERSION,
  type Suggestion,
  toSuggestion,
  triageSchema,
} from "../schema";

/** The suggestion must arrive while the person is still placing the pin. */
export const SUGGEST_TIMEOUT_MS = 4000;

let prompt: Promise<string> | null = null;
function loadPrompt(): Promise<string> {
  prompt ??= readFile(
    path.join(process.cwd(), "prompts", `${PROMPT_VERSION}.md`),
    "utf8",
  );
  return prompt;
}

let client: OpenAI | null = null;
function openai(): OpenAI {
  client ??= new OpenAI({
    apiKey: env().OPENAI_API_KEY,
    maxRetries: 0,
    timeout: SUGGEST_TIMEOUT_MS,
  });
  return client;
}

export function aiEnabled(): boolean {
  const config = env();
  return Boolean(config.AI_SUGGESTIONS_ENABLED && config.OPENAI_API_KEY);
}

/** Public R2 URL in production; a data URL from the local dev store otherwise. */
export async function imageInput(thumbKey: string): Promise<string> {
  if (env().STORAGE_DRIVER === "r2") return photoUrl(thumbKey);
  const file = await readLocal(thumbKey);
  if (!file)
    throw new DomainError("PHOTO_MISSING", 422, "Photo not uploaded yet");
  return `data:image/jpeg;base64,${file.toString("base64")}`;
}

/** Asks the vision model to triage an uploaded photo. Callers treat failures as "no suggestion". */
export async function suggestCategory(
  uploadId: string,
  browserHash: string,
  requestSignal?: AbortSignal,
): Promise<Suggestion> {
  const deadline = AbortSignal.timeout(SUGGEST_TIMEOUT_MS);
  const signal = requestSignal
    ? AbortSignal.any([requestSignal, deadline])
    : deadline;
  signal.throwIfAborted();
  let onAbort = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    // Bound the entire operation, including storage reads and database writes.
    return await Promise.race([
      generateSuggestion(uploadId, browserHash, signal),
      aborted,
    ]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

async function generateSuggestion(
  uploadId: string,
  browserHash: string,
  signal: AbortSignal,
): Promise<Suggestion> {
  const started = Date.now();
  const [upload] = await db()
    .select()
    .from(uploads)
    .where(eq(uploads.id, uploadId))
    .limit(1);
  if (
    !upload ||
    upload.browserHash !== browserHash ||
    started - upload.createdAt.getTime() > UPLOAD_MAX_AGE_MS
  ) {
    throw new DomainError("UPLOAD_NOT_FOUND", 404, "Upload not found");
  }
  if (upload.consumedAt) {
    throw new DomainError("UPLOAD_ALREADY_USED", 409, "Upload already used");
  }
  const thumb = await storage().head(upload.thumbKey);
  if (!thumb) {
    throw new DomainError("PHOTO_MISSING", 422, "Photo not uploaded yet");
  }
  if (thumb.bytes > MAX_THUMB_BYTES) {
    throw new DomainError("FILE_TOO_LARGE", 413, "Thumbnail is too large");
  }

  const [instructions, imageUrl] = await Promise.all([
    loadPrompt(),
    imageInput(upload.thumbKey),
  ]);
  signal.throwIfAborted();
  const model = env().OPENAI_MODEL;
  const response = await openai().responses.parse(
    {
      model,
      instructions,
      store: false,
      // Luna supports disabling reasoning for this latency-sensitive task.
      ...(model.startsWith("gpt-6-luna")
        ? { reasoning: { effort: "none" as const } }
        : {}),
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Triage this report photo." },
            {
              type: "input_image",
              image_url: imageUrl,
              detail: "low",
            },
          ],
        },
      ],
      text: { format: zodTextFormat(triageSchema, "report_triage") },
      max_output_tokens: 300,
    },
    { signal },
  );

  signal.throwIfAborted();
  const triage = response.output_parsed;
  if (response.status !== "completed" || !triage) {
    throw new Error(
      "Model returned no complete triage (refusal or truncation)",
    );
  }

  const id = prefixedId("ais");
  const suggestion = toSuggestion(id, triage);
  await db()
    .insert(aiSuggestions)
    .values({
      id,
      uploadId,
      provider: "openai",
      model,
      promptVersion: PROMPT_VERSION,
      category: suggestion.category,
      description: suggestion.description,
      confidence: triage.confidence,
      isRelevant: triage.is_relevant,
      privacyConcerns: triage.privacy_concerns,
      latencyMs: Date.now() - started,
      raw: triage,
    });
  return suggestion;
}
