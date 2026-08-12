# `src/lib/env.ts` — the env seam

## Why this module exists

Before this seam, DB credentials and other secrets were read as raw
`process.env.X` reads scattered across routes — and the DB credentials in
particular had drifted into **three different naming conventions**
(`AZURE_SQL_*`, `DATABASE_*`, `SQL_*`) depending on which route or era wrote
them, with irregular names inside each (`DATABASE_NAME` not
`DATABASE_DATABASE`; `SQL_USERNAME`/`SQL_USER` not `SQL_USER` alone). Every
call site that inlined its own `||` fallback chain was one typo away from
silently picking up an empty string instead of the real credential.

`env.ts` is the single source of truth: one place that knows every accepted
name for every secret the app reads, in the right precedence, with the same
defaults the app already relied on. New code should read `env.*` instead of
`process.env` directly.

## The helpers

- **`req(name)`** — for a secret the app cannot run without. Throws a clear
  `Error` naming the missing variable if it's unset or empty. Use this when a
  missing value should fail loudly and immediately (e.g. inside a route
  handler that cannot function without it), not fall through as `undefined`.
- **`opt(name, fallback?)`** — for a secret that's genuinely optional (a
  feature flag, an integration that may not be configured in every
  environment). Returns the fallback (or `undefined`) instead of throwing.
- **`firstDefined(names[], fallback?)`** — the alias-reconciliation primitive.
  Walks a list of env-var names in priority order and returns the first one
  that is set and non-empty, else the fallback. This is what `env.db` is
  built from — it is how a canonical name and its aliases are collapsed into
  one accessor.

Use `req`/`opt` directly for a single-name secret. Use `firstDefined` (or add
a getter to `env`) when a value has more than one accepted env-var name.

## `env.db` — the DB-credential precedence

```
AZURE_SQL_*  >  DATABASE_*  >  SQL_*  >  built-in default
```

Concretely, for each field:

| Field    | Canonical           | Alias 1 (irregular)     | Alias 2 (irregular)             | Default |
|----------|----------------------|--------------------------|-----------------------------------|---------|
| server   | `AZURE_SQL_SERVER`   | `DATABASE_SERVER`        | `SQL_SERVER`                      | `naijafood.database.windows.net` |
| database | `AZURE_SQL_DATABASE` | `DATABASE_NAME`          | `SQL_DATABASE`                    | `naijafoodmarket-live` |
| user     | `AZURE_SQL_USER`     | `DATABASE_USER`          | `SQL_USERNAME` (also `SQL_USER`)  | `""` |
| password | `AZURE_SQL_PASSWORD` | `DATABASE_PASSWORD`      | `SQL_PASSWORD`                    | `""` |

This precedence and these defaults are **behavior-preserving** — they match
what the inline `||` chains in routes like `api/prices` computed before the
migration (`src/lib/env.test.ts` has the precedence tests). Adding a new
alias for a field means appending it to that field's `firstDefined([...])`
array here, keeping AZURE_SQL_* first.

### The admin-dashboard caveat

`admin-dashboard/` is a **separate app** inside this repo with its own
`lib/db.ts` that uses an **inverted, SQL\_\*-first** precedence — `SQL_*` wins
over `AZURE_SQL_*` there. It does not import `src/lib/env.ts`. **Do not wire
`env.db` into admin-dashboard without deliberately handling that inversion**
— doing so naively would silently flip which credential set admin-dashboard
picks up in any environment where both conventions are set.

## Secrets are env-injected, not fetched at runtime

This module has no SDK dependency and makes no network call to a secrets
service. It only reads `process.env`. Every platform this app runs on injects
secrets into `process.env` at deploy/build time, and `env.ts` just gives that
injected data one typed, validated read path:

- **Vercel** — Project → Settings → Environment Variables, injected per
  environment (Development/Preview/Production) before the process starts.
- **Supabase** — connection secrets (`SUPABASE_DB_URL`, service keys) come
  from the Supabase project settings and are injected the same way, via
  Vercel env vars — there is no separate runtime fetch.
- **AWS (if/when relevant)** — AWS Secrets Manager values would be resolved
  to environment variables at deploy time (e.g. via the platform's secret
  injection step), landing back in `process.env` — `env.ts` would not change.

If a future need arises for values that must be fetched live at runtime
(rotated per-request, etc.), that is a different, explicit mechanism — not
something to bolt onto this module.

## Migration guidance

- **New code**: always read secrets via `env.*` (or add a new getter/group to
  `env` in `env.ts` if the secret isn't covered yet). Don't add new raw
  `process.env.X` reads outside this module.
- **Existing code**: raw `process.env` reads migrate to `env.*` gradually,
  one PR at a time, as routes are touched anyway — this is not a
  find-and-replace sweep. `api/prices` was migrated first as the reference
  example (see its `env.db` usage).
- **Excluded for now**: the Twilio routes (`TWILIO_*`, e.g.
  `nfpi/send`, `morning-brief/send`, and related) are under active cleanup on
  a separate branch (`chore/twilio-meta-cleanup`). Do not migrate or touch
  those env reads from this seam — leave them alone until that work lands to
  avoid merge collisions.
