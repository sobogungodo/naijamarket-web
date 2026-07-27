// Public account-deletion info page. Google Play Console points here, so this URL
// must always resolve. Deletion is self-service and authenticated — it lives behind
// Settings → Security in the signed-in dashboard. This page is a sign-in CTA, not a
// form: it carries no false "permanent / cannot be recovered / 30 days" claims
// (deletion is a reversible deactivation; signing in again restores the account).

export const metadata = {
  title: 'Delete Your Account — NaijaMarket Intel',
  description: 'How to delete your NaijaMarket Intel account.',
};

export default function DeleteAccountPage() {
  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      color: '#e5e5e5',
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      {/* Logo / Brand */}
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <div style={{
          fontSize: '0.7rem',
          letterSpacing: '0.25em',
          color: '#00A36C',
          fontWeight: 700,
          textTransform: 'uppercase',
          marginBottom: '0.4rem',
        }}>
          NaijaMarket Intel
        </div>
        <div style={{ width: '2rem', height: '2px', backgroundColor: '#00A36C', margin: '0 auto' }} />
      </div>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '480px',
        backgroundColor: '#111111',
        border: '1px solid #1f1f1f',
        borderRadius: '4px',
        padding: '2rem',
      }}>
        <h1 style={{
          fontSize: '1.05rem',
          fontWeight: 600,
          color: '#ffffff',
          margin: '0 0 1rem',
          letterSpacing: '-0.01em',
        }}>
          Delete Your Account
        </h1>

        <p style={{ fontSize: '0.85rem', color: '#aaa', lineHeight: 1.7, margin: '0 0 1rem' }}>
          To delete your NaijaMarket Intel account, sign in and open{' '}
          <strong style={{ color: '#e5e5e5' }}>Settings → Security → Delete Account</strong>.
        </p>

        <p style={{ fontSize: '0.85rem', color: '#aaa', lineHeight: 1.7, margin: '0 0 1.5rem' }}>
          Deleting your account deactivates it and revokes access immediately. You can
          restore it later by signing in again.
        </p>

        <a
          href="/dashboard/settings"
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'center',
            boxSizing: 'border-box',
            backgroundColor: '#00A36C',
            color: '#04120c',
            fontSize: '0.85rem',
            fontWeight: 600,
            padding: '0.75rem',
            borderRadius: '3px',
            textDecoration: 'none',
            letterSpacing: '0.02em',
          }}
        >
          Sign in to delete my account
        </a>

        <p style={{ fontSize: '0.72rem', color: '#555', textAlign: 'center', margin: '1.25rem 0 0', lineHeight: 1.6 }}>
          Questions? Contact{' '}
          <a href="mailto:support@naijamarketintel.com" style={{ color: '#666', textDecoration: 'none' }}>
            support@naijamarketintel.com
          </a>
        </p>
      </div>

      {/* Back link */}
      <a
        href="/"
        style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#444', textDecoration: 'none', letterSpacing: '0.03em' }}
      >
        ← Back to NaijaMarket Intel
      </a>
    </main>
  );
}
