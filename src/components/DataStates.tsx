// src/components/DataStates.tsx
// [1t] G1-WEB — Standard loading, error, and empty states for all query pages
// [1s] G1-WEB — UpgradePrompt for tier-gated features
//
// Exports:
//   LoadingState    — spinner + label for async fetches
//   ErrorState      — error card with retry action
//   EmptyState      — empty results with guidance
//   UpgradePrompt   — tier-gate upgrade card

"use client";

import React from "react";
import { PAYMENTS_ENABLED } from "@/lib/flags";

// ─── LoadingState ─────────────────────────────────────────────────────────────
interface LoadingStateProps {
  label?: string;
  rows?: number;  // number of skeleton rows to show
  className?: string;
}

export function LoadingState({ label = "Loading prices…", rows = 5, className = "" }: LoadingStateProps) {
  return (
    <div className={`ds-loading ${className}`} style={containerStyle}>
      <div style={spinnerWrap}>
        <div style={spinnerStyle} className="ds-spinner" />
        <span style={loadLabelStyle}>{label}</span>
      </div>
      <div style={{ width: "100%", marginTop: "1.5rem" }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              ...skeletonRow,
              width: `${75 + Math.random() * 20}%`,
              opacity: 1 - i * 0.12,
            }}
            className="ds-skeleton"
          />
        ))}
      </div>
      <style>{ANIM_STYLES}</style>
    </div>
  );
}

// ─── ErrorState ───────────────────────────────────────────────────────────────
interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Unable to load prices",
  message = "There was a problem connecting to the server. Please try again.",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div className={`ds-error ${className}`} style={{ ...containerStyle, ...errorBoxStyle }}>
      <span style={{ fontSize: "2rem", lineHeight: 1 }}>⚠️</span>
      <p style={errorTitleStyle}>{title}</p>
      <p style={errorMsgStyle}>{message}</p>
      {onRetry && (
        <button onClick={onRetry} style={retryBtnStyle} className="ds-retry">
          Try again
        </button>
      )}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
interface EmptyStateProps {
  title?: string;
  message?: string;
  hint?: string;
  className?: string;
}

export function EmptyState({
  title = "No prices found",
  message = "There are no prices matching your filters right now.",
  hint = "Try adjusting the state, category, or search term.",
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`ds-empty ${className}`} style={{ ...containerStyle, textAlign: "center" }}>
      <span style={{ fontSize: "2.5rem", lineHeight: 1 }}>📭</span>
      <p style={errorTitleStyle}>{title}</p>
      <p style={errorMsgStyle}>{message}</p>
      {hint && <p style={{ ...errorMsgStyle, fontSize: "0.82rem", marginTop: "0.25rem" }}>{hint}</p>}
    </div>
  );
}

// ─── UpgradePrompt [1s] ────────────────────────────────────────────────────────
const TIER_COLORS: Record<string, string> = {
  SILVER:     "#94a3b8",
  GOLD:       "#f59e0b",
  BUSINESS:   "#3b82f6",
  CORPORATE:  "#8b5cf6",
  ENTERPRISE: "#10b981",
};

const TIER_PRICES: Record<string, string> = {
  SILVER:     "₦500/week",
  GOLD:       "₦2,000/month",
  BUSINESS:   "₦15,000/month",
  CORPORATE:  "₦50,000/month",
  ENTERPRISE: "₦150,000/month",
};

interface UpgradePromptProps {
  requiredTier: "SILVER" | "GOLD" | "BUSINESS" | "CORPORATE" | "ENTERPRISE";
  featureName: string;
  featureDesc?: string;
  className?: string;
}

export function UpgradePrompt({
  requiredTier,
  featureName,
  featureDesc,
  className = "",
}: UpgradePromptProps) {
  const color = TIER_COLORS[requiredTier] ?? "#94a3b8";
  const price = TIER_PRICES[requiredTier] ?? "";

  return (
    <div
      className={`ds-upgrade ${className}`}
      style={{ ...upgradeBoxStyle, borderColor: `${color}40`, borderTopColor: color }}
    >
      <div style={upgradeBadgeStyle}>
        <span style={{ ...tierLabelStyle, color }}>🔒 {requiredTier} required</span>
        <span style={tierPriceStyle}>{price}</span>
      </div>
      <p style={upgradeFeatureStyle}>{featureName}</p>
      {featureDesc && <p style={upgradeDescStyle}>{featureDesc}</p>}
      {PAYMENTS_ENABLED ? (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <a href="/pricing" style={{ ...upgradeBtnStyle, background: color }}>
            Upgrade now
          </a>
          <a
            href={`https://wa.me/2349131095009?text=I%20want%20to%20upgrade%20to%20${requiredTier}`}
            target="_blank"
            rel="noopener noreferrer"
            style={waUpgradeBtnStyle}
          >
            WhatsApp upgrade
          </a>
        </div>
      ) : (
        <p style={{ ...upgradeDescStyle, marginTop: "1rem" }}>
          More plans are coming soon. Enjoy the free tier for now.
        </p>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "2.5rem 1rem",
  width: "100%",
};

const spinnerWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.75rem",
};

const spinnerStyle: React.CSSProperties = {
  width: "2rem",
  height: "2rem",
  borderRadius: "50%",
  border: "3px solid rgba(59,130,246,0.15)",
  borderTopColor: "#3b82f6",
};

const loadLabelStyle: React.CSSProperties = {
  fontSize: "0.88rem",
  color: "#94a3b8",
};

const skeletonRow: React.CSSProperties = {
  height: "2rem",
  background: "rgba(148,163,184,0.08)",
  borderRadius: "4px",
  marginBottom: "0.6rem",
  animation: "ds-pulse 1.5s ease-in-out infinite",
};

const errorBoxStyle: React.CSSProperties = {
  background: "rgba(239,68,68,0.05)",
  border: "1px solid rgba(239,68,68,0.2)",
  borderRadius: "10px",
  gap: "0.5rem",
};

const errorTitleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "0.95rem",
  margin: "0.25rem 0 0",
};

const errorMsgStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#94a3b8",
  margin: "0.25rem 0 0",
  textAlign: "center",
  maxWidth: "28rem",
};

const retryBtnStyle: React.CSSProperties = {
  marginTop: "0.75rem",
  padding: "0.45rem 1.2rem",
  borderRadius: "6px",
  background: "rgba(59,130,246,0.12)",
  border: "1px solid rgba(59,130,246,0.3)",
  color: "#60a5fa",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
};

const upgradeBoxStyle: React.CSSProperties = {
  border: "1px solid",
  borderTopWidth: "3px",
  borderRadius: "10px",
  padding: "1.5rem",
  background: "rgba(255,255,255,0.02)",
  maxWidth: "480px",
};

const upgradeBadgeStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "0.75rem",
};

const tierLabelStyle: React.CSSProperties = {
  fontSize: "0.82rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
};

const tierPriceStyle: React.CSSProperties = {
  fontSize: "0.82rem",
  color: "#94a3b8",
};

const upgradeFeatureStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "1rem",
  margin: 0,
};

const upgradeDescStyle: React.CSSProperties = {
  fontSize: "0.88rem",
  color: "#94a3b8",
  margin: "0.4rem 0 0",
  lineHeight: 1.6,
};

const upgradeBtnStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "0.5rem 1.1rem",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "0.85rem",
  fontWeight: 600,
  textDecoration: "none",
  transition: "opacity 0.2s",
};

const waUpgradeBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  padding: "0.5rem 1rem",
  borderRadius: "6px",
  background: "rgba(37,211,102,0.12)",
  border: "1px solid rgba(37,211,102,0.3)",
  color: "#25d366",
  fontSize: "0.85rem",
  fontWeight: 600,
  textDecoration: "none",
};

const ANIM_STYLES = `
@keyframes ds-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@keyframes ds-spin {
  to { transform: rotate(360deg); }
}
.ds-spinner { animation: ds-spin 0.8s linear infinite; }
`;
