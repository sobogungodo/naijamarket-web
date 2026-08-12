# shared/db_supabase.py
# psycopg2-backed Supabase Dev-environment connection for the WhatsApp bot.
# Active only when DB_BACKEND=supabase + SUPABASE_DB_URL are set (see get_connection() in db.py).
# Production keeps using pymssql -> Azure SQL. psycopg2 shares pymssql's %s paramstyle, so the
# existing cur.execute(sql, params) calls work unchanged; this wrapper only:
#   - returns dict rows (RealDictCursor) to match pymssql as_dict=True, and
#   - strips the 'dbo.' schema prefix (Postgres uses the public schema).
# NOTE: queries using T-SQL-only functions (GETUTCDATE, ISNULL, TOP, OFFSET/FETCH) still need
# per-query Postgres-dialect porting for full parity; this proves connectivity + the common path.
import os
import psycopg2
from psycopg2.extras import RealDictCursor

try:
    from shared.tsql_translate import translate_tsql
except ImportError:  # when run with the package root on sys.path
    from tsql_translate import translate_tsql


class _PgCursor:
    def __init__(self, cur):
        self._cur = cur

    def execute(self, sql, params=None):
        # Apply the T-SQL -> Postgres surface translations (dbo-strip, brackets, GETUTCDATE,
        # ISNULL, TOP->LIMIT, DATEADD/DATEDIFF, OFFSET/FETCH, ...). Params stay %s (shared by
        # pymssql + psycopg2), so no placeholder rewrite is needed.
        sql = translate_tsql(sql)
        return self._cur.execute(sql, params if params is not None else None)

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    def __getattr__(self, name):
        return getattr(self._cur, name)


class _PgConnection:
    def __init__(self, conn):
        self._conn = conn

    # pymssql signature: conn.cursor(as_dict=True)
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
    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"], connect_timeout=20)
    conn.autocommit = False
    return _PgConnection(conn)
