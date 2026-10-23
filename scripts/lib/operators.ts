import { eq } from "drizzle-orm";
import { DEMO_OPERATOR_EMAIL, type MemberRole } from "@/config/operators";
import { normalizeEmail } from "@/features/operators/rules";
import { db } from "@/lib/db/client";
import { memberships, type User, users } from "@/lib/db/schema";
import { prefixedId } from "@/lib/ids";
import { DEMO_ORG_ID, ensureDemoOrganization } from "./devices";

/** Creates the user if needed and sets their role in the organization. */
export async function ensureOperator(input: {
  email: string;
  name?: string;
  orgId: string;
  role: MemberRole;
}): Promise<User> {
  const email = normalizeEmail(input.email);
  const database = db();
  await database
    .insert(users)
    .values({ id: prefixedId("usr"), email, name: input.name ?? null })
    .onConflictDoNothing();
  const [user] = await database
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) throw new Error(`User ${email} was not created`);
  if (input.name && user.name !== input.name) {
    await database
      .update(users)
      .set({ name: input.name })
      .where(eq(users.id, user.id));
  }
  await database
    .insert(memberships)
    .values({ userId: user.id, orgId: input.orgId, role: input.role })
    .onConflictDoUpdate({
      target: [memberships.userId, memberships.orgId],
      set: { role: input.role },
    });
  return { ...user, name: input.name ?? user.name };
}

/** The account behind "Entrar con cuenta de demostración". */
export async function seedDemoOperator(): Promise<User> {
  await ensureDemoOrganization();
  return ensureOperator({
    email: DEMO_OPERATOR_EMAIL,
    name: "Equipo demo",
    orgId: DEMO_ORG_ID,
    role: "admin",
  });
}
