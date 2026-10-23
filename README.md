# Cauce

Community flood-reporting map for Mexico, piloted in Matamoros, Tamaulipas. Anyone in the country reports what floods their street with one photo, water-level sensors feed live readings, and authorities get an explainable view of where to clean drains before the next storm (the risk panel and sensors cover the Matamoros pilot for now).

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

## National scope and going public

Reports are accepted anywhere in Mexico. The rules and data behind that:
- **Service area:** `src/config/service-area.json` is Mexico's land outline from Natural Earth (public domain), buffered 5 km so coasts and the border river are never rejected, and simplified to ~850 vertices. Rebuild it with `bun run data:service-area -- ne_10m_admin_0_countries.geojson`.
- **Place search:** `public/data/places-mx.json` holds the 32 states and ~4,100 towns (2,500+ people or a municipal seat) from [GeoNames](https://download.geonames.org/export/dump/) (CC BY 4.0). It loads the first time someone opens the search. Rebuild it with `bun run data:places -- cities1000.txt MX.txt admin1CodesASCII.txt`.
- **Where the map opens:** a deep link, else the last view on that device, else the visitor's approximate city from Vercel's IP geolocation headers (`/api/geo`; nothing is stored), else all of Mexico. Locally there are no such headers, so it opens on the national view.
- **Place names:** reverse geocoding (Nominatim, needs `GEOCODER_CONTACT_EMAIL`) now also stores the municipality and state of each report (`0006_report_municipality.sql`; run `bun run db:migrate`).
- **Demo data:** seeded reports and the demo organization's sensors are flagged in the map feeds. People can hide them, and they never count as nearby neighbors. With `DEMO_MODE=true`, `/panel/entrar` also offers a read-only **Entrar como demostración** session for judges.

### Demo scenarios (Matamoros and Zacatecas)

`bun run seed:scenario` asks for a city (Matamoros, Zacatecas–Guadalupe or both), a scenario and how many reports, then writes them on real streets and drains:

| Scenario     | What the map shows                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| `storm`      | It has rained for ~3 h and the water keeps rising, after days of clogged-drain reports nobody cleaned.          |
| `aftermath`  | The storm was the night before last: water drained except in low spots; sewage, loose covers and debris remain. |
| `prevention` | Two weeks of clogged drains, open manholes and trash in channels; crews already cleaned some.                   |
| `season`     | 60 days with two storms, for history and trends.                                                                |

Each report has a photo that matches the problem and its severity (Wikimedia Commons, credited on the report), a note like the ones residents write, "Sigue ahí" confirmations and fixes. Answer the last question with a number of seconds (or pass `--live 20`) to keep adding reports and confirmations while you present; the map picks them up on its own. Flags skip the questions: `--city zacatecas --scenario storm --density normal --live 20 --yes`. A new run replaces only scenario reports; `--clear` removes them, and Matamoros' `bun run seed` data stays unless you choose to clear it.

For a local presentation, run these commands in the same terminal (the database otherwise comes from `.env.local`):

```sh
export TURSO_DATABASE_URL=file:local.db
export TURSO_AUTH_TOKEN=
bun run db:migrate
bun run seed:scenario --city both --scenario storm --live 20 --yes
```

Run `bun run dev` in another terminal with the same database settings. The map refreshes every 15 seconds; Ctrl+C stops live mode immediately. Without `--live`, the script exits after seeding. `--clear --city zacatecas --yes` clears only that city's scenarios; `--clear-base` explicitly removes the historical Matamoros reports. Replacements are atomic and preserve real reports and the other city's data; the historical seed also preserves scenario reports. `--help` lists every option. The empty map offers shortcuts to both cities.

The 58 photos illustrate similar problems and may come from other places; they are not evidence of actual incidents at these coordinates. Original authors, sources and license links are in `src/config/demo-photos.json` and shown under each report photo, including the resizing/conversion notice. The image derivatives retain their original licenses (see `public/seed/photos/README.md`).

The 342 points (198 in Matamoros, 144 in Zacatecas–Guadalupe) come from `data/scenario-places.json`: streets and drains from OpenStreetMap, with the address and municipio that reverse geocoding gives a real report there. Seeding works offline. Rebuild the points after changing `scripts/lib/scenario-cities.ts` with `bun run data:scenario-places --osm-dir /tmp/cauce-scenario-osm` (needs `GEOCODER_CONTACT_EMAIL`; several minutes). That directory caches Overpass and Nominatim results so interrupted builds can resume. Missing geocoder settings or incomplete data fail without replacing the committed file.

### Before sharing the link

1. Deploy (Vercel + Turso + R2, as in `.env.example`), run `bun run db:migrate` against Turso and `bun run check:env`.
2. Set `CONTACT_EMAIL`, the public contact shown on `/privacidad`. Have someone qualified review `/privacidad` and `/terminos` before a formal launch.
3. **Turnstile:** in the Cloudflare dashboard, add a Turnstile widget (mode _Managed_) for your production hostname and `localhost`. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` and `TURNSTILE_HOSTNAMES` (the production hostname only; never `localhost` in production). The widget stays invisible unless Cloudflare needs a click. Every send, including reports queued offline, asks for a fresh token, and the server checks the `report` action and the hostname. Cloudflare's public test keys return no action, so they are rejected by design; test with a real widget.
4. **Photo moderation:** set `PHOTO_MODERATION_ENABLED=true` with `OPENAI_API_KEY`. Photos and notes go through OpenAI's free `omni-moderation-latest` before a report is saved. Flagged content is rejected with a friendly message, and outages never block a report.
5. Keep `DEMO_MODE=true` (and `bun run seed`) while judges review the project. Turn it off once real authorities use the panel: the read-only demo session can see private sensors.
