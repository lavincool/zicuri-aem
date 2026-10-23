import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { AUDIT_ACTIONS, MEMBER_ROLES } from "@/config/operators";
import { createdAt, timestamp, updatedAt } from "./_shared";
import { organizations } from "./reports";

/** Operator accounts (people at companies or agencies that own sensors). */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  /** Stored lowercased. */
  email: text("email").notNull().unique(),
  name: text("name"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** A user belongs to one or more organizations; every portal query is scoped by org. */
export const memberships = sqliteTable(
  "memberships",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id),
    role: text("role", { enum: MEMBER_ROLES }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.orgId] }),
    index("memberships_org_idx").on(t.orgId),
  ],
);

/** Magic-link tokens: single use, short-lived, only the hash is stored. */
export const loginTokens = sqliteTable(
  "login_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: timestamp("used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("login_tokens_expires_idx").on(t.expiresAt)],
);

/** Server-side sessions, so a sign-out or a removed member takes effect at once. */
export const sessions = sqliteTable(
  "sessions",
  {
    /** sha256 of the cookie value. */
    idHash: text("id_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Who changed what on a device; shown in the device history. */
export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: text("user_id").references(() => users.id),
    entity: text("entity", { enum: ["device"] }).notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action", { enum: AUDIT_ACTIONS }).notNull(),
    changes: text("changes", { mode: "json" }).$type<
      Record<string, { from: unknown; to: unknown }>
    >(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_events_entity_idx").on(t.entityId, t.createdAt)],
);

export type User = typeof users.$inferSelect;
