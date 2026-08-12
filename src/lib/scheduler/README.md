# Scheduler seam

This module is the single source of truth for every scheduled job in the app,
plus the fail-closed auth check every cron route must call. It exists so jobs
are declared once and can be driven by Vercel Cron today, or AWS EventBridge
(the AWS mirror) / Supabase pg_cron later, without redefining the job list
per platform.

## The registry is canonical

`jobs.ts` exports `SCHEDULED_JOBS: ScheduledJob[]` — the canonical list of
scheduled jobs (name, path, 5-field UNIX cron schedule in UTC, description,
and `onVercel`). `vercel.json`'s `crons` array is **derived from** this list,
not the other way around. `vercelJobs()` returns just the entries currently
wired into Vercel (`onVercel: true`); entries with `onVercel: false` are
known `CRON_SECRET`-guarded routes that exist but aren't scheduled anywhere
yet — documented here so they aren't lost.

`__tests__/jobs.test.ts` enforces the two directions never drift apart: every
`onVercel` job in the registry has a matching `{path, schedule}` entry in
`vercel.json`, and every `vercel.json` cron has a matching registry entry.
That test — not `scripts/gen-vercel-crons.mjs` — is the real drift guard.

## Adding or changing a job

1. Edit `SCHEDULED_JOBS` in `jobs.ts` (add the entry, or change its
   `schedule`/`path`).
2. If the job should run on Vercel, update `vercel.json`'s `crons` array to
   match exactly (`path` + `schedule`), and make sure `onVercel: true`.
3. Run `npm run crons:check` to confirm the registry and `vercel.json` agree.
4. Point the job's route handler at `cronGuard` (see below) if it's new.

`scripts/gen-vercel-crons.mjs` is a minimal, dependency-free reporter — it
just prints how many crons are currently in `vercel.json`. It does not
regenerate or write anything; keep the registry and `vercel.json` in sync by
hand and let `crons:check` catch mistakes.

## Fail-closed cron auth

`cron-auth.ts` exports `cronGuard(req: Request): Response | null`. Every cron
route calls it first, before doing any work:

```typescript
import { cronGuard } from "@/lib/scheduler";

const denied = cronGuard(request);
if (denied) return denied;
```

`cronGuard` returns a `401 Response` unless `CRON_SECRET` is set **and** the
request carries `Authorization: Bearer <CRON_SECRET>` — it returns `null`
(meaning "continue") only in that case. If `CRON_SECRET` is unset, the guard
rejects; it never falls open. This closes a prior bug where some routes only
checked the header *if* `CRON_SECRET` was set, so an unconfigured secret let
anyone trigger the job.

Contract: **`CRON_SECRET` must be set in every environment that runs these
crons** (local dev included, if you want to hit them manually). Vercel Cron
sends the header automatically in production. If the secret is missing in
any env, its crons will 401 there — that's expected and by design, not a
bug to work around.

## EventBridge export (AWS mirror)

`export-eventbridge.ts` exports `toEventBridgeSchedules()`, which maps
`vercelJobs()` through `unixToEventBridgeCron()` into AWS EventBridge
Scheduler expressions (`cron(min hr dom mon dow year)`, with the
day-of-month/day-of-week `?` rule EventBridge requires, and UNIX
day-of-week `0-6` shifted to EventBridge's `1-7`). This is how the AWS
mirror derives its schedule set from the same registry that drives
`vercel.json` — no separate job list to maintain there.
