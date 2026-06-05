// src/components/FreshnessIndicator.tsx
// [1q] G1-WEB — Price data freshness indicator for all price surfaces
//
// Usage:
//   <FreshnessIndicator date="2026-06-05" />
//   <FreshnessIndicator date={priceDate} slot="MORNING" />
//
// slot values: "MORNING" | "MIDDAY" | "AFTERNOON" (from time_slot_name)

"use client";

import React from "react";

interface FreshnessIndicatorProps {
  date: string | Date | null | undefined;
  slot?: "MORNING" | "MIDDAY" | "AFTERNOON" | string;
  className?: string;
  compact?: boolean;   // true = icon-only badge; false = full label
}

const SLOT_TIMES: Record<string, string> = {
  MORNING:   "08:30 WAT",
  MIDDAY:    "11:30 WAT",
  AFTERNOON: "14:30 WAT",
};

function daysDiff(dateStr: string | Date): number {
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  // Normalise both to midnight UTC to avoid TZ drift
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const then  = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return Math.floor((today.getTime() - then.getTime()) / 86_400_000);
}

export function FreshnessIndicator({
  date,
  slot,
  className = "",
  compact = false,
}: FreshnessIndicatorProps) {
  if (!date) return null;

  const diff = daysDiff(date);
  const slotTime = slot ? SLOT_TIMES[slot.toUpperCase()] : null;

  // ── Fresh (same day) ──────────────────────────────────────────────────────
  if (diff <= 0) {
    const label = slotTime ? `Updated ${slotTime}` : "Updated today";
    if (compact) {
      return (
        <span className={`fi-badge fi-fresh ${className}`} style={freshBadgeStyle} title={label}>
          🟢
        </span>
      );
    }
    return (
      <span className={`fi-label fi-fresh ${className}`} style={{ ...labelBase, color: "#10b981" }}>
        🟢 {label}
      </span>
    );
  }

  // ── Yesterday ─────────────────────────────────────────────────────────────
  if (diff === 1) {
    const label = "Prices from yesterday";
    if (compact) {
      return (
        <span className={`fi-badge fi-stale ${className}`} style={staleBadgeStyle} title={label}>
          🟡
        </span>
      );
    }
    return (
      <span className={`fi-label fi-stale ${className}`} style={{ ...labelBase, color: "#f59e0b" }}>
        🟡 {label}
      </span>
    );
  }

  // ── Older ─────────────────────────────────────────────────────────────────
  const d = typeof date === "string" ? new Date(date) : date;
  const formatted = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const label = `Prices from ${formatted}`;

  if (compact) {
    return (
      <span className={`fi-badge fi-old ${className}`} style={oldBadgeStyle} title={label}>
        🔴
      </span>
    );
  }
  return (
    <span className={`fi-label fi-old ${className}`} style={{ ...labelBase, color: "#ef4444" }}>
      ⚠️ {label} — may not reflect current market
    </span>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const labelBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  fontSize: "0.75rem",
  lineHeight: 1.4,
};

const badgeBase: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.7rem",
  lineHeight: 1,
  cursor: "default",
};

const freshBadgeStyle = { ...badgeBase };
const staleBadgeStyle = { ...badgeBase };
const oldBadgeStyle   = { ...badgeBase };
