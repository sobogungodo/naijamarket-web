'use client';
// src/components/CookieBanner.tsx
// NaijaMarket Intel - GDPR/NDPR Cookie Consent Banner
// Shows on first visit — bottom of screen, non-intrusive

import { useState, useEffect } from 'react';
import { getConsent, acceptAll, rejectAll, applyConsent, setDefaultConsent } from '@/lib/cookies';
import CookieModal from './CookieModal';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // Set denied defaults immediately (Google Consent Mode v2)
    setDefaultConsent();

    // Check if user has already consented
    const existing = getConsent();
    if (existing) {
      // Re-apply saved consent (loads GA if analytics was accepted)
      applyConsent(existing);
      setVisible(false);
    } else {
      // First visit — show banner after 1s delay (less jarring)
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    acceptAll();
    setVisible(false);
  };

  const handleRejectAll = () => {
    rejectAll();
    setVisible(false);
  };

  const handleManage = () => {
    setModalOpen(true);
  };

  const handleModalSave = () => {
    setModalOpen(false);
    setVisible(false);
  };

  if (!visible && !modalOpen) return null;

  return (
    <>
      {/* ── Cookie Banner ── */}
      {visible && !modalOpen && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
          role="dialog"
          aria-label="Cookie consent"
          aria-modal="false"
        >
          <div
            className="max-w-5xl mx-auto rounded-xl border shadow-2xl p-5 md:p-6"
            style={{
              background: 'var(--bg-secondary, #0d1117)',
              borderColor: 'var(--terminal-border, #1e2d1e)',
              color: 'var(--text-primary, #e6edf3)',
            }}
          >
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Icon + Text */}
              <div className="flex items-start gap-3 flex-1">
                <span className="text-2xl mt-0.5 shrink-0">🍪</span>
                <div>
                  <p className="font-semibold text-sm mb-1" style={{ color: 'var(--accent-green, #00ff41)' }}>
                    We use cookies
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted, #8b949e)' }}>
                    NaijaMarket Intel uses cookies to improve your experience and show relevant market insights.
                    We comply with{' '}
                    <strong style={{ color: 'var(--text-primary, #e6edf3)' }}>GDPR</strong> and{' '}
                    <strong style={{ color: 'var(--text-primary, #e6edf3)' }}>Nigeria's NDPR</strong>.{' '}
                    <a
                      href="/privacy"
                      className="underline hover:opacity-80 transition-opacity"
                      style={{ color: 'var(--accent-green, #00ff41)' }}
                    >
                      Privacy Policy
                    </a>
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <button
                  onClick={handleRejectAll}
                  className="px-4 py-2 rounded-lg text-xs font-medium border transition-all hover:opacity-80"
                  style={{
                    borderColor: 'var(--terminal-border, #1e2d1e)',
                    color: 'var(--text-muted, #8b949e)',
                    background: 'transparent',
                  }}
                >
                  Reject All
                </button>
                <button
                  onClick={handleManage}
                  className="px-4 py-2 rounded-lg text-xs font-medium border transition-all hover:opacity-80"
                  style={{
                    borderColor: 'var(--accent-green, #00ff41)',
                    color: 'var(--accent-green, #00ff41)',
                    background: 'transparent',
                  }}
                >
                  Manage Preferences
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="px-4 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-90"
                  style={{
                    background: 'var(--accent-green, #00ff41)',
                    color: '#000',
                  }}
                >
                  Accept All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Preferences Modal ── */}
      {modalOpen && (
        <CookieModal
          onSave={handleModalSave}
          onClose={() => {
            setModalOpen(false);
            // Keep banner visible if they close without saving
            setVisible(true);
          }}
        />
      )}
    </>
  );
}
