import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
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
  client ??= new OpenAI({ apiKey: env().OPENAI_API_KEY, maxRetries: 0 });
  return client;
}

export function aiEnabled(): boolean {
  const config = env();
  return Boolean(config.AI_SUGGESTIONS_ENABLED && config.OPENAI_API_KEY);
}

/** Public R2 URL in production; a data URL from the local dev store otherwise. */
async function imageInput(thumbKey: string): Promise<string> {
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
): Promise<Suggestion> {
  const [upload] = await db()
    .select()
    .from(uploads)
    .where(eq(uploads.id, uploadId))
    .limit(1);
  if (!upload || upload.browserHash !== browserHash) {
    throw new DomainError("UPLOAD_NOT_FOUND", 404, "Upload not found");
  }
  if (!(await storage().head(upload.thumbKey))) {
    throw new DomainError("PHOTO_MISSING", 422, "Photo not uploaded yet");
  }

  const started = Date.now();
  const model = env().OPENAI_MODEL;
  const response = await openai().responses.parse(
    {
      model,
      instructions: await loadPrompt(),
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Triage this report photo." },
            {
              type: "input_image",
              image_url: await imageInput(upload.thumbKey),
              detail: "low",
            },
          ],
        },
      ],
      text: { format: zodTextFormat(triageSchema, "report_triage") },
      max_output_tokens: 300,
    },
    { signal: AbortSignal.timeout(SUGGEST_TIMEOUT_MS) },
  );

  const triage = response.output_parsed;
  if (!triage)
    throw new Error(
      "Model returned no parsable triage (refusal or truncation)",
    );

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

/** Records whether the person kept the suggested category. */
export async function markSuggestionOutcome(
  suggestionId: string,
  chosenCategory: string,
): Promise<void> {
  const [row] = await db()
    .select({ category: aiSuggestions.category })
    .from(aiSuggestions)
    .where(eq(aiSuggestions.id, suggestionId))
    .limit(1);
  if (!row) return;
  await db()
    .update(aiSuggestions)
    .set({ accepted: row.category === chosenCategory })
    .where(eq(aiSuggestions.id, suggestionId));
}
