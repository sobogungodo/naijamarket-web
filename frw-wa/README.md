# frw-wa — Task 7: WA trader `submit.py` first-reporter-wins parity

Base: `deployments/wa-v161.zip` (latest tracked WA deploy zip as of this change).

This directory holds a reviewable artifact only — it is **not** the deploy
tree. It does not replace or duplicate the untracked `wa-v1NN-src/` working
copies used for prior deploys.

- `trader-submit.py` — the edited `trader/submit.py`, ready to drop into a
  fresh extraction of `wa-v161.zip` in place of the existing
  `trader/submit.py`.
- `submit.py.frw.diff` — unified diff of `trader/submit.py`: wa-v161 base vs.
  this edit.

## What changed

- `_check_slot_rules()` (RULE-1 "already approved this slot" + RULE-2 "two
  other traders already reported this slot") is **removed**.
  `dbo.usp_Process_Trader_Submission` (Task 2) is now the single source of
  truth for win/duplicate/cap arbitration.
- `_check_daily_limit()` no longer blocks the submission before insert. It is
  still called to read the configured daily-limit value, which is passed to
  the proc as `@daily_limit`.
- The SUBMIT step now: inserts the `PENDING` row via `_insert_submission`
  (unconditionally) → `EXEC dbo.usp_Process_Trader_Submission
  @submission_id=..., @daily_limit=...` → maps the returned `outcome` to the
  trader-facing reply:
  - `WINNER` → existing success/earnings copy, validator assignment runs.
  - `ALREADY_REPORTED` / `OVER_CAP` → `We already have the price for {item}.
    Please submit a price for another item.` (verbatim, matches PWA/mobile).
  - `ALREADY_REPORTED_SELF` → `You already reported {item} today.`
    (verbatim, matches PWA/mobile).
  - `ERROR` / proc-call exception → generic `Could not record your price.
    Please try again.`
  - An over-cap (or already-reported) submission is still **saved** — the
    insert always happens before the proc call, so the row exists and
    contributes to the consumer price average regardless of outcome.

## Deploy (gated — do NOT do this yet)

1. `dbo.usp_Process_Trader_Submission` **must be applied to production `dbo`
   before deploying this file** — otherwise every submit hits the `EXEC`
   call, the proc doesn't exist, the call raises, and every submission falls
   through to the generic "Could not record your price" ERROR path (the row
   is still saved by the preceding insert, but no trader ever sees a
   success/win outcome, and no validators are ever assigned).
2. Repackage the `wa-v161.zip` tree with this file replacing
   `trader/submit.py`, producing `wa-v162.zip`.
3. Keep vendored deps as-is (repackage-from-prev-zip; do not `pip install`
   fresh into the package).
4. Archive the built zip to `deployments/wa-v162.zip` per the WA deploy
   archive rule.
5. Deploy via `WEBSITE_RUN_FROM_PACKAGE` SAS flip per the standard runbook.

Gated: **APPROVE DEPLOY**.
