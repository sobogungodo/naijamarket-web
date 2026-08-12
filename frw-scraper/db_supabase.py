# frw-scraper/db_supabase.py
# psycopg2-backed Supabase Dev-environment connection for the scraper/generation function.
# Active only when DB_BACKEND=supabase + SUPABASE_DB_URL are set. Production keeps pymssql/Azure.
# psycopg2 shares pymssql's %s paramstyle. This wrapper adds:
#   - dict rows (RealDictCursor) to match pymssql as_dict=True,
#   - 'dbo.' schema-prefix stripping, and
#   - EXEC/EXECUTE proc -> CALL proc(args) translation (the scraper runs the ported procs).
import os
import re
import psycopg2
from psycopg2.extras import RealDictCursor

try:
    from tsql_translate import translate_tsql
except ImportError:  # when imported as a package module
    from .tsql_translate import translate_tsql

_EXEC_RE = re.compile(r'^\s*EXEC(?:UTE)?\s+([A-Za-z0-9_]+)\s*(.*)$', re.IGNORECASE | re.DOTALL)


class _PgCursor:
    def __init__(self, cur):
        self._cur = cur

    def execute(self, sql, params=None):
        # Apply the T-SQL -> Postgres surface translations (also strips dbo.), then handle the
        # EXEC/EXECUTE proc -> CALL form the scraper uses for the ported generation procs.
        s = translate_tsql(sql)
        m = _EXEC_RE.match(s)
        if m:
            name = m.group(1).lower()
            rest = m.group(2).strip().rstrip(';')
            s = f"CALL {name}({rest})" if rest else f"CALL {name}()"
        return self._cur.execute(s, params if params is not None else None)

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    def __getattr__(self, name):
        return getattr(self._cur, name)


class _PgConnection:
    def __init__(self, conn):
        self._conn = conn

    def cursor(self, as_dict=False):
        if as_dict:
            return _PgCursor(self._conn.cursor(cursor_factory=RealDictCursor))
        return _PgCursor(self._conn.cursor())

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def close(self):
        return self._conn.close()

    def __getattr__(self, name):
        return getattr(self._conn, name)


def get_supabase_connection():
    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"], connect_timeout=30)
    conn.autocommit = False
    return _PgConnection(conn)
