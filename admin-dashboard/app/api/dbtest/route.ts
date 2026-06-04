import { NextResponse } from 'next/server';
import sql from 'mssql';

export async function GET() {
  const config = {
    user: process.env.SQL_USER || process.env.AZURE_SQL_USER || 'NOT_SET',
    password: process.env.SQL_PASSWORD || process.env.AZURE_SQL_PASSWORD || 'NOT_SET',
    server: process.env.SQL_SERVER || process.env.AZURE_SQL_SERVER || 'NOT_SET',
    database: process.env.SQL_DATABASE || process.env.AZURE_SQL_DATABASE || 'NOT_SET',
    options: { encrypt: true, trustServerCertificate: false },
    connectionTimeout: 10000,
  };

  const safeConfig = {
    user: config.user,
    password: config.password ? `${config.password.slice(0,3)}***${config.password.slice(-3)}` : 'NOT_SET',
    server: config.server,
    database: config.database,
  };

  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT DB_NAME() AS db');
    await pool.close();
    return NextResponse.json({ success: true, config: safeConfig, db: result.recordset[0].db });
  } catch (e: any) {
    return NextResponse.json({ success: false, config: safeConfig, error: e.message }, { status: 500 });
  }
}
