// admin-dashboard/lib/db-supabase.ts
// pg-backed, mssql-compatible adapter for the Supabase Dev environment (admin dashboard).
// Active only when DB_BACKEND=supabase + SUPABASE_DB_URL are set. Production keeps mssql/Azure.
// NOTE: the admin's dashboard queries are heavily T-SQL (DECLARE @var, multi-statement batches,
// GETUTCDATE, TOP, OFFSET/FETCH, IF OBJECT_ID) — those need Postgres-dialect porting for full
// parity. This adapter proves connectivity + the .request().input().query()/.execute() patterns.
import { Pool } from 'pg';
import { translateTSQL } from './tsql-translate';

declare global {
  // eslint-disable-next-line no-var
  var __admin_pg_pool: Pool | undefined;
}

function pgPool(): Pool {
  if (!global.__admin_pg_pool) {
    global.__admin_pg_pool = new Pool({
      connectionString: process.env.SUPABASE_DB_URL || '',
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });
  }
  return global.__admin_pg_pool;
}

class PgRequest {
  private params: Record<string, unknown> = {};
  input(name: string, value: unknown): this {
    this.params[name] = value;
    return this;
  }
  async query(text: string): Promise<{ recordset: unknown[]; recordsets: unknown[][]; rowsAffected: number[] }> {
    const translated = translateTSQL(text);
    const order: string[] = [];
    const pgText = translated.replace(/@(\w+)/g, (_m, n: string) => {
      let i = order.indexOf(n); if (i === -1) { order.push(n); i = order.length - 1; }
      return '$' + (i + 1);
    });
    const values = order.map((n) => this.params[n]);
    const res = await pgPool().query(pgText, values);
    return { recordset: res.rows, recordsets: [res.rows], rowsAffected: [res.rowCount ?? 0] };
  }
  async execute(procName: string): Promise<{ recordset: unknown[]; recordsets: unknown[][]; rowsAffected: number[] }> {
    const name = procName.replace(/^dbo\./i, '').toLowerCase();
    const keys = Object.keys(this.params);
    const placeholders = keys.map((_k, i) => '$' + (i + 1)).join(', ');
    const values = keys.map((k) => this.params[k]);
    const res = await pgPool().query(`select * from ${name}(${placeholders})`, values);
    return { recordset: res.rows, recordsets: [res.rows], rowsAffected: [res.rowCount ?? 0] };
  }
}

class PgPool {
  get connected(): boolean { return true; }
  request(): PgRequest { return new PgRequest(); }
  async close(): Promise<void> { /* pooled; no-op for dev */ }
}

export function getSupabasePool(): PgPool {
  return new PgPool();
}
