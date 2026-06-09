import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';

export const dynamic = 'force-dynamic';

const dbConfig: sql.config = {
  server: process.env.AZURE_SQL_SERVER || 'naijafood.database.windows.net',
  database: process.env.AZURE_SQL_DATABASE || 'naijafoodmarket-live',
  user: process.env.AZURE_SQL_USER || 'igiiwe',
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 15000,
    requestTimeout: 15000,
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, email } = body;

    if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
      return NextResponse.json({ error: 'Valid phone number is required.' }, { status: 400 });
    }

    const cleanPhone = phone.trim();
    const cleanEmail = email?.trim() || null;

    let pool: sql.ConnectionPool | null = null;
    try {
      pool = await sql.connect(dbConfig);

      // Check if a pending request already exists for this phone
      const existing = await pool.request()
        .input('phone', sql.VarChar(20), cleanPhone)
        .query(`
          SELECT request_id FROM dbo.Deletion_Requests
          WHERE phone = @phone AND status = 'PENDING'
        `);

      if (existing.recordset.length > 0) {
        return NextResponse.json(
          { error: 'A deletion request for this number is already pending.' },
          { status: 409 }
        );
      }

      // Insert deletion request
      await pool.request()
        .input('phone', sql.VarChar(20), cleanPhone)
        .input('email', sql.VarChar(100), cleanEmail)
        .input('source', sql.VarChar(20), 'WEB')
        .query(`
          INSERT INTO dbo.Deletion_Requests (phone, email, request_source, status, requested_at)
          VALUES (@phone, @email, @source, 'PENDING', GETUTCDATE())
        `);

    } finally {
      if (pool) await pool.close();
    }

    // Fire-and-forget Brevo notification email to support
    sendBrevoNotification(cleanPhone, cleanEmail).catch(() => {});

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    console.error('[DELETE ACCOUNT]', err);
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
  }
}

async function sendBrevoNotification(phone: string, email: string | null) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return;

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'NaijaMarket Intel', email: 'noreply@naijamarketintel.ng' },
      to: [{ email: 'support@naijamarketintel.com' }],
      subject: `Account Deletion Request — ${phone}`,
      htmlContent: `
        <p>A new account deletion request has been submitted.</p>
        <table>
          <tr><td><strong>Phone:</strong></td><td>${phone}</td></tr>
          <tr><td><strong>Email:</strong></td><td>${email || '—'}</td></tr>
          <tr><td><strong>Time (UTC):</strong></td><td>${new Date().toISOString()}</td></tr>
        </table>
        <p>Process within 30 days per NDPA / GDPR Article 17.</p>
      `,
    }),
  });
}
