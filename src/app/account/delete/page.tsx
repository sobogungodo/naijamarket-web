'use client';

import { useState } from 'react';

export default function DeleteAccountPage() {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    if (!phone.trim()) {
      setErrorMsg('Phone number is required.');
      return;
    }
    if (!confirmed) {
      setErrorMsg('You must confirm before submitting.');
      return;
    }

    setErrorMsg('');
    setStatus('loading');

    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Request failed');
      }

      setStatus('success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setErrorMsg(message);
      setStatus('error');
    }
  };

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
        <div style={{
          width: '2rem',
          height: '2px',
          backgroundColor: '#00A36C',
          margin: '0 auto',
        }} />
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

        {status === 'success' ? (
          <SuccessState />
        ) : (
          <>
            {/* Header */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                marginBottom: '0.75rem',
              }}>
                <span style={{ fontSize: '1.1rem' }}>🗑️</span>
                <h1 style={{
                  fontSize: '1.05rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}>
                  Request Account Deletion
                </h1>
              </div>
              <p style={{
                fontSize: '0.82rem',
                color: '#888',
                lineHeight: 1.6,
                margin: 0,
              }}>
                Submit your phone number below. We will delete your account and all
                associated data within <span style={{ color: '#e5e5e5' }}>30 days</span>,
                in line with our{' '}
                <a
                  href="/privacy"
                  style={{ color: '#00A36C', textDecoration: 'none' }}
                >
                  Privacy Policy
                </a>
                .
              </p>
            </div>

            {/* Warning box */}
            <div style={{
              backgroundColor: '#1a0f00',
              border: '1px solid #3a2200',
              borderLeft: '3px solid #FFB800',
              borderRadius: '3px',
              padding: '0.85rem 1rem',
              marginBottom: '1.75rem',
            }}>
              <p style={{
                fontSize: '0.78rem',
                color: '#FFB800',
                margin: 0,
                lineHeight: 1.6,
                fontWeight: 500,
              }}>
                ⚠️ This action is permanent. Your submission history, subscription,
                price alerts, and all account data will be deleted and cannot be recovered.
              </p>
            </div>

            {/* Phone field */}
            <div style={{ marginBottom: '1.1rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                color: '#aaa',
                fontWeight: 500,
                marginBottom: '0.45rem',
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
              }}>
                Phone Number <span style={{ color: '#e5534b' }}>*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+2348012345678"
                style={{
                  width: '100%',
                  backgroundColor: '#0d0d0d',
                  border: '1px solid #2a2a2a',
                  borderRadius: '3px',
                  padding: '0.65rem 0.75rem',
                  fontSize: '0.88rem',
                  color: '#e5e5e5',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
                onFocus={e => { e.target.style.borderColor = '#00A36C'; }}
                onBlur={e => { e.target.style.borderColor = '#2a2a2a'; }}
              />
            </div>

            {/* Email field */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                color: '#aaa',
                fontWeight: 500,
                marginBottom: '0.45rem',
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
              }}>
                Email Address <span style={{ color: '#555', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  backgroundColor: '#0d0d0d',
                  border: '1px solid #2a2a2a',
                  borderRadius: '3px',
                  padding: '0.65rem 0.75rem',
                  fontSize: '0.88rem',
                  color: '#e5e5e5',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
                onFocus={e => { e.target.style.borderColor = '#00A36C'; }}
                onBlur={e => { e.target.style.borderColor = '#2a2a2a'; }}
              />
              <p style={{ fontSize: '0.72rem', color: '#555', margin: '0.35rem 0 0' }}>
                We'll send a confirmation when your account is deleted.
              </p>
            </div>

            {/* Confirmation checkbox */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              marginBottom: '1.5rem',
              cursor: 'pointer',
            }}
              onClick={() => setConfirmed(c => !c)}
            >
              <div style={{
                width: '16px',
                height: '16px',
                minWidth: '16px',
                backgroundColor: confirmed ? '#00A36C' : '#0d0d0d',
                border: `1px solid ${confirmed ? '#00A36C' : '#3a3a3a'}`,
                borderRadius: '2px',
                marginTop: '1px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {confirmed && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize: '0.8rem', color: '#aaa', lineHeight: 1.5 }}>
                I understand this will permanently delete my account and all data associated
                with this phone number on NaijaMarket Intel.
              </span>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div style={{
                backgroundColor: '#1a0505',
                border: '1px solid #3a1010',
                borderRadius: '3px',
                padding: '0.65rem 0.75rem',
                marginBottom: '1.1rem',
                fontSize: '0.8rem',
                color: '#e5534b',
              }}>
                {errorMsg}
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={status === 'loading'}
              style={{
                width: '100%',
                backgroundColor: status === 'loading' ? '#1a1a1a' : '#1a0505',
                border: '1px solid #3a1010',
                borderRadius: '3px',
                padding: '0.75rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: status === 'loading' ? '#555' : '#e5534b',
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '0.02em',
                transition: 'all 0.15s',
              }}
            >
              {status === 'loading' ? 'Submitting…' : 'Submit Deletion Request'}
            </button>

            {/* Footer note */}
            <p style={{
              fontSize: '0.72rem',
              color: '#444',
              textAlign: 'center',
              marginTop: '1.25rem',
              marginBottom: 0,
              lineHeight: 1.6,
            }}>
              Questions? Contact{' '}
              <a
                href="mailto:support@naijamarketintel.com"
                style={{ color: '#666', textDecoration: 'none' }}
              >
                support@naijamarketintel.com
              </a>
            </p>
          </>
        )}
      </div>

      {/* Back link */}
      <a
        href="/"
        style={{
          marginTop: '1.5rem',
          fontSize: '0.75rem',
          color: '#444',
          textDecoration: 'none',
          letterSpacing: '0.03em',
        }}
      >
        ← Back to NaijaMarket Intel
      </a>
    </main>
  );
}

function SuccessState() {
  return (
    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
      <div style={{
        width: '48px',
        height: '48px',
        backgroundColor: '#0d1f18',
        border: '1px solid #00A36C',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.25rem',
      }}>
        <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
          <path d="M1.5 8L7 13.5L18.5 2" stroke="#00A36C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 style={{
        fontSize: '1rem',
        fontWeight: 600,
        color: '#ffffff',
        marginBottom: '0.75rem',
      }}>
        Request Received
      </h2>
      <p style={{
        fontSize: '0.82rem',
        color: '#888',
        lineHeight: 1.7,
        margin: '0 auto',
        maxWidth: '320px',
      }}>
        Your account deletion request has been logged. We will process it within{' '}
        <span style={{ color: '#e5e5e5' }}>30 days</span> and send a confirmation
        if you provided an email address.
      </p>
      <div style={{
        marginTop: '1.5rem',
        padding: '0.75rem',
        backgroundColor: '#0d0d0d',
        border: '1px solid #1f1f1f',
        borderRadius: '3px',
        fontSize: '0.75rem',
        color: '#555',
      }}>
        Reference: {new Date().toISOString().slice(0, 10).replace(/-/g, '')}
        -{Math.random().toString(36).slice(2, 8).toUpperCase()}
      </div>
    </div>
  );
}
