# Cauce: conventions for coding agents

@AGENTS.md

Cauce is a mobile-first PWA where residents of Matamoros, Tamaulipas report flood problems with one photo on a map, IoT sensors push water levels, and authorities get an explainable risk view. It is a project for the Hackathon of the Agencia Espacial Mexicana (AEM). `PLAN.md` is the source of truth for scope, data model, API contracts and milestones; read the relevant section before changing behavior, and record any new default you pick in its §16.

## Language

- Code, identifiers, comments, docs, commit messages and AI prompts: **English**.
- Everything a user reads in the app (UI copy, toasts, errors shown to users, OG images, emails): **Spanish (es-MX)**, through `messages/es.json` (`messages/en.json` mirrors it). Never hard-code user-facing strings in components.
- User-facing URL paths are Spanish (`/acerca`, `/panel`); API paths are English (`/api/...`).

## Stack

Bun 1.4 (package manager and scripts) · Next.js 16.4 App Router with Cache Components · React 19.3 · TypeScript 7 strict · Tailwind 4 + shadcn/ui (Base UI) · Motion · Drizzle ORM + libSQL/Turso · Cloudflare R2 (S3 API, presigned PUT) · MapLibre GL JS 6 + OpenFreeMap · h3-js · Zod 4 · next-intl · Biome.

Next.js 16 differs from older versions: `proxy.ts` replaces `middleware.ts`, `params`/`searchParams`/`cookies()`/`headers()` are async, and caching is opt-in with `'use cache'`. When unsure, read the docs bundled in `node_modules/next/dist/docs/`.

## Commands

```bash
bun dev                 # dev server
bun run typecheck       # next typegen && tsc --noEmit
bun run lint            # biome check
bun run format          # biome check --write
bun test                # unit tests for business logic
bun run db:generate     # drizzle-kit generate (after schema changes)
bun run db:migrate      # apply migrations to TURSO_DATABASE_URL
bun run seed            # demo data for Matamoros
```

## Code organization

- `src/app/` is routing only: thin pages, layouts and route handlers.
- `src/features/<feature>/` holds each feature (`reports`, `map`, `devices`, `insights`, `ai`): `components/`, `client/` (browser-only logic), `server/` (marked `import "server-only"`), and Zod schemas.
- `src/lib/` holds shared infrastructure (db, storage, env, h3, rate limiting, http errors).
- Business logic never lives in components. Pure rules (signals, expiry, risk scoring, ingest validation) are plain functions with `bun test` coverage.
- Only `src/features/map/` imports `maplibre-gl`; everything else uses its wrapper API.
- Validate every boundary with Zod: forms, route handlers, device payloads, env.
- Route handlers stay thin: parse → call a command/query → map errors with `src/lib/http.ts`.
- Avoid over-engineering: no abstractions without a second caller.

## Definition of done for each milestone

1. `bun run typecheck`, `bun run lint` and `bun test` pass.
2. The app runs and the change is checked in a browser at 375×812 (light and dark).
3. Changes are committed in coherent commits, followed by a 2–3 line summary.

## Commits

- Commit as the git identity configured on this machine (`git config user.name` / `user.email`). Never change it.
- Never add `Co-Authored-By` trailers, "Generated with …" lines, or any mention of Claude or AI in commits, PR descriptions or code.
- Use Conventional Commits (`feat(scope): …`, `fix: …`, `chore: …`, `docs: …`). Group changes into coherent, reviewable commits; no WIP or catch-all commits.
- Never push or add remotes unless explicitly asked.
