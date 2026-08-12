// src/lib/db-supabase.ts
// pg-backed Supabase Dev-environment adapter for the consumer web.
// Active only when DB_BACKEND=supabase + SUPABASE_DB_URL are set. Production keeps using
// Prisma → Azure SQL. This provides pg equivalents of the raw-query paths the app uses:
//   - getSupabaseConnection(): the mssql-style .request().input().query() shim (pg-backed),
//     mirroring getAzureSqlConnection() in db.ts.
//   - queryPg()/executePg(): pg equivalents of the query()/execute() shims.
// NOTE: the app's many prisma.$queryRaw`...` calls use T-SQL dialect and go through Prisma
// (Azure). Full cutover = switch Prisma provider to postgresql + port those raw queries to
// Postgres dialect (route-by-route). This adapter proves connectivity + the shim patterns.
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __web_pg_pool: Pool | undefined;
}

export function supabasePool(): Pool {
  if (!global.__web_pg_pool) {
    global.__web_pg_pool = new Pool({
      connectionString: process.env.SUPABASE_DB_URL || '',
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });
  }
  return global.__web_pg_pool;
}

interface PgReq {
  input: (name: string, value: unknown) => PgReq;
  query: (sql: string) => Promise<{ recordset: unknown[] }>;
}
interface PgConn {
  request: () => PgReq;
  connected: boolean;
}

// mssql-compatible connection over pg (pairs with getAzureSqlConnection in db.ts).
export async function getSupabaseConnection(): Promise<PgConn> {
  await supabasePool().query('select 1');
  return {
    connected: true,
    request: () => {
      const params: Record<string, unknown> = {};
      const builder: PgReq = {
        input(name: string, value: unknown) { params[name] = value; return builder; },
        async query(sqlTemplate: string) {
          // @name → $n (dedup)
          const order: string[] = [];
          const pgText = sqlTemplate.replace(/@(\w+)/g, (_m, n: string) => {
            let i = order.indexOf(n); if (i === -1) { order.push(n); i = order.length - 1; }
            return '$' + (i + 1);
          });
          const values = order.map((n) => params[n]);
          const res = await supabasePool().query(pgText, values);
          return { recordset: res.rows };
        },
      };
      return builder;
    },
  };
}

// pg equivalents of the query()/execute() shims (positional $1.. params).
export async function queryPg<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await supabasePool().query(sql, params);
  return res.rows as T[];
}
export async function executePg(sql: string, params: unknown[] = []): Promise<number> {
  const res = await supabasePool().query(sql, params);
  return res.rowCount ?? 0;
}
