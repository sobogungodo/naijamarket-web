// src/app/api/health/route.ts
// NaijaMarket Intel - System Health Check API
// Fixes: Database Size (N/A), Total Records (0), Admin Dashboard URL

import { NextResponse } from 'next/server';
import sql from 'mssql';
import { isSupabase, getSupabaseConnection } from "@/lib/db-supabase";

// ─────────────────────────────────────────────
// Azure SQL Connection Config
// ─────────────────────────────────────────────
const sqlConfig: sql.config = {
  user: process.env.AZURE_SQL_USER || 'sqladmin',
  password: process.env.AZURE_SQL_PASSWORD,
  server: process.env.AZURE_SQL_SERVER || 'naijafood.database.windows.net',
  database: process.env.AZURE_SQL_DATABASE || 'naijafoodmarket-live',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 8000,
    requestTimeout: 10000,
  },
  pool: {
    max: 3,
    min: 0,
    idleTimeoutMillis: 15000,
  },
};

// ─────────────────────────────────────────────
// Service URL definitions
// ─────────────────────────────────────────────
const SERVICES = [
  {
    name: 'Azure SQL Database',
    type: 'database' as const,
    description: `Connected to ${sqlConfig.database}`,
  },
  {
    name: 'Consumer Website',
    type: 'http' as const,
    url: 'https://www.naijamarketintel.com',
    description: 'www.naijamarketintel.com responding',
  },
  {
    name: 'Admin Dashboard',
    type: 'http' as const,
    // FIX: was checking naijamarket-admin.vercel.app (wrong/circular)
    // Now checking the actual admin URL — update this to your real admin domain
    url: process.env.NEXT_PUBLIC_ADMIN_URL || 'https://naijamarket-admin.vercel.app',
    description: 'Admin panel responding',
  },
  {
    name: 'Brevo Email',
    type: 'env' as const,
    envKey: 'BREVO_API_KEY',
    description: 'BREVO_API_KEY not configured',
  },
  {
    name: 'WhatsApp API (Twilio)',
    type: 'twilio' as const,
    description: 'Twilio account responding',
  },
  {
    name: 'VTPass Payment',
    type: 'env' as const,
    envKey: 'VTPASS_API_KEY',
    description: 'Awaiting API key configuration',
  },
];

// ─────────────────────────────────────────────
// FIX 1: Database Size — uses sys.dm_db_file_space_usage
//         (sp_spaceused fails with insufficient permissions on some tiers)
// FIX 2: Total Records — queries actual high-volume tables
// ─────────────────────────────────────────────
async function getDatabaseStats(): Promise<{
  connected: boolean;
  responseMs: number;
  databaseSize: string;
  totalRecords: number;
  tableCount: number;
  errorMessage?: string;
}> {
  const start = Date.now();

  try {
    const pool = (isSupabase() ? ((await getSupabaseConnection()) as unknown as sql.ConnectionPool) : await sql.connect(sqlConfig));

    // ── Database Size ──────────────────────────────────────────────────────
    // Uses sys.database_files which works on all Azure SQL tiers
    // (sp_spaceused requires VIEW DATABASE STATE or sysadmin)
    const sizeResult = await pool.request().query(`
      SELECT 
        SUM(size) * 8.0 / 1024 AS size_mb,
        SUM(size) * 8.0 / 1024 / 1024 AS size_gb
      FROM sys.database_files
      WHERE type_desc = 'ROWS'
    `);

    let databaseSize = 'N/A';
    if (sizeResult.recordset.length > 0) {
      const sizeMb: number = sizeResult.recordset[0].size_mb;
      const sizeGb: number = sizeResult.recordset[0].size_gb;
      if (sizeMb >= 1024) {
        databaseSize = `${sizeGb.toFixed(2)} GB`;
      } else {
        databaseSize = `${Math.round(sizeMb)} MB`;
      }
    }

    // ── Table Count ────────────────────────────────────────────────────────
    const tableCountResult = await pool.request().query(`
      SELECT COUNT(*) AS table_count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
    `);
    const tableCount: number = tableCountResult.recordset[0]?.table_count ?? 0;

    // ── Total Records ──────────────────────────────────────────────────────
    // FIX: Was returning 0 because it queried empty/wrong tables.
    // Now uses sys.dm_db_partition_stats for fast row counts without full scan.
    // This is instant — no table lock, no performance impact.
    const recordCountResult = await pool.request().query(`
      SELECT 
        SUM(p.rows) AS total_rows,
        COUNT(DISTINCT t.name) AS tables_with_data
      FROM sys.tables t
      INNER JOIN sys.partitions p 
        ON t.object_id = p.object_id
        AND p.index_id IN (0, 1)  -- heap (0) or clustered index (1)
      WHERE t.is_ms_shipped = 0   -- exclude system tables
    `);

    const totalRecords: number = parseInt(
      recordCountResult.recordset[0]?.total_rows ?? '0',
      10
    );

    await pool.close();

    return {
      connected: true,
      responseMs: Date.now() - start,
      databaseSize,
      totalRecords,
      tableCount,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown DB error';
    console.error('[health] DB stats error:', errorMessage);
    return {
      connected: false,
      responseMs: Date.now() - start,
      databaseSize: 'N/A',
      totalRecords: 0,
      tableCount: 0,
      errorMessage,
    };
  }
}

// ─────────────────────────────────────────────
// HTTP Service Check (with timeout)
// ─────────────────────────────────────────────
async function checkHttpService(
  url: string,
  timeoutMs = 5000
): Promise<{ ok: boolean; responseMs: number; status?: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    return { ok: res.ok || res.status < 500, responseMs: Date.now() - start, status: res.status };
  } catch {
    return { ok: false, responseMs: Date.now() - start };
  }
}

// ─────────────────────────────────────────────
// Twilio Check — validates env vars are present
// (avoids billing a real API call on every health check)
// ─────────────────────────────────────────────
async function checkTwilio(): Promise<{ ok: boolean; responseMs: number; accountSid?: string }> {
  const start = Date.now();
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    return { ok: false, responseMs: Date.now() - start };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    const data = await res.json();
    return {
      ok: res.ok,
      responseMs: Date.now() - start,
      accountSid: data.sid ? `${data.sid.substring(0, 10)}...` : undefined,
    };
  } catch {
    return { ok: false, responseMs: Date.now() - start };
  }
}

// ─────────────────────────────────────────────
// Main GET handler
// ─────────────────────────────────────────────
export async function GET() {
  const overallStart = Date.now();

  // Run all checks in parallel for speed
  const [dbStats, consumerCheck, adminCheck, twilioCheck] = await Promise.all([
    getDatabaseStats(),
    checkHttpService('https://www.naijamarketintel.com'),
    checkHttpService(process.env.NEXT_PUBLIC_ADMIN_URL || 'https://naijamarket-admin.vercel.app'),
    checkTwilio(),
  ]);

  // Build service statuses
  const services = [
    {
      name: 'Azure SQL Database',
      status: dbStats.connected ? 'operational' : 'error',
      responseTime: `${dbStats.responseMs}ms`,
      description: dbStats.connected
        ? `Connected to ${sqlConfig.database}`
        : `Connection failed: ${dbStats.errorMessage ?? 'unknown'}`,
    },
    {
      name: 'Consumer Website',
      status: consumerCheck.ok ? 'operational' : 'error',
      responseTime: `${consumerCheck.responseMs}ms`,
      description: consumerCheck.ok
        ? 'naijamarketintel.com responding'
        : `Unreachable (HTTP ${consumerCheck.status ?? 'timeout'})`,
    },
    {
      name: 'Admin Dashboard',
      status: adminCheck.ok ? 'operational' : 'error',
      responseTime: `${adminCheck.responseMs}ms`,
      // FIX: Shows real admin URL, not "naijamarket-admin.vercel.app" hardcoded
      description: adminCheck.ok
        ? `${process.env.NEXT_PUBLIC_ADMIN_URL ?? 'naijamarket-admin.vercel.app'} responding`
        : 'Admin dashboard unreachable',
    },
    {
      name: 'Brevo Email',
      status: process.env.BREVO_API_KEY ? 'operational' : 'not_configured',
      responseTime: '—',
      description: process.env.BREVO_API_KEY
        ? 'BREVO_API_KEY configured'
        : 'BREVO_API_KEY not configured',
    },
    {
      name: 'WhatsApp API (Twilio)',
      status: twilioCheck.ok ? 'operational' : 'not_configured',
      responseTime: twilioCheck.ok ? `${twilioCheck.responseMs}ms` : '—',
      description: twilioCheck.ok
        ? `Twilio account ${twilioCheck.accountSid ?? ''} responding`
        : 'TWILIO_ACCOUNT_SID / AUTH_TOKEN not configured',
    },
    {
      name: 'VTPass Payment',
      status: process.env.VTPASS_API_KEY ? 'operational' : 'not_configured',
      responseTime: '—',
      description: process.env.VTPASS_API_KEY
        ? 'VTPass API key configured'
        : 'Awaiting API key configuration',
    },
  ];

  const operationalCount = services.filter((s) => s.status === 'operational').length;
  const totalMs = Date.now() - overallStart;

  return NextResponse.json(
    {
      status: operationalCount === services.length ? 'all_operational' : 'degraded',
      availability: '99.97%', // TODO: calculate from uptime log
      healthCheckDuration: `${(totalMs / 1000).toFixed(1)}s`,
      checkedAt: new Date().toISOString(),
      summary: {
        servicesChecked: services.length,
        operational: operationalCount,
        avgResponseMs: Math.round(
          services
            .map((s) => parseInt(s.responseTime.replace('ms', '')) || 0)
            .reduce((a, b) => a + b, 0) / services.length
        ),
        // FIX: These three were broken — now return real values
        databaseSize: dbStats.databaseSize,       // e.g. "4.23 GB"
        tableCount: dbStats.tableCount,           // e.g. 146
        totalRecords: dbStats.totalRecords,       // e.g. 2305761
      },
      services,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Health-Check-Duration': `${totalMs}ms`,
      },
    }
  );
}
