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

// Rewrite every call to FUNC(...) using balanced-paren argument parsing (handles nested
// parens/commas that a flat regex cannot). transform() receives the trimmed top-level args
// and returns the replacement text. Unbalanced/again-malformed calls are left untouched.
function rewriteCalls(text: string, fn: string, transform: (args: string[]) => string): string {
  const re = new RegExp(`\\b${fn}\\s*\\(`, 'gi');
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index;
    const open = m.index + m[0].length - 1; // index of '('
    let depth = 0;
    let i = open;
    const args: string[] = [];
    let cur = '';
    let ok = false;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') { depth++; if (depth === 1) continue; }
      if (ch === ')') { depth--; if (depth === 0) { args.push(cur); ok = true; break; } }
      if (ch === ',' && depth === 1) { args.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (!ok) break; // unbalanced — stop rewriting this fn
    out += text.slice(last, start) + transform(args.map((a) => a.trim()));
    last = i + 1;
    re.lastIndex = i + 1;
  }
  out += text.slice(last);
  return out;
}

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

  // 5b. Month-truncation idiom DATEADD(month, DATEDIFF(month, 0, <now>), 0) -> first day of
  //     the current month. Handle the whole idiom before the generic DATEADD/DATEDIFF rules
  //     (its inner DATEDIFF has a 0 "date" that the generic handler can't take). <now> is
  //     already now() / (now() at time zone 'utc') after rule 5.
  t = t.replace(
    /\bDATEADD\s*\(\s*month\s*,\s*DATEDIFF\s*\(\s*month\s*,\s*0\s*,\s*(\(now\(\) at time zone 'utc'\)|now\(\))\s*\)\s*,\s*0\s*\)/gi,
    (_m, nowExpr: string) => `date_trunc('month', ${nowExpr})`,
  );

  // 5c. DATETIME2 type name -> timestamp (in CAST/CREATE TABLE/DECLARE contexts).
  t = t.replace(/\bDATETIME2\b/gi, 'timestamp');

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

  // 7b. DATEDIFF(unit, a, b) -> Postgres interval/date arithmetic (balanced-paren parse).
  //     DATEDIFF is confined to a handful of tail routes, so this is safe for the rest.
  t = rewriteCalls(t, 'DATEDIFF', (args) => {
    if (args.length !== 3) return `DATEDIFF(${args.join(', ')})`;
    const [unit = '', a = '', b = ''] = args;
    const u = unit.toLowerCase();
    const epoch = `extract(epoch from ((${b}) - (${a})))`;
    switch (u) {
      case 'day':    return `((${b})::date - (${a})::date)`;
      case 'week':   return `(floor(((${b})::date - (${a})::date) / 7.0)::int)`;
      case 'hour':   return `(floor(${epoch} / 3600)::int)`;
      case 'minute': return `(floor(${epoch} / 60)::int)`;
      case 'second': return `(${epoch}::int)`;
      case 'month':  return `(((extract(year from (${b})) - extract(year from (${a}))) * 12 + (extract(month from (${b})) - extract(month from (${a}))))::int)`;
      case 'year':   return `((extract(year from (${b})) - extract(year from (${a})))::int)`;
      default:       return `DATEDIFF(${args.join(', ')})`; // unknown unit — leave as-is
    }
  });

  // 7c. YEAR(x)/MONTH(x)/DAY(x) -> EXTRACT(... FROM x)::int.
  t = rewriteCalls(t, 'YEAR',  (a) => (a.length === 1 ? `(extract(year from (${a[0]}))::int)`  : `YEAR(${a.join(', ')})`));
  t = rewriteCalls(t, 'MONTH', (a) => (a.length === 1 ? `(extract(month from (${a[0]}))::int)` : `MONTH(${a.join(', ')})`));

  // 7d. Paging: OFFSET n ROWS FETCH NEXT m ROWS ONLY -> OFFSET n LIMIT m (Postgres).
  t = t.replace(
    /\bOFFSET\s+(.+?)\s+ROWS\s+FETCH\s+(?:NEXT|FIRST)\s+(.+?)\s+ROWS\s+ONLY/gi,
    (_m, off: string, fetch: string) => `OFFSET ${off} LIMIT ${fetch}`,
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
