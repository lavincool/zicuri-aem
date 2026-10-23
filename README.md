# Cauce

Community flood-reporting map for Matamoros, Tamaulipas. Residents report what floods their street with one photo, water-level sensors feed live readings, and authorities get an explainable view of where to clean drains before the next storm.

Built for the Hackathon of the Agencia Espacial Mexicana (AEM).

> Work in progress. See [PLAN.md](PLAN.md) for the architecture, data model, API contracts and milestones. Full setup, deployment and demo instructions land with milestone M5.

## Quick start

```bash
bun install
cp .env.example .env.local
bun dev
```

Open http://localhost:3000.

## Optional OpenAI category suggestions (M7)

Apply the migrations, including `0003_ai.sql`, with `bun run db:migrate`. To enable photo suggestions, set these server-only values in `.env.local` (and in Vercel when deploying):

```dotenv
AI_SUGGESTIONS_ENABLED=true
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-6-luna
```

Restart the development server after changing the environment. Rebuild and redeploy to apply production changes. Suggestions stay off unless both the feature flag and the key are set; the key is never sent to the browser.

After a photo uploads, the server analyzes its thumbnail while the resident places the pin. It uses the [Responses API with structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), the versioned prompt in `prompts/report-triage/v1.md`, and the model configured in `OPENAI_MODEL`. R2 sends its public thumbnail URL; local storage sends a JPEG data URL. The default [GPT-6 Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna) runs without reasoning to keep this short classification within the four-second deadline. Requests disable provider response storage and automatic retries.

A clear, relevant result pre-selects a category with a **Sugerido** badge. The resident can change it, or explicitly copy the proposed description into the optional note. Manual choices take precedence, and changing photos clears the previous suggestion. Irrelevant or uncertain photos, refusals, timeouts, rate limits and provider failures leave the manual flow available. Suggestions are limited to 20/hour per browser and IP.

`ai_suggestions` records the model, prompt version, confidence, latency and classification. Submitting a report records `accepted` in the same database transaction, only for a suggestion belonging to that report's upload. Re-uploading an offline report safely discards a stale suggestion reference.

Run `bun test`, `bun run lint`, `bun run typecheck` and `bun run build` to validate. AI tests use a temporary in-memory database and simulated provider responses; they make no paid OpenAI calls. To check real model quality after enabling your key, try a clear clogged-drain photo, an unrelated photo and a manually changed category.

## Operator portal (M8)

`/operador` is for companies and agencies that own sensors: fleet overview, sensor list with health checks, sensor detail (chart up to 30 days, events, nearby reports, area risk), editing (name, site, state, visibility, location, thresholds, interval) with a change history, key rotation, and an event timeline with CSV export.

Apply the migrations (`0004_accounts.sql`, `0005_device_visibility.sql`) with `bun run db:migrate`, then `bun run seed`. With `DEMO_MODE=true`, the sign-in page offers **Entrar con cuenta de demostración** for the seeded "Operador demo".

Access is invite-only:

```bash
bun run operator:invite -- --org org_demo --email ana@empresa.mx --name "Ana López" --role admin
```

`--create-org "Agua del Norte" --kind utility` creates the organization instead of `--org`. Roles: `owner` and `admin` edit sensors and rotate keys; `viewer` only reads. Sign-in links are single use and expire in 15 minutes. With `EMAIL_DRIVER=console` (the only driver for now) the link is printed by the script and in the server log; a real email provider is chosen before launch.
