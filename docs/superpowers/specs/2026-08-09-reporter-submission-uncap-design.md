# Admin-Controlled Per-Reporter Submission Uncap — Design

**Date:** 2026-08-09
**Repos:** `naijamarket-web/admin-dashboard` (UI + API), trader PWA `Documents\naijamarket-trader` (enforcement), shared DB `naijafoodmarket-live`.

## 1. Goal

Let an admin remove (and restore) a specific reporter's daily price-submission cap from the
**admin dashboard**, with no code deploy — replacing the hardcoded `UNCAPPED_REPORTER_PHONES`
allowlist in the trader PWA.

## 2. Data model

`dbo.Traders_register` — add `submission_uncapped BIT NOT NULL DEFAULT 0`.
Migrate the 3 currently-hardcoded phones to `= 1`:
`+2349060710124`, `+2347046193593`, `+2348021115912`.

## 3. Enforcement (trader PWA — `src/lib/config.ts`)

`getDailyLimitForPhone(pool, phone)` becomes DB-driven:
- Query `SELECT submission_uncapped FROM dbo.Traders_register WHERE phone_number IN (@phone, @clean, @plus)`.
- If `submission_uncapped = 1` **OR** phone ∈ legacy `UNCAPPED_REPORTER_PHONES` (kept as a harmless
  fallback, emptied later) → return `UNCAPPED_DAILY_LIMIT` (100000).
- Else → `getDailySubmissionLimit(pool)` (global `Admin_Config` value).

This function already gates BOTH submit enforcement (`/api/submit`) and the advisory UI counter
(`/api/trader/today-count`), so no other trader-PWA change is needed.

## 4. Admin dashboard

### 4.1 `GET /api/users`
Add `submission_uncapped` (as `uncapped` bit) to the trader row SELECT + response, so the UI
renders the current state.

### 4.2 `PATCH /api/users`
Add two actions to the existing handler (which already updates `Traders_register` + writes an audit
row): `uncap_submissions` → `SET submission_uncapped = 1`; `recap_submissions` → `SET submission_uncapped = 0`.
These branch BEFORE the `registration_status` statusMap (they don't touch status/suspension). Audit
row: action label `SUBMISSION_UNCAP` / `SUBMISSION_RECAP`, acting-admin identity, target trader.
Authorization: any authenticated admin (same as the existing approve/suspend actions).

### 4.3 User Management page (`app/dashboard/users/page.tsx`)
Per-reporter row action toggle:
- If `uncapped` → button **"Uncapped ✓ · Restore limit"** → PATCH `recap_submissions`.
- Else → button **"Remove limit"** → PATCH `uncap_submissions`.
Optimistic refresh (re-fetch the list) after the PATCH, mirroring the approve/unapprove flow.

## 5. Data flow
Admin clicks toggle → `PATCH /api/users {userId, userType:'trader', action:'uncap_submissions'}`
→ updates `Traders_register.submission_uncapped` + audit → UI refetches. On the next submission,
the trader PWA's `getDailyLimitForPhone` reads the flag → cap removed (or restored) immediately.

## 6. Success criteria
1. Toggling "Remove limit" on a reporter sets `submission_uncapped=1` + an audit row.
2. That reporter can then submit beyond the global daily cap; the UI counter shows the uncapped ceiling.
3. Toggling "Restore limit" sets it back to 0; the cap re-applies.
4. The 3 migrated phones behave identically after the hardcoded set is retired.
5. No deploy needed to uncap/recap a reporter (only the flag flips).

## 7. Risks / notes
- Cross-repo: the admin dashboard writes the flag; the trader PWA reads it (same DB). Both deploy
  separately. Order: DB migration first, then trader PWA (reads flag), then admin dashboard (writes it).
- Extra per-submission DB read for the flag — negligible (submit already hits the DB); can be folded
  into an existing query later if needed.
- Legacy `UNCAPPED_REPORTER_PHONES` kept as an OR-fallback so nothing breaks during rollout; empty it
  in a later cleanup once the DB flag is proven.
