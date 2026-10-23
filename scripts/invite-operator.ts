/**
 * Invites a person to the operator portal (/operador) and sends their first sign-in link.
 * There is no self sign-up: organizations are verified before they get access.
 *
 * Usage:
 *   bun run operator:invite -- --org org_… --email ana@empresa.mx [--role admin] [--name "Ana López"]
 *   bun run operator:invite -- --create-org "Agua del Norte" [--kind operator] --email … --role owner
 *
 * With EMAIL_DRIVER=console the link is printed here and in the server log.
 */
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { MEMBER_ROLES } from "@/config/operators";
import { sendLoginLink } from "@/features/operators/server/magic-link";
import { db } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";
import { prefixedId } from "@/lib/ids";
import { ensureOperator } from "./lib/operators";

const ORG_KINDS = organizations.kind.enumValues;

const { values } = parseArgs({
  options: {
    org: { type: "string" },
    "create-org": { type: "string" },
    kind: { type: "string", default: "operator" },
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "admin" },
  },
});

const args = z
  .object({
    org: z.string().startsWith("org_").optional(),
    "create-org": z.string().min(3).optional(),
    kind: z.enum(ORG_KINDS),
    email: z.email(),
    name: z.string().min(2).optional(),
    role: z.enum(MEMBER_ROLES),
  })
  .refine((a) => Boolean(a.org) !== Boolean(a["create-org"]), {
    message: "Pass exactly one of --org or --create-org",
    path: ["org"],
  })
  .safeParse(values);

if (!args.success) {
  console.error("Invalid arguments:");
  for (const issue of args.error.issues) {
    console.error(`  --${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

let orgId = args.data.org;
const newOrgName = args.data["create-org"];
if (newOrgName) {
  orgId = prefixedId("org");
  await db()
    .insert(organizations)
    .values({ id: orgId, name: newOrgName, kind: args.data.kind });
}
const [org] = await db()
  .select()
  .from(organizations)
  .where(eq(organizations.id, orgId as string))
  .limit(1);
if (!org) {
  console.error(`Organization ${orgId} does not exist.`);
  process.exit(1);
}

const user = await ensureOperator({
  email: args.data.email,
  name: args.data.name,
  orgId: org.id,
  role: args.data.role,
});
const link = await sendLoginLink(user);

console.log(`
Operator invited
  organization: ${org.name} (${org.id})
  user:         ${user.email} (${user.id})
  role:         ${args.data.role}

First sign-in link (single use, expires in 15 minutes):
  ${link}

Later sign-ins: /operador/entrar sends a new link to the same email.
`);
