# Reporter Submission Uncap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Admin-toggleable per-reporter removal of the daily price-submission cap, DB-driven (no deploy to change a reporter).

**Architecture:** New `Traders_register.submission_uncapped` bit. Trader PWA reads it in `getDailyLimitForPhone`. Admin dashboard exposes it via `GET/PATCH /api/users` + a toggle on the User Management page.

**Tech Stack:** Azure SQL `naijafoodmarket-live`, Next.js (admin-dashboard `mssql`, trader PWA `mssql`). No test framework — verify via typecheck + DB read-back + curl/live.

## Global Constraints
- Column: `submission_uncapped BIT NOT NULL DEFAULT 0` on `dbo.Traders_register`.
- Uncapped ceiling constant: `UNCAPPED_DAILY_LIMIT = 100000` (already in trader PWA `src/lib/config.ts`).
- Migrate phones to `=1`: `+2349060710124`, `+2347046193593`, `+2348021115912`.
- Deploy order: DB migration → trader PWA (reads flag) → admin dashboard (writes flag).
- Admin dashboard does NOT auto-deploy — deploy via `VERCEL_PROJECT_ID=prj_Nv7qjb6PPySJGqQF6b4p9INXum38 vercel deploy --prod --yes` from `naijamarket-web` root. Trader PWA auto-deploys from `main`.
- Gated: DB migration (`APPROVE DB`), each deploy (`APPROVE DEPLOY`).

---

### Task 1: DB migration — `submission_uncapped` column + migrate phones — GATED `APPROVE DB`

- [ ] **Step 1** (privileged PowerShell, idempotent):

```powershell
$tok=(az account get-access-token --resource https://database.windows.net/ --query accessToken -o tsv)
$c=New-Object System.Data.SqlClient.SqlConnection
$c.ConnectionString="Server=tcp:naijafood.database.windows.net,1433;Database=naijafoodmarket-live;Encrypt=True;"; $c.AccessToken=$tok; $c.Open()
$cmd=$c.CreateCommand(); $cmd.CommandText=@"
IF COL_LENGTH('dbo.Traders_register','submission_uncapped') IS NULL
  ALTER TABLE dbo.Traders_register ADD submission_uncapped BIT NOT NULL DEFAULT 0;
"@; [void]$cmd.ExecuteNonQuery()
$cmd.CommandText="UPDATE dbo.Traders_register SET submission_uncapped=1 WHERE phone_number IN ('+2349060710124','+2347046193593','+2348021115912')"
Write-Output ("migrated rows: " + $cmd.ExecuteNonQuery()); $c.Close()
```

- [ ] **Step 2: Verify** — `SELECT phone_number, submission_uncapped FROM dbo.Traders_register WHERE submission_uncapped=1` → the 3 phones. Column exists.

---

### Task 2: Trader PWA — DB-driven `getDailyLimitForPhone`

**Files:** Modify `Documents\naijamarket-trader\src\lib\config.ts:45-51`

- [ ] **Step 1: Replace the function body** to read the flag:

```ts
export async function getDailyLimitForPhone(
  pool: sql.ConnectionPool,
  phone: string | null | undefined,
): Promise<number> {
  if (phone) {
    if (UNCAPPED_REPORTER_PHONES.has(phone)) return UNCAPPED_DAILY_LIMIT; // legacy fallback
    try {
      const clean = phone.replace(/^\+/, '');
      const r = await pool.request()
        .input('phone', sql.NVarChar(30), phone)
        .input('clean', sql.NVarChar(30), clean)
        .input('plus',  sql.NVarChar(30), '+' + clean)
        .query(`SELECT TOP 1 submission_uncapped FROM dbo.Traders_register
                WHERE phone_number IN (@phone, @clean, @plus)`);
      if (r.recordset[0]?.submission_uncapped === true || r.recordset[0]?.submission_uncapped === 1) {
        return UNCAPPED_DAILY_LIMIT;
      }
    } catch (err) {
      console.warn('[config] submission_uncapped lookup failed, using global:', err);
    }
  }
  return getDailySubmissionLimit(pool);
}
```

Add `import type sql from 'mssql';` is already present. The function needs the `sql` value (for `.input`) — the file currently imports `type sql`. **Change** the import at line 4 from `import type sql from 'mssql';` to `import sql from 'mssql';` (value import; `sql.NVarChar` is used at runtime now).

- [ ] **Step 2: Typecheck** — `cd Documents\naijamarket-trader && npx tsc --noEmit` → no errors in config.ts.
- [ ] **Step 3: Commit** on `main`.

---

### Task 3: Admin `GET /api/users` — expose `submission_uncapped`

**Files:** Modify `admin-dashboard\app\api\users\route.ts` (the trader SELECT ~line 49-63)

- [ ] **Step 1:** Add `ISNULL(t.submission_uncapped, 0) AS uncapped` to the trader-branch SELECT column list (alongside `t.trader_id AS id`, etc.).
- [ ] **Step 2: Typecheck.** **Commit** (with Task 4).

---

### Task 4: Admin `PATCH /api/users` — uncap/recap actions

**Files:** Modify `admin-dashboard\app\api\users\route.ts` PATCH handler (~line 157-222)

- [ ] **Step 1:** Near the top of the PATCH `try` (after reading `{ userId, userType, action, reason }` and the trader-guard), add a dedicated branch BEFORE the `statusMap` logic:

```ts
if (action === 'uncap_submissions' || action === 'recap_submissions') {
  if (userType !== 'trader')
    return NextResponse.json({ success: false, error: 'Uncap applies to traders only' }, { status: 400 });
  const val = action === 'uncap_submissions' ? 1 : 0;
  const pool = await getConnection();
  const pre = await pool.request().input('userId', sql.VarChar(50), userId)
    .query(`SELECT phone_number FROM dbo.Traders_register WHERE trader_id = @userId`);
  await pool.request()
    .input('userId', sql.VarChar(50), userId)
    .input('val', sql.Bit, val)
    .query(`UPDATE dbo.Traders_register SET submission_uncapped = @val WHERE trader_id = @userId`);
  // Audit (best-effort, mirrors existing audit insert shape)
  try {
    const phone = pre.recordset[0]?.phone_number ?? null;
    const adminEmail = (session?.user as { email?: string })?.email || 'admin';
    await pool.request()
      .input('phone', sql.NVarChar(30), phone)
      .input('actor', sql.NVarChar(200), adminEmail)
      .input('act', sql.NVarChar(50), action === 'uncap_submissions' ? 'SUBMISSION_UNCAP' : 'SUBMISSION_RECAP')
      .input('detail', sql.NVarChar(400), `submission_uncapped=${val} for ${userId}`)
      .query(`INSERT INTO dbo.Trader_Activity_Log (phone_number, actor, action, detail, ip, created_at)
              VALUES (@phone, @actor, @act, @detail, NULL, SYSUTCDATETIME())`);
  } catch (e) { console.error('[users PATCH][uncap audit] non-fatal:', e); }
  return NextResponse.json({ success: true, submission_uncapped: val });
}
```

  (Confirm the audit table name/columns against the existing audit insert in this file — reuse the SAME table/columns it already uses for approve/suspend; if it uses a different table, match that. If no audit table is used elsewhere, drop the audit block.)

- [ ] **Step 2: Typecheck.** **Step 3: Commit** (Tasks 3+4 together).

---

### Task 5: Admin User Management page — toggle button

**Files:** Modify `admin-dashboard\app\dashboard\users\page.tsx`

- [ ] **Step 1:** In the `Trader` row type, add `uncapped?: number`. In each trader row's action cell (next to Suspend/Approve buttons, ~line 621/715), add:

```tsx
<button
  onClick={() => handleUncap(trader.id, trader.uncapped ? 'recap_submissions' : 'uncap_submissions')}
  title={trader.uncapped ? 'Restore daily limit' : 'Remove daily limit'}
  className="px-2 py-1 rounded-lg text-xs hover:bg-gray-700 transition-colors"
>
  {trader.uncapped ? 'Uncapped ✓' : 'Remove limit'}
</button>
```

- [ ] **Step 2:** Add the handler near the approve/unapprove handler (~line 244):

```tsx
const handleUncap = async (id: string, action: 'uncap_submissions' | 'recap_submissions') => {
  try {
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, userType: 'trader', action }),
    });
    if ((await res.json()).success) fetchUsers();  // re-fetch the list (use the existing fetch fn name)
  } catch (e) { console.error('[uncap]', e); }
};
```

  (Match `fetchUsers` to the actual list-fetch function name in this file.)

- [ ] **Step 3: Typecheck.** **Step 4: Commit.**

---

### Task 6: Deploy — GATED `APPROVE DEPLOY`

- [ ] **Step 1:** Trader PWA — push `main` (auto-deploys). Smoke: uncapped reporter's `/api/trader/today-count` shows the high `daily_limit`.
- [ ] **Step 2:** Admin dashboard — `cd naijamarket-web && VERCEL_ORG_ID=team_4JxqAyM3sLINHE9piQbuK6qb VERCEL_PROJECT_ID=prj_Nv7qjb6PPySJGqQF6b4p9INXum38 vercel deploy --prod --yes`. Verify the toggle on the Users page.

## Self-Review notes
- Spec §2 DB → Task 1. §3 enforcement → Task 2. §4.1 GET → Task 3. §4.2 PATCH → Task 4. §4.3 page → Task 5. §7 deploy order → Task 6.
- Audit-table exactness (Task 4) + list-fetch fn name (Task 5) are flagged to confirm against the actual file during implementation (not placeholders — they're "use the existing X").
- No test framework → verification is typecheck + DB read-back + live smoke.
