/**
 * Central typed env/config. One validated place that reads every secret the app
 * needs, so secrets aren't scattered as raw process.env reads with drifting names.
 * Secrets stay ENV-INJECTED on every platform (Vercel / Supabase / AWS Secrets
 * Manager -> env at deploy) — this is not a runtime secrets SDK.
 *
 * DB credentials historically use THREE naming conventions across the codebase:
 *   AZURE_SQL_* (routes)  |  DATABASE_* (routes, irregular DATABASE_NAME)  |
 *   SQL_* (admin-dashboard, irregular SQL_USERNAME).
 * env.db reconciles them with AZURE_SQL_* preferred, preserving existing defaults.
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
    get user()     { return firstDefined(['AZURE_SQL_USER', 'DATABASE_USER', 'SQL_USERNAME'], '')!; },
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
