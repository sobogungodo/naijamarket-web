// src/lib/supabase-prisma-proxy.ts
// Shared factory: wrap a PrismaClient so its RAW methods ($queryRaw / $queryRawUnsafe /
// $executeRaw / $executeRawUnsafe) route to the Supabase pg pool (with translateTSQL) when
// DB_BACKEND=supabase. Used by BOTH shared client modules (@/lib/db and @/lib/prisma) so
// every route that imports a shared prisma reaches Postgres in the Supabase Dev environment.
// Production (DB_BACKEND unset) returns the real client untouched.
//
// Not proxied: Prisma model-builder methods (prisma.<model>.<method>) still hit the real
// client — port those separately for a pure Supabase run.
import { translateTSQL } from './tsql-translate';

export const USE_SUPABASE = process.env.DB_BACKEND === 'supabase';

function taggedToPg(strings: TemplateStringsArray, values: unknown[]): { text: string; values: unknown[] } {
  let text = '';
  strings.forEach((s, i) => { text += s; if (i < values.length) text += '$' + (i + 1); });
  return { text: translateTSQL(text), values };
}
function normalizeUnsafe(sql: string): string {
  let i = 0;
  return translateTSQL(sql.replace(/\?/g, () => '$' + (++i)));
}
async function sbPool() {
  const { supabasePool } = await import('./db-supabase');
  return supabasePool();
}

// Wrap a real PrismaClient. When DB_BACKEND!=supabase this returns the client unchanged.
export function wrapPrismaForSupabase<T extends object>(realPrisma: T): T {
  if (!USE_SUPABASE) return realPrisma;
  return new Proxy(realPrisma, {
    get(target, prop, receiver) {
      switch (prop) {
        case '$queryRaw':
          return async (strings: TemplateStringsArray, ...values: unknown[]) => {
            const { text, values: v } = taggedToPg(strings, values);
            return (await (await sbPool()).query(text, v)).rows;
          };
        case '$executeRaw':
          return async (strings: TemplateStringsArray, ...values: unknown[]) => {
            const { text, values: v } = taggedToPg(strings, values);
            return (await (await sbPool()).query(text, v)).rowCount ?? 0;
          };
        case '$queryRawUnsafe':
          return async (sql: string, ...params: unknown[]) =>
            (await (await sbPool()).query(normalizeUnsafe(sql), params)).rows;
        case '$executeRawUnsafe':
          return async (sql: string, ...params: unknown[]) =>
            (await (await sbPool()).query(normalizeUnsafe(sql), params)).rowCount ?? 0;
        default: {
          const val = Reflect.get(target, prop, receiver);
          return typeof val === 'function' ? val.bind(target) : val;
        }
      }
    },
  });
}
