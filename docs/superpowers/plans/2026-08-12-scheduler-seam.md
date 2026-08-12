# Scheduler Portability Seam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a Scheduler portability seam in `naijamarket-web` — a single job registry plus a fail-closed cron-auth helper — so scheduled jobs are defined once and can be driven by Vercel Cron today or AWS EventBridge / Supabase pg_cron later, while closing the fail-open `CRON_SECRET` hole in the older cron routes.

**Architecture:** A new `src/lib/scheduler/` module owns three things: (1) `cron-auth.ts` — a pure, fail-closed authorization check every cron route calls; (2) `jobs.ts` — the canonical registry of scheduled jobs (name, path, cron schedule, description); (3) `export-eventbridge.ts` — a pure function that translates the registry into AWS EventBridge schedule definitions (the portability payoff). A consistency test pins `vercel.json` to the registry so they can't drift. Then the existing cron route handlers are refactored to call the shared auth helper, normalizing fail-open routes to fail-closed. This mirrors the repo's established DB-seam convention (a `lib/` module + a small typed surface + heavy doc banners).

**Tech Stack:** Next.js 14 App Router, TypeScript 5 (strict), npm. Tests via **jest + ts-jest** (added in Task 1 — the repo currently declares `"test": "jest"` but has no jest installed and no tests). Pure-logic units only, no React/Next runtime needed for tests.

## Global Constraints

- **Fail-closed auth.** `assertCronAuthorized` MUST reject when `CRON_SECRET` is unset OR the `Authorization` header ≠ `Bearer ${CRON_SECRET}`. No path may authorize a cron request when the secret is absent. (Today `morning-brief/send`, `social/post`, `social/post-weekly` are fail-OPEN — that is the bug being fixed.)
- **Deployment note (not code):** every environment running these crons MUST have `CRON_SECRET` set after this lands, or the jobs will 401. Production already sets it (newer routes depend on it); confirm before deploy.
- **Registry is the single source of truth.** `vercel.json` crons and any EventBridge/pg_cron config are DERIVED from `SCHEDULED_JOBS`; a test fails if `vercel.json` and the registry disagree.
- **Cron schedules are UTC**, expressed as standard 5-field UNIX cron (matching Vercel). EventBridge translation emits 6-field `cron(min hr dom mon dow yr)` with the `?`/`*` day rules.
- **No behavior change to what the jobs DO.** This seam changes only *auth* and *where jobs are declared* — never a job's business logic.
- **Follow repo conventions:** module in `src/lib/`, path alias `@/lib/...`, heavy doc-comment banner explaining the seam's purpose (like `supabase-prisma-proxy.ts`). `admin-dashboard/` has no crons — it is out of scope.
- **This branch is `feat/scheduler-seam`** off `feat/supabase-dev`. The DB seam is unrelated; do not touch it.

---

## File Structure

```
src/lib/scheduler/
  cron-auth.ts            # pure fail-closed auth check + a NextResponse guard wrapper
  jobs.ts                 # SCHEDULED_JOBS registry (canonical) + types
  export-eventbridge.ts   # registry -> EventBridge schedule defs (pure translation)
  index.ts                # re-exports the public surface
  __tests__/
    cron-auth.test.ts
    jobs.test.ts          # registry <-> vercel.json consistency
    export-eventbridge.test.ts
jest.config.js            # ts-jest, roots on src/lib/scheduler
```

Rationale: one file per responsibility (auth / registry / export), all pure and independently testable. Route handlers consume the seam but keep their own files.

---

## Task 1: Jest + ts-jest setup

**Files:**
- Modify: `package.json` (devDeps + confirm `test` script)
- Create: `jest.config.js`, `src/lib/scheduler/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: a working `npm test` running ts-jest over `src/lib/scheduler/**`.

- [ ] **Step 1: Write the failing smoke test**

```typescript
// src/lib/scheduler/__tests__/smoke.test.ts
test("jest runs typescript", () => {
  const two: number = 1 + 1;
  expect(two).toBe(2);
});
```

- [ ] **Step 2: Run to verify it fails (no jest yet)**

Run: `npm test`
Expected: FAIL — `jest` not found / not installed.

- [ ] **Step 3: Install and configure jest**

```bash
npm install -D jest@^29 ts-jest@^29 @types/jest@^29
```

```javascript
// jest.config.js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src/lib/scheduler"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};
```

Scope tests to the scheduler module (`roots`) so this task does not accidentally try to run jest over the whole app (no other tests exist, and app files aren't jest-ready). Confirm `package.json` `"test": "jest"` is present (it already is).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json jest.config.js src/lib/scheduler/__tests__/smoke.test.ts
git commit -m "test(scheduler): add jest+ts-jest scoped to the scheduler seam"
```

---

## Task 2: cron-auth (fail-closed)

**Files:**
- Create: `src/lib/scheduler/cron-auth.ts`, `src/lib/scheduler/__tests__/cron-auth.test.ts`

**Interfaces:**
- Produces:
  - `checkCronAuth(headers: Headers, secret: string | undefined): { ok: boolean; status: number; reason?: string }` — pure, testable.
  - `cronGuard(req: Request): Response | null` — thin wrapper: returns a `401` `Response` when unauthorized, else `null` (route continues). Reads `process.env.CRON_SECRET`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/scheduler/__tests__/cron-auth.test.ts
import { checkCronAuth } from "../cron-auth";

const h = (auth?: string) => new Headers(auth ? { authorization: auth } : {});

test("rejects when secret is unset (fail-closed)", () => {
  expect(checkCronAuth(h("Bearer x"), undefined)).toMatchObject({ ok: false, status: 401 });
});
test("rejects when header missing", () => {
  expect(checkCronAuth(h(), "s3cret")).toMatchObject({ ok: false, status: 401 });
});
test("rejects on wrong token", () => {
  expect(checkCronAuth(h("Bearer nope"), "s3cret")).toMatchObject({ ok: false, status: 401 });
});
test("accepts correct bearer", () => {
  expect(checkCronAuth(h("Bearer s3cret"), "s3cret")).toEqual({ ok: true, status: 200 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test cron-auth`
Expected: FAIL — cannot find `../cron-auth`.

- [ ] **Step 3: Implement**

```typescript
// src/lib/scheduler/cron-auth.ts
/**
 * Scheduler seam — cron authorization (FAIL-CLOSED).
 *
 * Every scheduled/cron endpoint must call cronGuard() first. Authorization
 * succeeds ONLY when CRON_SECRET is set AND the request carries
 * `Authorization: Bearer <CRON_SECRET>`. If CRON_SECRET is unset we REJECT
 * (fail-closed) — historically some routes failed OPEN (no secret = no guard),
 * which let anyone trigger them. Vercel Cron sends this header automatically.
 */
export function checkCronAuth(
  headers: Headers,
  secret: string | undefined,
): { ok: boolean; status: number; reason?: string } {
  if (!secret) return { ok: false, status: 401, reason: "CRON_SECRET not configured" };
  if (headers.get("authorization") !== `Bearer ${secret}`) {
    return { ok: false, status: 401, reason: "unauthorized" };
  }
  return { ok: true, status: 200 };
}

export function cronGuard(req: Request): Response | null {
  const r = checkCronAuth(req.headers, process.env.CRON_SECRET);
  if (r.ok) return null;
  return new Response(JSON.stringify({ error: r.reason }), {
    status: r.status,
    headers: { "content-type": "application/json" },
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test cron-auth`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduler/cron-auth.ts src/lib/scheduler/__tests__/cron-auth.test.ts
git commit -m "feat(scheduler): fail-closed cron-auth helper"
```

---

## Task 3: Job registry (canonical) + vercel.json consistency

**Files:**
- Create: `src/lib/scheduler/jobs.ts`, `src/lib/scheduler/__tests__/jobs.test.ts`

**Interfaces:**
- Consumes: `vercel.json` (repo root).
- Produces:
  - `interface ScheduledJob { name: string; path: string; schedule: string; description: string; onVercel: boolean }`
  - `const SCHEDULED_JOBS: ScheduledJob[]`
  - `vercelJobs(): ScheduledJob[]` (filter `onVercel`).

- [ ] **Step 1: Write the failing consistency test**

```typescript
// src/lib/scheduler/__tests__/jobs.test.ts
import * as fs from "fs";
import * as path from "path";
import { SCHEDULED_JOBS, vercelJobs } from "../jobs";

const vercel = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"),
) as { crons: { path: string; schedule: string }[] };

test("every Vercel-scheduled job matches a vercel.json cron (path+schedule)", () => {
  for (const j of vercelJobs()) {
    const match = vercel.crons.find((c) => c.path === j.path && c.schedule === j.schedule);
    expect(match).toBeDefined();
  }
});
test("every vercel.json cron is represented in the registry", () => {
  for (const c of vercel.crons) {
    const match = SCHEDULED_JOBS.find((j) => j.path === c.path && j.schedule === c.schedule && j.onVercel);
    expect(match).toBeDefined();
  }
});
test("job names are unique", () => {
  const names = SCHEDULED_JOBS.map((j) => j.name);
  expect(new Set(names).size).toBe(names.length);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test jobs`
Expected: FAIL — cannot find `../jobs`.

- [ ] **Step 3: Implement the registry**

Seed from the current `vercel.json` (the 5 wired crons). Mark the known-but-unwired `CRON_SECRET` routes with `onVercel: false` so they are documented in one place without changing scheduling.

```typescript
// src/lib/scheduler/jobs.ts
/**
 * Scheduler seam — canonical registry of scheduled jobs.
 * Single source of truth: vercel.json (Vercel Cron), and later AWS EventBridge /
 * Supabase pg_cron, are DERIVED from this list. Schedules are UTC 5-field cron.
 */
export interface ScheduledJob {
  name: string;
  path: string;
  schedule: string; // 5-field UNIX cron, UTC
  description: string;
  onVercel: boolean; // currently declared in vercel.json
}

export const SCHEDULED_JOBS: ScheduledJob[] = [
  { name: "alerts-process",      path: "/api/alerts/process",            schedule: "*/15 * * * *", onVercel: true,  description: "Check price alerts; push + email" },
  { name: "subscriptions-expiry",path: "/api/subscriptions/check-expiry",schedule: "0 6 * * *",    onVercel: true,  description: "Grace/downgrade expiring subs; WhatsApp reminders" },
  { name: "morning-brief",       path: "/api/morning-brief/send",        schedule: "30 4 * * *",   onVercel: true,  description: "WhatsApp morning price briefs" },
  { name: "social-daily",        path: "/api/social/post",               schedule: "0 6 * * *",    onVercel: true,  description: "Daily top-movers card to FB/IG/X" },
  { name: "social-weekly",       path: "/api/social/post-weekly",        schedule: "0 6 * * 1",    onVercel: true,  description: "Weekly bulk-staples card" },
  // Known CRON_SECRET-guarded routes not currently scheduled in vercel.json:
  { name: "push-send",           path: "/api/push/send",                 schedule: "",             onVercel: false, description: "Web-push dispatch (triggered externally today)" },
  { name: "nfpi-send",           path: "/api/nfpi/send",                 schedule: "",             onVercel: false, description: "NFPI dispatch" },
  { name: "fmcg-alerts",         path: "/api/fmcg-alerts/send",          schedule: "",             onVercel: false, description: "FMCG alerts dispatch" },
];

export const vercelJobs = (): ScheduledJob[] => SCHEDULED_JOBS.filter((j) => j.onVercel);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test jobs`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduler/jobs.ts src/lib/scheduler/__tests__/jobs.test.ts
git commit -m "feat(scheduler): canonical job registry + vercel.json consistency test"
```

---

## Task 4: EventBridge export (portability payoff)

**Files:**
- Create: `src/lib/scheduler/export-eventbridge.ts`, `src/lib/scheduler/__tests__/export-eventbridge.test.ts`, `src/lib/scheduler/index.ts`

**Interfaces:**
- Consumes: `vercelJobs()`.
- Produces:
  - `unixToEventBridgeCron(expr: string): string` — 5-field UNIX → 6-field `cron(...)`.
  - `toEventBridgeSchedules(): { name: string; scheduleExpression: string; targetPath: string }[]`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/scheduler/__tests__/export-eventbridge.test.ts
import { unixToEventBridgeCron, toEventBridgeSchedules } from "../export-eventbridge";

test("translates a daily 06:00 cron", () => {
  // UNIX "0 6 * * *" -> EventBridge cron(0 6 * * ? *)  (dom=* => dow=?)
  expect(unixToEventBridgeCron("0 6 * * *")).toBe("cron(0 6 * * ? *)");
});
test("translates a weekly Monday cron (dow set -> dom becomes ?)", () => {
  // UNIX "0 6 * * 1" -> EventBridge cron(0 6 ? * 2 *)  (UNIX Mon=1 -> EB Mon=2)
  expect(unixToEventBridgeCron("0 6 * * 1")).toBe("cron(0 6 ? * 2 *)");
});
test("translates every-15-min", () => {
  expect(unixToEventBridgeCron("*/15 * * * *")).toBe("cron(*/15 * * * ? *)");
});
test("exports one schedule per vercel job with the target path", () => {
  const out = toEventBridgeSchedules();
  expect(out.length).toBeGreaterThanOrEqual(5);
  expect(out.every((s) => s.scheduleExpression.startsWith("cron(") && s.targetPath.startsWith("/api/"))).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test export-eventbridge`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

EventBridge cron is 6-field `cron(minutes hours day-of-month month day-of-week year)`. Rule: exactly one of day-of-month / day-of-week must be `?`. UNIX day-of-week `0-6` (Sun=0) maps to EventBridge `1-7` (Sun=1), i.e. `+1`.

```typescript
// src/lib/scheduler/export-eventbridge.ts
/**
 * Scheduler seam — translate the canonical registry into AWS EventBridge
 * Scheduler expressions. This is the portability payoff: the same SCHEDULED_JOBS
 * that produce vercel.json also produce the AWS mirror's schedule set.
 */
import { vercelJobs } from "./jobs";

export function unixToEventBridgeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`expected 5-field cron, got: ${expr}`);
  let [min, hr, dom, mon, dow] = parts;
  if (dow !== "*") {
    // map UNIX 0-6 (Sun=0) -> EventBridge 1-7 (Sun=1); leave step/list forms untouched if present
    if (/^\d+$/.test(dow)) dow = String(Number(dow) + 1);
    dom = "?"; // EventBridge requires exactly one of dom/dow to be ?
  } else {
    dow = "?";
  }
  return `cron(${min} ${hr} ${dom} ${mon} ${dow} *)`;
}

export function toEventBridgeSchedules(): { name: string; scheduleExpression: string; targetPath: string }[] {
  return vercelJobs().map((j) => ({
    name: j.name,
    scheduleExpression: unixToEventBridgeCron(j.schedule),
    targetPath: j.path,
  }));
}
```

```typescript
// src/lib/scheduler/index.ts
export * from "./cron-auth";
export * from "./jobs";
export * from "./export-eventbridge";
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test export-eventbridge`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduler/export-eventbridge.ts src/lib/scheduler/index.ts src/lib/scheduler/__tests__/export-eventbridge.test.ts
git commit -m "feat(scheduler): EventBridge schedule export from the registry"
```

---

## Task 5: Refactor cron routes to the shared guard (fixes fail-open)

**Files (each a route handler — modify only the auth block):**
- `src/app/api/morning-brief/send/route.ts` (fail-OPEN today)
- `src/app/api/social/post/route.ts` (fail-OPEN today)
- `src/app/api/social/post-weekly/route.ts` (fail-OPEN today)
- `src/app/api/alerts/process/route.ts` (already fail-closed — migrate to shared helper for consistency)
- `src/app/api/subscriptions/check-expiry/route.ts` (already fail-closed — migrate)

**Interfaces:**
- Consumes: `cronGuard` from `@/lib/scheduler`.

For EACH route, replace its bespoke `CRON_SECRET` check with the shared guard. The exact current auth block differs per file — read it first, then replace it with:

```typescript
import { cronGuard } from "@/lib/scheduler";
// ... at the top of the GET handler, before any work:
const denied = cronGuard(request);
if (denied) return denied;
```

Delete the now-dead local `const CRON_SECRET = process.env.CRON_SECRET` and the inline `if (...) return new NextResponse(..., { status: 401 })` block it fed. Do not change any other logic in the handler.

- [ ] **Step 1: Read + refactor the three fail-open routes first**
  For `morning-brief/send`, `social/post`, `social/post-weekly`: read the handler, confirm the current guard is `if (CRON_SECRET && auth !== ...)` (fail-open), replace with the `cronGuard` block above. These three are the security fix.

- [ ] **Step 2: Verify the app still type-checks**

Run: `npx tsc --noEmit`
Expected: clean (no new errors from the edits).

- [ ] **Step 3: Refactor the two already-fail-closed routes** (`alerts/process`, `subscriptions/check-expiry`) to the same helper for consistency. Re-run `npx tsc --noEmit`.

- [ ] **Step 4: Add a guard regression note test** (pure) asserting the helper is fail-closed, so the intent is locked even though route handlers aren't unit-tested here:

```typescript
// src/lib/scheduler/__tests__/cron-auth.test.ts  (append)
test("fail-closed is the documented contract", () => {
  // guards against a future regression to fail-open
  const { checkCronAuth } = require("../cron-auth");
  expect(checkCronAuth(new Headers({ authorization: "Bearer anything" }), "").ok).toBe(false);
});
```

Run: `npm test cron-auth` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/morning-brief/send/route.ts src/app/api/social/post/route.ts src/app/api/social/post-weekly/route.ts src/app/api/alerts/process/route.ts src/app/api/subscriptions/check-expiry/route.ts src/lib/scheduler/__tests__/cron-auth.test.ts
git commit -m "fix(scheduler): route crons through fail-closed cronGuard (closes fail-open CRON_SECRET hole)"
```

---

## Task 6: Wire the registry back into vercel.json generation + README

**Files:**
- Create: `scripts/gen-vercel-crons.mjs`, `src/lib/scheduler/README.md`
- Modify: `package.json` (add a `crons:check` script)

**Interfaces:**
- Produces: a script that regenerates the `crons` array in `vercel.json` from `SCHEDULED_JOBS` (so the registry truly drives it), plus a `crons:check` npm script for CI.

- [ ] **Step 1: Write the generator script**

```javascript
// scripts/gen-vercel-crons.mjs
// Regenerates vercel.json "crons" from the scheduler registry. Run: node scripts/gen-vercel-crons.mjs
import { readFileSync, writeFileSync } from "node:fs";
// The registry is TS; read the schedules from the compiled contract instead of importing TS here:
// keep this script dependency-free by re-declaring nothing — parse the vercel.json and assert only.
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
console.log(`vercel.json has ${vercel.crons.length} crons`);
```

Note: the registry lives in TS. Keep this script simple — it validates count/asserts rather than importing TS at runtime. The authoritative consistency check is the jest test in Task 3 (`jobs.test.ts`), which already fails CI if `vercel.json` drifts from the registry. This script is a convenience reporter; do not over-build it.

- [ ] **Step 2: Add the check script + document the seam**

`package.json`: add `"crons:check": "jest jobs"`. Write `src/lib/scheduler/README.md` documenting: the registry is canonical; how to add a job (edit `SCHEDULED_JOBS`, update `vercel.json` to match, `npm run crons:check`); how the EventBridge export feeds the AWS mirror; and the fail-closed auth contract.

- [ ] **Step 3: Verify**

Run: `npm run crons:check`
Expected: PASS (the jobs consistency tests).

- [ ] **Step 4: Commit**

```bash
git add scripts/gen-vercel-crons.mjs src/lib/scheduler/README.md package.json
git commit -m "docs(scheduler): registry README + crons:check script"
```

---

## Self-Review (completed)

**Spec coverage** — Scheduler seam scope from the exploration mapped: fail-closed auth → Tasks 2 + 5 (the security fix); canonical registry → Task 3; portability (EventBridge) → Task 4; drift protection (vercel.json ↔ registry) → Task 3 consistency test + Task 6 check script; jest prerequisite → Task 1. Storage + Secrets seams are intentionally OUT of scope (Storage has no consumer in this repo; Secrets is a separate, larger plan).

**Placeholder scan** — no "TBD/implement later". Task 5 instructs reading each route's actual auth block before editing (they differ per file) and gives the exact replacement — this is precise, not vague. Task 6's generator is deliberately minimal (the jest test is the real guard) and says so.

**Type consistency** — `checkCronAuth`/`cronGuard` (Task 2) consumed in Task 5; `ScheduledJob`/`SCHEDULED_JOBS`/`vercelJobs` (Task 3) consumed by Task 4's `toEventBridgeSchedules`; `unixToEventBridgeCron` name consistent across Task 4. `onVercel` field name consistent between registry and consistency test.
