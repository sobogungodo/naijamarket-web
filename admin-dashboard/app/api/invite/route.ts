// admin-dashboard/app/api/invite/route.ts
// Sends team member invitation email via Brevo
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_URL = process.env.NEXTAUTH_URL || 'https://naijamarket-admin.vercel.app';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  supervisor:  'Supervisor',
  analyst:     'Analyst',
  viewer:      'Viewer',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: 'Full platform access including system settings.',
  admin:       'Can manage users, approve payouts, and access all reports.',
  supervisor:  'Can take actions on fraud alerts and review submissions.',
  analyst:     'View-only access to dashboards and reports.',
  viewer:      'Basic dashboard access only.',
};

export async function POST(request: NextRequest) {
  try {
    const { name, email, role, invitedBy } = await request.json();

    if (!email || !role) {
      return NextResponse.json({ error: 'email and role are required' }, { status: 400 });
    }

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.error('[invite] BREVO_API_KEY not set');
      return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
    }

    const roleLabel = ROLE_LABELS[role] || role;
    const roleDesc  = ROLE_DESCRIPTIONS[role] || '';
    const firstName = (name || email).split(' ')[0];

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#111827;border:1px solid #1f2937;border-radius:12px;overflow:hidden;">
    
    <div style="background:linear-gradient(135deg,#065f46,#064e3b);padding:32px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;letter-spacing:-0.5px;">
        <span style="color:#ffffff;">Naija</span><span style="color:#10b981;">Market</span> <span style="color:#f59e0b;">Intel</span>
      </h1>
      <p style="margin:8px 0 0;color:#6ee7b7;font-size:13px;">Admin Dashboard</p>
    </div>

    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;color:#f9fafb;font-size:18px;">
        You've been invited, ${firstName}!
      </h2>
      <p style="margin:0 0 24px;color:#9ca3af;font-size:14px;line-height:1.6;">
        ${invitedBy ? `<strong style="color:#e5e7eb;">${invitedBy}</strong> has` : 'You have been'} 
        invited you to join the NaijaMarket Intel Admin Dashboard as 
        <strong style="color:#10b981;">${roleLabel}</strong>.
      </p>

      <div style="background:#1f2937;border:1px solid #374151;border-left:3px solid #10b981;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 4px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Your Role</p>
        <p style="margin:0 0 4px;color:#f9fafb;font-size:15px;font-weight:600;">${roleLabel}</p>
        <p style="margin:0;color:#9ca3af;font-size:13px;">${roleDesc}</p>
      </div>

      <div style="text-align:center;margin-bottom:28px;">
        <a href="${ADMIN_URL}/login" 
           style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.02em;">
          Access Admin Dashboard →
        </a>
      </div>

      <p style="margin:0 0 8px;color:#6b7280;font-size:12px;text-align:center;">
        Log in with your email address: <strong style="color:#9ca3af;">${email}</strong>
      </p>
      <p style="margin:0;color:#4b5563;font-size:11px;text-align:center;">
        If you were not expecting this invitation, you can safely ignore this email.
      </p>
    </div>

    <div style="padding:16px 32px;border-top:1px solid #1f2937;text-align:center;">
      <p style="margin:0;color:#4b5563;font-size:11px;">
        NaijaMarket Intel · Giggababytes Oy · Lahti, Finland<br>
        <a href="https://naijamarketintel.ng" style="color:#065f46;text-decoration:none;">naijamarketintel.ng</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    const brevoResp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key':     apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender:      { name: 'NaijaMarket Intel', email: 'noreply@naijamarketintel.ng' },
        to:          [{ email, name: name || email }],
        subject:     `You've been invited to NaijaMarket Intel Admin — ${roleLabel}`,
        htmlContent,
      }),
    });

    if (!brevoResp.ok) {
      const errText = await brevoResp.text();
      console.error('[invite] Brevo error:', brevoResp.status, errText.slice(0, 200));
      return NextResponse.json(
        { error: 'Failed to send invitation email. Please try again.' },
        { status: 502 }
      );
    }

    console.log(`[invite] invitation sent to ${email} as ${roleLabel}`);
    return NextResponse.json({ success: true, email, role: roleLabel });

  } catch (error) {
    console.error('[invite] error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
