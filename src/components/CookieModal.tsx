'use client';
// src/components/CookieModal.tsx
// NaijaMarket Intel - Granular Cookie Preferences Modal
// GDPR Article 7 + NDPR Section 2.1 compliant — granular consent required

import { useState, useEffect } from 'react';
import { getConsent, saveConsent } from '@/lib/cookies';

interface Props {
  onSave: () => void;
  onClose: () => void;
}

interface CookieCategory {
  id: 'necessary' | 'analytics' | 'advertising';
  title: string;
  description: string;
  required: boolean;
  examples: string[];
}

const CATEGORIES: CookieCategory[] = [
  {
    id: 'necessary',
    title: '✅ Strictly Necessary',
    description:
      'Required for the website to function. Cannot be disabled. Includes session management, login state, and security tokens.',
    required: true,
    examples: ['Login session', 'CSRF protection', 'Language preference'],
  },
  {
    id: 'analytics',
    title: '📊 Analytics & Performance',
    description:
      'Helps us understand how visitors use NaijaMarket Intel so we can improve the platform. Data is anonymized and never sold.',
    required: false,
    examples: ['Google Analytics 4', 'Page views', 'Feature usage stats'],
  },
  {
    id: 'advertising',
    title: '📢 Advertising',
    description:
      'Allows us to show relevant market-related ads that help keep NaijaMarket Intel free for consumers. You can opt out anytime.',
    required: false,
    examples: ['Google AdSense', 'Personalized ads', 'Ad performance tracking'],
  },
];

export default function CookieModal({ onSave, onClose }: Props) {
  const [prefs, setPrefs] = useState({ analytics: false, advertising: false });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const existing = getConsent();
    if (existing) {
      setPrefs({ analytics: existing.analytics, advertising: existing.advertising });
    }
  }, []);

  const handleToggle = (id: 'analytics' | 'advertising') => {
    setPrefs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSavePrefs = () => {
    saveConsent(prefs);
    onSave();
  };

  const handleAcceptAll = () => {
    saveConsent({ analytics: true, advertising: true });
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-xl border shadow-2xl overflow-hidden"
        style={{
          background: 'var(--bg-secondary, #0d1117)',
          borderColor: 'var(--terminal-border, #1e2d1e)',
          color: 'var(--text-primary, #e6edf3)',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--terminal-border, #1e2d1e)' }}
        >
          <div>
            <h2 className="font-bold text-base" style={{ color: 'var(--accent-green, #00ff41)' }}>
              Cookie Preferences
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted, #8b949e)' }}>
              GDPR &amp; NDPR Compliant · Last updated Feb 2026
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xl hover:opacity-60 transition-opacity"
            style={{ color: 'var(--text-muted, #8b949e)' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Categories */}
        <div className="overflow-y-auto px-6 py-4 space-y-3" style={{ maxHeight: '55vh' }}>
          {CATEGORIES.map(cat => (
            <div
              key={cat.id}
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: 'var(--terminal-border, #1e2d1e)' }}
            >
              {/* Category row */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:opacity-80 transition-opacity"
                style={{ background: 'var(--bg-tertiary, #161b22)' }}
                onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{cat.title}</span>
                  {cat.required && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(0,255,65,0.1)',
                        color: 'var(--accent-green, #00ff41)',
                        border: '1px solid rgba(0,255,65,0.2)',
                      }}
                    >
                      Always On
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Toggle switch */}
                  {!cat.required && (
                    <button
                      role="switch"
                      aria-checked={prefs[cat.id as 'analytics' | 'advertising']}
                      onClick={e => {
                        e.stopPropagation();
                        handleToggle(cat.id as 'analytics' | 'advertising');
                      }}
                      className="relative inline-flex items-center w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none"
                      style={{
                        background: prefs[cat.id as 'analytics' | 'advertising']
                          ? 'var(--accent-green, #00ff41)'
                          : 'var(--terminal-border, #374151)',
                      }}
                    >
                      <span
                        className="inline-block w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                        style={{
                          transform: prefs[cat.id as 'analytics' | 'advertising']
                            ? 'translateX(22px)'
                            : 'translateX(2px)',
                        }}
                      />
                    </button>
                  )}
                  {cat.required && (
                    <div
                      className="relative inline-flex items-center w-10 h-5 rounded-full"
                      style={{ background: 'var(--accent-green, #00ff41)', opacity: 0.5 }}
                    >
                      <span
                        className="inline-block w-4 h-4 rounded-full bg-white shadow"
                        style={{ transform: 'translateX(22px)' }}
                      />
                    </div>
                  )}
                  {/* Expand chevron */}
                  <span
                    className="text-xs transition-transform duration-200"
                    style={{
                      color: 'var(--text-muted, #8b949e)',
                      transform: expandedId === cat.id ? 'rotate(180deg)' : 'rotate(0deg)',
                      display: 'inline-block',
                    }}
                  >
                    ▼
                  </span>
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === cat.id && (
                <div
                  className="px-4 py-3 border-t"
                  style={{ borderColor: 'var(--terminal-border, #1e2d1e)' }}
                >
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted, #8b949e)' }}>
                    {cat.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.examples.map(ex => (
                      <span
                        key={ex}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          background: 'var(--bg-secondary, #0d1117)',
                          color: 'var(--text-muted, #8b949e)',
                          border: '1px solid var(--terminal-border, #1e2d1e)',
                        }}
                      >
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex flex-col sm:flex-row gap-2 px-6 py-4 border-t"
          style={{ borderColor: 'var(--terminal-border, #1e2d1e)' }}
        >
          <a
            href="/privacy"
            className="text-xs underline hover:opacity-80 transition-opacity sm:mr-auto self-center"
            style={{ color: 'var(--text-muted, #8b949e)' }}
          >
            Privacy Policy
          </a>
          <button
            onClick={handleSavePrefs}
            className="px-4 py-2 rounded-lg text-xs font-medium border transition-all hover:opacity-80"
            style={{
              borderColor: 'var(--accent-green, #00ff41)',
              color: 'var(--accent-green, #00ff41)',
              background: 'transparent',
            }}
          >
            Save My Preferences
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
  );
}
