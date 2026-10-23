import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { REPORT_CATEGORIES } from "@/config/categories";
import { createdAt } from "./_shared";

/** Every AI category suggestion, kept to measure quality (`accepted`) over time. */
export const aiSuggestions = sqliteTable("ai_suggestions", {
  id: text("id").primaryKey(),
  uploadId: text("upload_id").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  category: text("category", { enum: REPORT_CATEGORIES }),
  description: text("description"),
  confidence: real("confidence"),
  isRelevant: integer("is_relevant", { mode: "boolean" }),
  privacyConcerns: text("privacy_concerns", { mode: "json" }).$type<string[]>(),
  latencyMs: integer("latency_ms"),
  /** Set when the report is submitted: did the person keep the suggested category? */
  accepted: integer("accepted", { mode: "boolean" }),
  raw: text("raw", { mode: "json" }),
  createdAt: createdAt(),
});
