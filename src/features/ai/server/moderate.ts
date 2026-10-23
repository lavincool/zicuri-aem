import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/env";
import { imageInput } from "./suggest";

/** Report creation waits at most this long; after that the report goes through. */
export const MODERATION_TIMEOUT_MS = 3000;

let client: OpenAI | null = null;
function openai(): OpenAI {
  client ??= new OpenAI({
    apiKey: env().OPENAI_API_KEY,
    maxRetries: 0,
    timeout: MODERATION_TIMEOUT_MS,
  });
  return client;
}

export function moderationEnabled(): boolean {
  const config = env();
  return Boolean(config.PHOTO_MODERATION_ENABLED && config.OPENAI_API_KEY);
}

/**
 * Checks a report's photo and note with OpenAI's free moderation model before it is
 * published. Fails open: an error or timeout never blocks a flood report.
 */
export async function isContentFlagged(input: {
  thumbKey: string;
  note: string | null;
}): Promise<boolean> {
  if (!moderationEnabled()) return false;
  try {
    const url = await imageInput(input.thumbKey);
    const response = await openai().moderations.create({
      model: "omni-moderation-latest",
      input: [
        { type: "image_url", image_url: { url } },
        ...(input.note ? [{ type: "text" as const, text: input.note }] : []),
      ],
    });
    return response.results.some((result) => result.flagged);
  } catch (error) {
    console.error("Photo moderation failed; publishing anyway", error);
    return false;
  }
}
