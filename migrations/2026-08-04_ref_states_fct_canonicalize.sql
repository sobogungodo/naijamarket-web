-- 2026-08-04_ref_states_fct_canonicalize.sql
-- Canonicalize ref.States.state_name for FCT: 'FCT Abuja' -> 'FCT'.
--
-- WHY: ref.States.state_name is the source the trader-PWA registration picker reads
-- (GET /api/states -> <option value=state_name>). For FCT it emitted 'FCT Abuja', but
-- dbo.Markets.state stores 'FCT' (11 markets). A registrant choosing FCT therefore
-- submitted 'FCT Abuja', which matches ZERO markets in the market lookup keyed on
-- dbo.Markets.state = @state. Every other store of the FCT string on the platform
-- already uses 'FCT' (dbo.Markets.state, dbo.States_Reference.state_name,
-- Traders_register.assigned_state, Submissions.state, Latest_Prices_Summary.state, and
-- the WA NIGERIAN_STATES literal). ref.States.state_name was the sole 'FCT Abuja'
-- outlier. All 36 other state_name values already match the operational convention;
-- only FCT diverged.
--
-- BLAST RADIUS: read by exactly 3 trader-PWA sites (api/states/route.ts,
-- api/auth/register-waitlist/route.ts, register/page.tsx). Nothing in web, admin,
-- mobile, or WA reads this column. After this the register picker's visible label AND
-- submitted value both become 'FCT'.
--
-- PRE-CHECKS (2026-08-04, immediately before execution):
--   * ref.States FCT row: state_id=7, state_code='FCT', state_name='FCT Abuja', is_fct=1.
--   * No FK references state_name (3 FKs all reference state_id); no CHECK on state_name;
--     no index covers state_name -> nothing structural blocks the UPDATE.
--   * ref.States has 37 rows.
--
-- ROLLBACK:
--   UPDATE ref.States SET state_name = 'FCT Abuja', updated_at = SYSUTCDATETIME()
--    WHERE state_id = 7 AND state_name = 'FCT';

SET XACT_ABORT ON;
BEGIN TRAN;

UPDATE ref.States
   SET state_name = 'FCT', updated_at = SYSUTCDATETIME()
 WHERE state_id = 7 AND state_name = 'FCT Abuja';

IF @@ROWCOUNT = 1
    COMMIT TRAN;
ELSE
BEGIN
    ROLLBACK TRAN;
    THROW 50000, 'Guard failed: expected exactly 1 row (state_id=7, state_name=''FCT Abuja''). Nothing changed.', 1;
END
