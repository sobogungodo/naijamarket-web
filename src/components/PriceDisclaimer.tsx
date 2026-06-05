// src/components/PriceDisclaimer.tsx
// [1v] G1-WEB — Data-accuracy / no-trading-advice disclaimer
// Usage:
//   <PriceDisclaimer />           → compact inline disclaimer
//   <PriceDisclaimer expanded />  → full disclaimer for T&C / footer contexts

import React from "react";

interface PriceDisclaimerProps {
  expanded?: boolean;
  className?: string;
}

export function PriceDisclaimer({ expanded = false, className = "" }: PriceDisclaimerProps) {
  if (expanded) {
    return (
      <div className={`pd-expanded ${className}`} style={expandedStyle}>
        <p style={expandedTitleStyle}>⚠️ Data Accuracy &amp; No-Trading-Advice Notice</p>
        <p style={expandedBodyStyle}>
          All prices on NaijaMarket Intel are crowdsourced from GPS-verified field
          traders and independently validated. Prices are indicative of market
          conditions at the time and location of submission and <strong>do not
          constitute financial, investment, or trading advice</strong>. Prices may
          vary based on quantity, buyer relationship, and local conditions.
          NaijaMarket Intel and Giggababytes Oy accept no liability for decisions
          made based on data from this platform.
        </p>
      </div>
    );
  }

  return (
    <p style={compactStyle} className={`pd-compact ${className}`}>
      ⚠️{" "}
      <em>
        Prices are indicative only and do not constitute trading advice.{" "}
        <a href="/methodology" style={linkStyle}>
          How we verify prices →
        </a>
      </em>
    </p>
  );
}

const compactStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  color: "#94a3b8",
  margin: "0.5rem 0 0",
  lineHeight: 1.5,
};

const linkStyle: React.CSSProperties = {
  color: "#60a5fa",
  textDecoration: "none",
};

const expandedStyle: React.CSSProperties = {
  background: "rgba(245,158,11,0.06)",
  border: "1px solid rgba(245,158,11,0.2)",
  borderRadius: "8px",
  padding: "1rem 1.25rem",
  margin: "1rem 0",
};

const expandedTitleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "0.88rem",
  marginBottom: "0.5rem",
  color: "#f59e0b",
};

const expandedBodyStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  lineHeight: 1.65,
  color: "#94a3b8",
  margin: 0,
};
