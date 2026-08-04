-- 2026-08-04_traders_register_unique_phone.sql
-- Filtered UNIQUE index on dbo.Traders_register(phone_number).
--
-- WHY: dbo.Traders_register is a bare heap with no PK/unique constraint. requireSession
-- does SELECT TOP 1 ... WHERE phone_number = @phone with NO ORDER BY, so a duplicate phone
-- would silently corrupt login. This index makes duplicate phones structurally impossible
-- and turns any future duplicating INSERT into a loud failure (SQL 2601) the registration
-- endpoint can catch as "this number is already registered".
--
-- WHY FILTERED: every column on the table is nullable; a non-filtered unique index treats
-- NULLs as equal and would collide on the second NULL phone_number. WHERE phone_number IS
-- NOT NULL sidesteps that.
--
-- PRE-CHECKS (2026-08-04, immediately before execution):
--   * 0 duplicate phone_number groups, 0 NULL phone_number, 1129 rows.
--   * Filtered indexes require the writing session to have ANSI_NULLS + QUOTED_IDENTIFIER
--     (and ARITHABORT/ANSI_PADDING/ANSI_WARNINGS/CONCAT_NULL_YIELDS_NULL) ON, else every
--     INSERT/UPDATE fails 1934. DB defaults are OFF, so this was verified per WRITER:
--       - WA writer (pymssql 2.3.11 / naijaapp): empirically ON on a live session (sid 83).
--       - PWA + admin (mssql/tedious): default ON.
--       - web (Prisma/tiberius): does not write this table.
--
-- ROLLBACK: DROP INDEX UX_Traders_register_phone ON dbo.Traders_register;

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

CREATE UNIQUE NONCLUSTERED INDEX UX_Traders_register_phone
ON dbo.Traders_register(phone_number)
WHERE phone_number IS NOT NULL;
