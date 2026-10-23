import "server-only";
import { env } from "./env";

export type Email = { to: string; subject: string; text: string };

/**
 * Sends a transactional email. The `console` driver prints it to the server log,
 * which is enough for local development and the demo account; a provider is added
 * as another driver before launch (PLAN.md §14).
 */
export async function sendEmail(email: Email): Promise<void> {
  const { EMAIL_DRIVER, EMAIL_FROM } = env();
  switch (EMAIL_DRIVER) {
    case "console":
      console.info(
        [
          "",
          `── Email (${EMAIL_DRIVER}) ─────────────────────────`,
          `From:    ${EMAIL_FROM}`,
          `To:      ${email.to}`,
          `Subject: ${email.subject}`,
          "",
          email.text,
          "──────────────────────────────────────────────",
          "",
        ].join("\n"),
      );
      return;
  }
}
