/** Operator portal configuration: roles, sign-in and session lifetimes. */

export const MEMBER_ROLES = ["owner", "admin", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const AUDIT_ACTIONS = [
  "update",
  "status_change",
  "visibility_change",
  "key_rotation",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const LOGIN_TOKEN_TTL_MS = 15 * 60_000;
export const OPERATOR_SESSION_MS = 30 * 24 * 3_600_000;
export const OPERATOR_COOKIE = "cauce_op";

/** Magic-link requests allowed per email and per IP in each window. */
export const LOGIN_REQUESTS_PER_WINDOW = 5;
export const LOGIN_WINDOW_S = 15 * 60;

/** The seeded account behind "Entrar con cuenta de demostración" (only with DEMO_MODE). */
export const DEMO_OPERATOR_EMAIL = "demo@operador.example";
