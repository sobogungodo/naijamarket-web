# shared/tsql_translate.py
# Safe, context-free T-SQL -> PostgreSQL surface translations for the WhatsApp bot's Supabase
# Dev backend (db_supabase.py). Applied to the raw SQL text before psycopg2 runs it. Mirrors
# the Node translator (src/lib/tsql-translate.ts). Params use %s in BOTH pymssql and psycopg2,
# so there is NO placeholder rewrite here — only T-SQL surface constructs are translated.
# Only unambiguous, position-independent rewrites live here; anything needing real parsing
# (DECLARE @var batches, TRY_CAST, IF OBJECT_ID) must be hand-ported in the calling query.
import re


def _rewrite_calls(text, fn, transform):
    """Rewrite every FUNC(...) call using balanced-paren argument parsing."""
    out = []
    i = 0
    pat = re.compile(r'\b' + fn + r'\s*\(', re.I)
    while True:
        m = pat.search(text, i)
        if not m:
            out.append(text[i:])
            break
        out.append(text[i:m.start()])
        depth = 0
        j = m.end() - 1  # index of '('
        args = []
        cur = ''
        ok = False
        while j < len(text):
            ch = text[j]
            if ch == '(':
                depth += 1
                if depth == 1:
                    j += 1
                    continue
            if ch == ')':
                depth -= 1
                if depth == 0:
                    args.append(cur)
                    ok = True
                    break
            if ch == ',' and depth == 1:
                args.append(cur)
                cur = ''
                j += 1
                continue
            cur += ch
            j += 1
        if not ok:
            out.append(text[m.start():])
            break
        out.append(transform([a.strip() for a in args]))
        i = j + 1
    return ''.join(out)


def _datediff(args):
    if len(args) != 3:
        return 'DATEDIFF(' + ', '.join(args) + ')'
    unit, a, b = args[0], args[1], args[2]
    u = unit.lower()
    epoch = "extract(epoch from ((%s) - (%s)))" % (b, a)
    if u == 'day':
        return "((%s)::date - (%s)::date)" % (b, a)
    if u == 'week':
        return "(floor(((%s)::date - (%s)::date) / 7.0)::int)" % (b, a)
    if u == 'hour':
        return "(floor(%s / 3600)::int)" % epoch
    if u == 'minute':
        return "(floor(%s / 60)::int)" % epoch
    if u == 'second':
        return "(%s::int)" % epoch
    if u == 'month':
        return ("(((extract(year from (%s)) - extract(year from (%s))) * 12 "
                "+ (extract(month from (%s)) - extract(month from (%s))))::int)" % (b, a, b, a))
    if u == 'year':
        return "((extract(year from (%s)) - extract(year from (%s)))::int)" % (b, a)
    return 'DATEDIFF(' + ', '.join(args) + ')'


def translate_tsql(text):
    t = text
    # 1. bracket-quoted identifiers: [dbo].[Markets] -> dbo.Markets ; [col] -> col
    t = re.sub(r'\[([A-Za-z0-9_ ]+)\]', lambda m: m.group(1), t)
    # 2. schema qualifier dbo. -> "" (dbo tables live in public, on the search_path)
    t = re.sub(r'\bdbo\.', '', t, flags=re.I)
    # 3. N'...' -> '...'
    t = re.sub(r"\bN'", "'", t)
    # 4. NOLOCK hints
    t = re.sub(r'\bWITH\s*\(\s*NOLOCK\s*\)', '', t, flags=re.I)
    t = re.sub(r'\(\s*NOLOCK\s*\)', '', t, flags=re.I)
    # 5. date/time "now" functions
    t = re.sub(r'\bGETUTCDATE\s*\(\s*\)', "(now() at time zone 'utc')", t, flags=re.I)
    t = re.sub(r'\bSYSUTCDATETIME\s*\(\s*\)', "(now() at time zone 'utc')", t, flags=re.I)
    t = re.sub(r'\bSYSDATETIME\s*\(\s*\)', 'now()', t, flags=re.I)
    t = re.sub(r'\bGETDATE\s*\(\s*\)', 'now()', t, flags=re.I)
    # 5b. month-truncation idiom
    t = re.sub(
        r"\bDATEADD\s*\(\s*month\s*,\s*DATEDIFF\s*\(\s*month\s*,\s*0\s*,\s*"
        r"(\(now\(\) at time zone 'utc'\)|now\(\))\s*\)\s*,\s*0\s*\)",
        lambda m: "date_trunc('month', %s)" % m.group(1), t, flags=re.I)
    # 5c. TRY_CAST(expr AS type) -> CAST(expr AS type). PG has no TRY_CAST; the WA casts are
    #     to timestamp against real timestamp columns, so CAST is equivalent for valid data
    #     (it raises instead of NULL only on genuinely invalid input).
    t = re.sub(r'\bTRY_CAST\s*\(', 'CAST(', t, flags=re.I)
    # 5d. DATETIME2 -> timestamp
    t = re.sub(r'\bDATETIME2\b', 'timestamp', t, flags=re.I)
    # 6. ISNULL(a, b) -> COALESCE(a, b)
    t = re.sub(r'\bISNULL\s*\(', 'COALESCE(', t, flags=re.I)
    # 7. DATEADD(unit, n, <now-expr>) -> (<now-expr>) + (n * interval '1 unit')
    #    n may be a %s placeholder, a number, or a simple expression (no comma).
    t = re.sub(
        r"\bDATEADD\s*\(\s*(YEAR|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND)\s*,\s*([^,]+?)\s*,\s*"
        r"(\(now\(\) at time zone 'utc'\)|now\(\))\s*\)",
        lambda m: "((%s) + ((%s) * interval '1 %s'))" % (m.group(3), m.group(2), m.group(1).lower()),
        t, flags=re.I)
    # 7b. DATEDIFF(unit, a, b) -> interval/date math (balanced parse)
    t = _rewrite_calls(t, 'DATEDIFF', _datediff)
    # 7c. YEAR(x)/MONTH(x) -> EXTRACT
    t = _rewrite_calls(t, 'YEAR', lambda a: "(extract(year from (%s))::int)" % a[0] if len(a) == 1 else "YEAR(%s)" % ', '.join(a))
    t = _rewrite_calls(t, 'MONTH', lambda a: "(extract(month from (%s))::int)" % a[0] if len(a) == 1 else "MONTH(%s)" % ', '.join(a))
    # 7d. OFFSET n ROWS FETCH NEXT m ROWS ONLY -> OFFSET n LIMIT m
    t = re.sub(r'\bOFFSET\s+(.+?)\s+ROWS\s+FETCH\s+(?:NEXT|FIRST)\s+(.+?)\s+ROWS\s+ONLY',
               lambda m: "OFFSET %s LIMIT %s" % (m.group(1), m.group(2)), t, flags=re.I)
    # 8. statement-leading MERGE <table> -> MERGE INTO <table>
    t = re.sub(r'^(\s*)MERGE\s+(?!INTO\b)', lambda m: m.group(1) + 'MERGE INTO ', t, flags=re.I)
    # 9. leading SELECT [DISTINCT] TOP n -> strip TOP, append LIMIT n
    m = re.match(r'\s*SELECT\s+(?:DISTINCT\s+)?TOP\s*\(?\s*(\d+)\s*\)?\s+', t, flags=re.I)
    if m:
        n = m.group(1)
        t = re.sub(r'^(\s*SELECT\s+)(DISTINCT\s+)?TOP\s*\(?\s*\d+\s*\)?\s+',
                   lambda mm: mm.group(1) + (mm.group(2) or ''), t, count=1, flags=re.I)
        t = re.sub(r'[\s;]+$', '', t) + ' LIMIT ' + n
    return t
