import { z } from "zod";
import { REPORT_CATEGORIES, type ReportCategory } from "@/config/categories";

export const PROMPT_VERSION = "report-triage/v1";

/** Structured output the model must return (every field required, per OpenAI strict mode). */
export const triageSchema = z.object({
  category: z.enum([...REPORT_CATEGORIES, "unclear"]),
  is_relevant: z.boolean(),
  description_es: z.string().max(160),
  confidence: z.number().min(0).max(1),
  privacy_concerns: z.array(z.enum(["face", "license_plate"])),
});
export type Triage = z.infer<typeof triageSchema>;

export const suggestRequestSchema = z.object({
  uploadId: z.string().min(1).max(64),
});

export type Suggestion = {
  suggestionId: string;
  category: ReportCategory | null;
  confidence: number;
  description: string | null;
  isRelevant: boolean;
};

/** Below this confidence the app shows no suggestion at all. */
export const MIN_CONFIDENCE = 0.5;

/** Turns the raw model output into what the app shows (or nothing). */
export function toSuggestion(id: string, triage: Triage): Suggestion {
  const usable =
    triage.is_relevant &&
    triage.category !== "unclear" &&
    triage.confidence >= MIN_CONFIDENCE;
  return {
    suggestionId: id,
    category: usable ? (triage.category as ReportCategory) : null,
    confidence: triage.confidence,
    description:
      triage.is_relevant && triage.description_es.trim()
        ? triage.description_es.trim().slice(0, 140)
        : null,
    isRelevant: triage.is_relevant,
  };
}
