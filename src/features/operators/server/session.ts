import "server-only";
import { and, asc, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import {
  type MemberRole,
  OPERATOR_COOKIE,
  OPERATOR_SESSION_MS,
} from "@/config/operators";
import { db } from "@/lib/db/client";
import { memberships, organizations, sessions, users } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { can, type Permission } from "../rules";
import { generateToken, hashToken } from "./tokens";

export type Operator = {
  userId: string;
  email: string;
  name: string | null;
  orgId: string;
  orgName: string;
  role: MemberRole;
};

/** Creates a session row and sets the cookie. Call from Server Actions only. */
export async function startSession(userId: string, now = new Date()) {
  const jar = await cookies();
  // Signing in again (or as someone else) replaces the session on this device.
  const previous = jar.get(OPERATOR_COOKIE)?.value;
  if (previous) {
    await db()
      .delete(sessions)
      .where(eq(sessions.idHash, hashToken(previous)));
  }
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + OPERATOR_SESSION_MS);
  await db()
    .insert(sessions)
    .values({ idHash: hashToken(token), userId, expiresAt, createdAt: now });
  await db()
    .update(users)
    .set({ lastLoginAt: now, updatedAt: now })
    .where(eq(users.id, userId));
  jar.set(OPERATOR_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(OPERATOR_COOKIE)?.value;
  if (token) {
    await db()
      .delete(sessions)
      .where(eq(sessions.idHash, hashToken(token)));
  }
  jar.delete(OPERATOR_COOKIE);
}

/**
 * The only way pages and actions learn who is signed in (data access layer).
 * Memoized per request. A user in several organizations sees the first one they joined.
 */
export const getOperator = cache(async (): Promise<Operator | null> => {
  const token = (await cookies()).get(OPERATOR_COOKIE)?.value;
  if (!token) return null;
  // Session expiry compares against the request time.
  await connection();
  const [row] = await db()
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      orgId: organizations.id,
      orgName: organizations.name,
      role: memberships.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(
      and(
        eq(sessions.idHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(memberships.createdAt))
    .limit(1);
  return row ?? null;
});

/** Redirects to sign-in without a session; pages and Server Actions call this first. */
export async function requireOperator(
  permission: Permission = "view_fleet",
): Promise<Operator> {
  const operator = await getOperator();
  if (!operator) redirect("/operador/entrar");
  if (!can(operator.role, permission)) {
    throw new DomainError("FORBIDDEN", 403, `Role cannot ${permission}`);
  }
  return operator;
}
