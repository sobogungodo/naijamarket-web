/**
 * Central typed env/config. One validated place that reads every secret the app
 * needs, so secrets aren't scattered as raw process.env reads with drifting names.
 * Secrets stay ENV-INJECTED on every platform (Vercel / Supabase / AWS Secrets
 * Manager -> env at deploy) — this is not a runtime secrets SDK.
 *
 * env.db reconciles the MAIN app's (src/) DB-cred convention only — the one used
 * by routes such as api/prices: AZURE_SQL_* preferred, then DATABASE_* (irregular
 * DATABASE_NAME), then SQL_* (irregular SQL_USERNAME/SQL_USER) as a last-resort
 * alias, with the existing defaults.
 *
 * WARNING: admin-dashboard/ is a SEPARATE app with its OWN lib/db.ts that uses an
 * INVERTED SQL_*-first precedence (SQL_* wins over AZURE_SQL_*). It does NOT import
 * this module, and env.db must NOT be wired into it without adjusting for that
 * inversion — doing so naively would silently change admin-dashboard's precedence.
 *
 * Getters (not plain object literals) are used throughout so that tests can
 * mutate process.env and re-read via `jest.resetModules()` + `require('./env')`,
 * and so that a single module instance always reflects the live process.env
 * rather than a value snapshotted at first import.
 */
export function firstDefined(names: string[], fallback?: string): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v !== undefined && v !== '') return v;
  }
  return fallback;
}

export function req(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === '') throw new Error(`Required env var ${name} is not set`);
  return v;
}

export function opt(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export const env = {
  db: {
    get server()   { return firstDefined(['AZURE_SQL_SERVER', 'DATABASE_SERVER', 'SQL_SERVER'], 'naijafood.database.windows.net')!; },
    get database() { return firstDefined(['AZURE_SQL_DATABASE', 'DATABASE_NAME', 'SQL_DATABASE'], 'naijafoodmarket-live')!; },
    get user()     { return firstDefined(['AZURE_SQL_USER', 'DATABASE_USER', 'SQL_USERNAME', 'SQL_USER'], '')!; },
    get password() { return firstDefined(['AZURE_SQL_PASSWORD', 'DATABASE_PASSWORD', 'SQL_PASSWORD'], '')!; },
  },
  dbBackend: {
    get isSupabase() { return process.env.DB_BACKEND === 'supabase'; },
    get supabaseUrl() { return opt('SUPABASE_DB_URL'); },
    get databaseUrl() { return opt('DATABASE_URL'); },
  },
  cron: {
    get secret() { return opt('CRON_SECRET'); },
  },
  auth: {
    get jwtSecret()         { return opt('JWT_SECRET'); },
    get nextauthSecret()    { return opt('NEXTAUTH_SECRET'); },
    get consumerJwtSecret() { return opt('CONSUMER_JWT_SECRET'); },
  },
};
