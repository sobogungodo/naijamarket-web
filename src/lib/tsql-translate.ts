// src/lib/tsql-translate.ts
// Safe, context-free T-SQL -> PostgreSQL surface translations for the Supabase Dev
// adapter (db-supabase.ts). Applied to raw query text BEFORE the @name -> $n placeholder
// rewrite. ONLY unambiguous, position-independent rewrites live here — anything that needs
// real parsing (DATEDIFF over window fns, TRY_CAST, DATETIME2, nested DATEADD, MERGE/OUTPUT)
// is hand-ported in the individual route instead. Active only when DB_BACKEND=supabase.
//
// Grounded in the live Supabase schema (project djfrgcdqfghxtlydvqwl):
//   - the 186 "dbo" tables were migrated into the PUBLIC schema (there is NO dbo schema),
//     and public is on the search_path -> the "dbo." qualifier must be stripped.
//   - identifiers are lowercase; PG folds unquoted identifiers to lowercase, so simply
//     dropping [bracket] quoting resolves CamelCase names to the lowercase tables/columns.
//   - non-dbo schemas (ref, nbs, catalog, dim, hist, staging) exist and are kept as-is.

export function translateTSQL(text: string): string {
  let t = text;

  // 1. Bracket-quoted identifiers: [dbo].[Markets] -> dbo.Markets, [col name] -> col name.
  //    (Do this BEFORE the dbo strip so [dbo]. becomes dbo. and is then removed.)
  t = t.replace(/\[([A-Za-z0-9_ ]+)\]/g, '$1');

  // 2. Schema qualifier dbo. -> "" (dbo tables live in public, which is on the search_path).
  t = t.replace(/\bdbo\./gi, '');

  // 3. Unicode string prefix N'...' -> '...'  (PG has no N'' literal).
  t = t.replace(/\bN'/g, "'");

  // 4. Locking hints have no PG equivalent (MVCC): drop WITH (NOLOCK) / (NOLOCK).
  t = t.replace(/\bWITH\s*\(\s*NOLOCK\s*\)/gi, '');
  t = t.replace(/\(\s*NOLOCK\s*\)/gi, '');

  // 5. Date/time "now" functions.
  t = t.replace(/\bGETUTCDATE\s*\(\s*\)/gi, "(now() at time zone 'utc')");
  t = t.replace(/\bSYSUTCDATETIME\s*\(\s*\)/gi, "(now() at time zone 'utc')");
  t = t.replace(/\bSYSDATETIME\s*\(\s*\)/gi, 'now()');
  t = t.replace(/\bGETDATE\s*\(\s*\)/gi, 'now()');

  // 6. ISNULL(a, b) -> COALESCE(a, b)  (identical 2-arg semantics).
  t = t.replace(/\bISNULL\s*\(/gi, 'COALESCE(');

  // 7. DATEADD(unit, n, <now-expr>) -> (<now-expr>) + (n * interval '1 unit').
  //    Restricted to the already-translated now() forms so the third arg is balanced and
  //    parse-free. General DATEADD over arbitrary expressions is hand-ported per-route.
  t = t.replace(
    /\bDATEADD\s*\(\s*(YEAR|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND)\s*,\s*(-?\d+)\s*,\s*(\(now\(\) at time zone 'utc'\)|now\(\))\s*\)/gi,
    (_m, unit: string, n: string, expr: string) =>
      `((${expr}) + (${n} * interval '1 ${unit.toLowerCase()}'))`,
  );

  // 8. Statement-leading MERGE <table>  ->  MERGE INTO <table>.
  //    T-SQL allows "MERGE tbl AS t USING ..."; PG17 (which has native MERGE) requires the
  //    INTO keyword. The rest of the MERGE grammar (USING/ON/WHEN MATCHED/WHEN NOT MATCHED
  //    THEN INSERT..VALUES) is compatible. Leading-only so a "merge" identifier elsewhere is
  //    untouched.
  t = t.replace(/^(\s*)MERGE\s+(?!INTO\b)/i, '$1MERGE INTO ');

  // 9. Leading SELECT [DISTINCT] TOP n  ->  strip TOP, append LIMIT n.
  //    Only fires when the statement STARTS with SELECT TOP (never a subquery), matching all
  //    observed usages (existence checks / single-row lookups).
  const top = t.match(/^\s*SELECT\s+(?:DISTINCT\s+)?TOP\s*\(?\s*(\d+)\s*\)?\s+/i);
  if (top) {
    t = t.replace(
      /^(\s*SELECT\s+)(DISTINCT\s+)?TOP\s*\(?\s*\d+\s*\)?\s+/i,
      (_m, sel: string, distinct?: string) => sel + (distinct || ''),
    );
    t = t.replace(/[\s;]+$/, '') + ` LIMIT ${top[1]}`;
  }

  return t;
}
