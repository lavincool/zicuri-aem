/**
 * Pure operator rules: role permissions and sign-in input. No I/O; unit-tested.
 */
import type { MemberRole } from "@/config/operators";

export type Permission = "view_fleet" | "edit_device" | "rotate_key";

const PERMISSIONS: Record<MemberRole, readonly Permission[]> = {
  owner: ["view_fleet", "edit_device", "rotate_key"],
  admin: ["view_fleet", "edit_device", "rotate_key"],
  viewer: ["view_fleet"],
};

export function can(role: MemberRole, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission);
}

/** Emails are compared case-insensitively and stored lowercased. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type LoginTokenState = "valid" | "used" | "expired" | "unknown";

export function loginTokenState(
  token: { expiresAt: Date; usedAt: Date | null } | null,
  now: Date,
): LoginTokenState {
  if (!token) return "unknown";
  if (token.usedAt) return "used";
  if (token.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

export type DurationParts =
  | { unit: "minutes"; minutes: number }
  | { unit: "hours"; hours: number; minutes: number }
  | { unit: "days"; days: number; hours: number };

/** Coarse durations for event lists: "45 min", "2 h 15 min", "3 d 4 h". */
export function durationParts(ms: number): DurationParts {
  const totalMinutes = Math.max(1, Math.round(ms / 60_000));
  if (totalMinutes < 60) return { unit: "minutes", minutes: totalMinutes };
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    return { unit: "hours", hours: totalHours, minutes: totalMinutes % 60 };
  }
  return {
    unit: "days",
    days: Math.floor(totalHours / 24),
    hours: totalHours % 24,
  };
}
