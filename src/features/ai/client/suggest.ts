import { type Suggestion, suggestionSchema } from "../schema";

/** Suggestions are optional: report creation never waits for the model. */
export async function fetchSuggestion(
  uploadId: string,
  signal: AbortSignal,
): Promise<Suggestion | null> {
  try {
    const response = await fetch("/api/ai/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uploadId }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
    });
    if (response.status !== 200) return null;
    const parsed = suggestionSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
