# Central Typed Env/Config Module (Secrets Seam) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace scattered raw `process.env.X` reads in `naijamarket-web` with one validated `src/lib/env.ts` module — reconciling the three inconsistent DB-credential naming conventions (`AZURE_SQL_*` / `DATABASE_*` / `SQL_*`) behind a single accessor, and giving the platform a single manifest of what secrets it needs (which maps cleanly to Vercel / Supabase / AWS Secrets Manager env injection). Secrets stay env-injected on every platform — this is NOT a runtime Secrets Manager SDK.

**Architecture:** A dependency-free `src/lib/env.ts` exposes small `req()`/`opt()`/`firstDefined()` readers and a typed, grouped `env` object (db, dbBackend, auth, cron, payments, email, social — the concerns actually used). The DB block encodes the exact alias precedence (`AZURE_SQL_* || DATABASE_* || SQL_* || default`) so it is behavior-preserving for existing call sites while unifying all three conventions. One representative live consumer (`api/prices`) is migrated to prove the pattern; broad migration is deliberately gradual/out-of-scope. Docs + `.env.example` canonicalize the names.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, npm. Tests via **jest + ts-jest** (already present from the scheduler seam; `jest.config.js` `roots` widened in Task 1). No new deps — no zod, no AWS SDK.

## Global Constraints

- **Behavior-preserving.** `env.db.*` must resolve to the SAME value existing call sites compute today. The canonical precedence is `AZURE_SQL_X ?? DATABASE_X ?? SQL_X ?? <existing default>` using the exact per-convention names (note the irregular ones: `DATABASE_NAME` not `DATABASE_DATABASE`; `SQL_USERNAME` not `SQL_USER`). Defaults match today's inline defaults (`naijafood.database.windows.net`, `naijafoodmarket-live`, `""`, `""`).
- **No runtime SDK / no new deps.** Secrets are read from `process.env` only; each platform injects them (Vercel env / Supabase / AWS Secrets Manager → env at deploy).
- **`req()` fails loud, `opt()` is nullable.** A required secret that is unset throws a clear `Error` naming the variable — never returns `undefined`/`""` silently for a required value.
- **Do NOT migrate Twilio routes.** A concurrent session (`chore/twilio-meta-cleanup`) is removing/migrating Twilio routes (`nfpi/send`, `morning-brief/send`, etc.). This plan stays at the lib level + `api/prices` only, to avoid collisions. Do not touch `TWILIO_*` (deprecated) or any route under active Twilio cleanup.
- **Follow the repo's seam convention** (`src/lib/db.ts` style: thin lib module, single-quote strings, heavy doc banner) and jest scoping.
- **Branch `feat/secrets-seam`** off `feat/supabase-dev`.

---

## File Structure

```
src/lib/env.ts                 # the typed config module (readers + grouped `env`)
src/lib/env.test.ts            # jest — DB-cred precedence + req/opt behavior
jest.config.js                 # widen roots to include src/lib (or add src/lib/env)
src/app/api/prices/route.ts    # migrate its 4 inline SQL-cred reads to env.db
.env.example                   # canonicalize names + document the aliases
```

---

## Task 1: Widen jest to run env tests

**Files:**
- Modify: `jest.config.js`
- Create: `src/lib/env.test.ts` (temporary smoke test)

**Interfaces:**
- Produces: `npm test` runs both the scheduler tests and `src/lib/env.test.ts`.

- [ ] **Step 1: Write a smoke test**

```typescript
// src/lib/env.test.ts
test("jest picks up env tests", () => { expect(1 + 1).toBe(2); });
```

- [ ] **Step 2: Run to verify it is NOT yet collected**

Run: `npm test`
Expected: only the `src/lib/scheduler` tests run (jest `roots` is scoped there); the new file is ignored.

- [ ] **Step 3: Widen `roots`**

In `jest.config.js`, change `roots: ["<rootDir>/src/lib/scheduler"]` to include the env tests too:

```javascript
roots: ["<rootDir>/src/lib/scheduler", "<rootDir>/src/lib"],
```

(Confirm this does NOT sweep in the whole app — `roots` only affects test discovery, and the only `*.test.ts` files under `src/lib` are the scheduler ones + this new one. If widening to `src/lib` accidentally collects something unintended, instead use a narrower second root or a `testMatch`. Verify by running and reading which files execute.)

- [ ] **Step 4: Run to verify both run**

Run: `npm test`
Expected: scheduler tests + the env smoke test all pass.

- [ ] **Step 5: Commit**

```bash
git add jest.config.js src/lib/env.test.ts
git commit -m "test(env): widen jest roots to include the env module tests"
```

---

## Task 2: The typed env module

**Files:**
- Create: `src/lib/env.ts`
- Modify: `src/lib/env.test.ts` (replace smoke test with real tests)

**Interfaces:**
- Produces:
  - `firstDefined(names: string[], fallback?: string): string | undefined`
  - `req(name: string): string` (throws if unset/empty)
  - `opt(name: string, fallback?: string): string | undefined`
  - `env` object with at least: `env.db { server, database, user, password }`, `env.dbBackend { isSupabase: boolean, supabaseUrl?: string, databaseUrl?: string }`, `env.cron { secret? }`, `env.auth { jwtSecret?, nextauthSecret?, consumerJwtSecret? }`.

- [ ] **Step 1: Write the failing tests** (DB-cred precedence is the load-bearing behavior)

```typescript
// src/lib/env.test.ts  (replace)
describe("env.db credential reconciliation", () => {
  const KEYS = ["AZURE_SQL_SERVER","DATABASE_SERVER","SQL_SERVER",
    "AZURE_SQL_DATABASE","DATABASE_NAME","SQL_DATABASE",
    "AZURE_SQL_USER","DATABASE_USER","SQL_USERNAME",
    "AZURE_SQL_PASSWORD","DATABASE_PASSWORD","SQL_PASSWORD"];
  const clear = () => KEYS.forEach((k) => delete process.env[k]);
  beforeEach(clear);
  afterAll(clear);

  function loadDb() { jest.resetModules(); return require("./env").env.db; }

  test("prefers AZURE_SQL_* over DATABASE_* over SQL_*", () => {
    process.env.SQL_SERVER = "sql-host"; process.env.DATABASE_SERVER = "db-host"; process.env.AZURE_SQL_SERVER = "azure-host";
    expect(loadDb().server).toBe("azure-host");
  });
  test("falls back to DATABASE_* when AZURE_SQL_* unset", () => {
    process.env.DATABASE_NAME = "db-name";
    expect(loadDb().database).toBe("db-name");
  });
  test("falls back to the irregular SQL_* names (SQL_USERNAME)", () => {
    process.env.SQL_USERNAME = "sqluser";
    expect(loadDb().user).toBe("sqluser");
  });
  test("uses the existing defaults when nothing is set", () => {
    const db = loadDb();
    expect(db.server).toBe("naijafood.database.windows.net");
    expect(db.database).toBe("naijafoodmarket-live");
    expect(db.user).toBe("");
    expect(db.password).toBe("");
  });
});

describe("req/opt", () => {
  test("req throws on unset", () => {
    delete process.env.__X; const { req } = require("./env");
    expect(() => req("__X")).toThrow(/__X/);
  });
  test("opt returns fallback", () => {
    delete process.env.__Y; const { opt } = require("./env");
    expect(opt("__Y", "def")).toBe("def");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test env`
Expected: FAIL — cannot find `./env`.

- [ ] **Step 3: Implement `src/lib/env.ts`**

```typescript
// src/lib/env.ts
/**
 * Central typed env/config. One validated place that reads every secret the app
 * needs, so secrets aren't scattered as raw process.env reads with drifting names.
 * Secrets stay ENV-INJECTED on every platform (Vercel / Supabase / AWS Secrets
 * Manager -> env at deploy) — this is not a runtime secrets SDK.
 *
 * DB credentials historically use THREE naming conventions across the codebase:
 *   AZURE_SQL_* (routes)  |  DATABASE_* (routes, irregular DATABASE_NAME)  |
 *   SQL_* (admin-dashboard, irregular SQL_USERNAME).
 * env.db reconciles them with AZURE_SQL_* preferred, preserving existing defaults.
 */
export function firstDefined(names: string[], fallback?: string): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v !== undefined && v !== '') return v;
  }
  return fallback;
}
export function req(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === '') throw new Error(`Required env var ${name} is not set`);
  return v;
}
export function opt(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export const env = {
  db: {
    get server()   { return firstDefined(['AZURE_SQL_SERVER','DATABASE_SERVER','SQL_SERVER'], 'naijafood.database.windows.net')!; },
    get database() { return firstDefined(['AZURE_SQL_DATABASE','DATABASE_NAME','SQL_DATABASE'], 'naijafoodmarket-live')!; },
    get user()     { return firstDefined(['AZURE_SQL_USER','DATABASE_USER','SQL_USERNAME'], '')!; },
    get password() { return firstDefined(['AZURE_SQL_PASSWORD','DATABASE_PASSWORD','SQL_PASSWORD'], '')!; },
  },
  dbBackend: {
    get isSupabase() { return process.env.DB_BACKEND === 'supabase'; },
    get supabaseUrl() { return opt('SUPABASE_DB_URL'); },
    get databaseUrl() { return opt('DATABASE_URL'); },
  },
  cron:    { get secret() { return opt('CRON_SECRET'); } },
  auth:    {
    get jwtSecret()        { return opt('JWT_SECRET'); },
    get nextauthSecret()   { return opt('NEXTAUTH_SECRET'); },
    get consumerJwtSecret(){ return opt('CONSUMER_JWT_SECRET'); },
  },
};
```

Use getters so tests can mutate `process.env` and re-read; keep it single-quoted. Add other concern groups (payments/email/social) only if a real migrated caller needs them — YAGNI otherwise (this plan migrates only `api/prices`, which needs `env.db`).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test env`
Expected: PASS — all precedence + req/opt tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/env.ts src/lib/env.test.ts
git commit -m "feat(env): central typed config module + DB-cred reconciliation"
```

---

## Task 3: Migrate `api/prices` to `env.db` (prove the pattern, behavior-preserving)

**Files:**
- Modify: `src/app/api/prices/route.ts`

**Interfaces:**
- Consumes: `env.db` from `@/lib/env`.

- [ ] **Step 1: Read the route + its current cred block**

The current inline config (around lines 108-113) is:
```typescript
server:   process.env.AZURE_SQL_SERVER   || process.env.DATABASE_SERVER   || "naijafood.database.windows.net",
database: process.env.AZURE_SQL_DATABASE || process.env.DATABASE_NAME     || "naijafoodmarket-live",
user:     process.env.AZURE_SQL_USER     || process.env.DATABASE_USER     || "",
password: process.env.AZURE_SQL_PASSWORD || process.env.DATABASE_PASSWORD || "",
```

- [ ] **Step 2: Replace it with the accessor** (add `import { env } from "@/lib/env";` at the top):

```typescript
server:   env.db.server,
database: env.db.database,
user:     env.db.user,
password: env.db.password,
```

`env.db` yields identical values (same precedence + same defaults; it merely ADDS the `SQL_*` fallback, which is unset in this app's env, so no behavior change). Do not change any other part of the route (the `isSupabase()` branch, the query, the options).

- [ ] **Step 3: Verify behavior-preserving**

Run: `npx tsc --noEmit` — confirm no new errors in `prices/route.ts`.
Add a quick assertion (temporary, then remove) or reason it out: with `AZURE_SQL_*`/`DATABASE_*` set as in prod, `env.db.server` === the old expression. The env test already proves the precedence.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/prices/route.ts
git commit -m "refactor(env): read DB creds via env.db in api/prices (behavior-preserving)"
```

---

## Task 4: Canonicalize `.env.example` + document the seam

**Files:**
- Modify: `.env.example`
- Create: `src/lib/env.README.md`

- [ ] **Step 1: Update `.env.example`** — read it first; add/curate a `# Database credentials (canonical: AZURE_SQL_*, with DATABASE_*/SQL_* accepted as aliases)` section documenting the canonical `AZURE_SQL_SERVER/DATABASE/USER/PASSWORD` names and noting the accepted aliases (`DATABASE_SERVER/NAME/USER/PASSWORD`, `SQL_SERVER/DATABASE/USERNAME/PASSWORD`). Also add `DB_BACKEND`, `SUPABASE_DB_URL`, `CRON_SECRET`, and the auth secrets if absent. Do not remove existing entries.

- [ ] **Step 2: Write `src/lib/env.README.md`** documenting: why the module exists (single source of truth, DB-cred alias reconciliation); the `req/opt/firstDefined` helpers and when to use each; the `env.db` precedence (`AZURE_SQL_* > DATABASE_* > SQL_* > default`); that secrets stay env-injected (this is not a runtime SDK) and how that maps to Vercel / Supabase / AWS Secrets Manager; and the migration guidance (new code reads `env.*`; existing raw `process.env` reads migrate gradually, one PR at a time, EXCLUDING the Twilio routes under separate cleanup).

- [ ] **Step 3: Verify** `npm test` still green.

- [ ] **Step 4: Commit**

```bash
git add .env.example src/lib/env.README.md
git commit -m "docs(env): canonicalize DB-cred names + document the env seam"
```

---

## Self-Review (completed)

**Spec coverage** — Central typed env module → Task 2; DB-cred reconciliation (the real hazard) → Task 2 with exact alias precedence + Task 3 proving it behavior-preserving on a live consumer; jest prerequisite → Task 1; docs/.env canonicalization → Task 4. Runtime-SDK explicitly excluded (Global Constraints). Broad 100-site migration intentionally out of scope (gradual, per README) — and the Twilio routes are explicitly excluded to avoid the concurrent-session collision.

**Placeholder scan** — no "TBD". Task 1 instructs verifying the widened `roots` doesn't over-collect (with the fallback of a narrower root/testMatch). Task 3 gives the exact before/after and the behavior-preserving argument. No vague steps.

**Type consistency** — `firstDefined`/`req`/`opt` signatures defined in Task 2 and consumed consistently; `env.db.{server,database,user,password}` names match the test (Task 2) and the migrated call site (Task 3); the alias arrays use the exact irregular names (`DATABASE_NAME`, `SQL_USERNAME`) in both the module and the tests.
