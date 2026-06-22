/**
 * Platform Configuration API Route
 * GET /api/config - read all settings from dbo.Admin_Config, grouped by section,
 *                   with stored string values coerced back to their JS types.
 *                   Secret rows (is_secret=1) are masked as '****'.
 * PUT /api/config - upsert a single setting { section, key_name, value, adminEmail }.
 *                   Non-secret values are stored in key_value as plain strings.
 *                   Secret values (section === 'api') are AES-256-CBC encrypted into
 *                   encrypted_value using SETTINGS_ENCRYPTION_KEY. Session required.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query, getConnection } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ConfigRow {
  section: string;
  key_name: string;
  key_value: string | null;
  encrypted_value: string | null;
  is_secret: boolean;
}

// Coerce a stored string back to its original JS type so the client receives
// the same types as the original mockSettings object.
function coerceValue(v: string | null): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  const t = v.trim();
  if (t !== '' && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return v;
}

// AES-256-CBC encrypt a secret value. Output: "<ivHex>:<cipherHex>".
function encryptSecret(plain: string): string {
  const key = Buffer.from(process.env.SETTINGS_ENCRYPTION_KEY || '', 'hex');
  if (key.length !== 32) {
    throw new Error('SETTINGS_ENCRYPTION_KEY must be a 32-byte hex string');
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export async function GET() {
  try {
    const rows = await query<ConfigRow>(
      'SELECT section, key_name, key_value, encrypted_value, is_secret FROM dbo.Admin_Config'
    );

    const data: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      if (!data[row.section]) data[row.section] = {};
      data[row.section][row.key_name] = row.is_secret
        ? '****'
        : coerceValue(row.key_value);
    }

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[config GET] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { section, key_name, value } = body as {
      section?: string;
      key_name?: string;
      value?: unknown;
    };
    const adminEmail =
      body.adminEmail ||
      (session.user as { email?: string } | undefined)?.email ||
      'unknown';

    if (!section || !key_name) {
      return NextResponse.json(
        { success: false, error: 'section and key_name are required' },
        { status: 400 }
      );
    }

    // Secrets live in the 'api' section; everything else is stored in plaintext.
    const isSecret = section === 'api';
    let keyValue: string | null = null;
    let encryptedValue: string | null = null;
    if (isSecret) {
      encryptedValue = encryptSecret(value == null ? '' : String(value));
    } else {
      keyValue = value == null ? null : String(value);
    }

    const connection = await getConnection();
    const req = connection.request();
    req.input('section', section);
    req.input('key_name', key_name);
    req.input('key_value', keyValue);
    req.input('encrypted_value', encryptedValue);
    req.input('is_secret', isSecret ? 1 : 0);
    req.input('updated_by', adminEmail);
    await req.query(`
      MERGE dbo.Admin_Config AS target
      USING (SELECT @section AS section, @key_name AS key_name) AS src
        ON target.section = src.section AND target.key_name = src.key_name
      WHEN MATCHED THEN
        UPDATE SET key_value = @key_value,
                   encrypted_value = @encrypted_value,
                   is_secret = @is_secret,
                   updated_by = @updated_by,
                   updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (section, key_name, key_value, encrypted_value, is_secret, updated_by)
        VALUES (@section, @key_name, @key_value, @encrypted_value, @is_secret, @updated_by);
    `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[config PUT] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}
