// src/components/WhatsAppCTA.tsx
// [1u] G1-WEB — Prominent wa.me click-to-WhatsApp CTA
// Two variants:
//   <WhatsAppCTA />           → sticky bottom-right button (default, appears after scroll)
//   <WhatsAppCTA inline />    → inline banner CTA for embedding in pages

"use client";

import { useState, useEffect } from "react";

const WA_NUMBER = "2349131095009"; // NaijaMarket Intel WhatsApp number
const WA_URL = `https://wa.me/${WA_NUMBER}?text=menu`;

interface WhatsAppCTAProps {
  inline?: boolean;
  message?: string;
  label?: string;
  variant?: "consumer" | "reporter";
}

export default function WhatsAppCTA({
  inline = false,
  message = "menu",
  label = "Price Check",
  variant = "consumer",
}: WhatsAppCTAProps) {
  const [visible, setVisible] = useState(false);
  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;

  // Sticky button: show after user scrolls 300px
  useEffect(() => {
    if (inline) return;
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [inline]);

  if (inline) {
    return (
      <>
        <style>{INLINE_STYLES}</style>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="wa-inline"
          aria-label={label}
        >
          <WhatsAppIcon />
          <span>{label}</span>
          <span className="wa-inline-badge">Free</span>
        </a>
      </>
    );
  }

  // Sticky variant
  const isReporter = variant === "reporter";
  return (
    <>
      <style>{STICKY_STYLES}</style>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`wa-sticky ${isReporter ? "wa-sticky-reporter" : ""} ${visible ? "wa-sticky-visible" : ""}`}
        aria-label={isReporter ? "Register as Price Reporter on WhatsApp" : "Open NaijaMarket Intel on WhatsApp"}
        title={isReporter ? "Register as Price Reporter" : "Check prices on WhatsApp"}
        style={isReporter ? { bottom: "5.5rem" } : {}}
      >
        {isReporter ? <PencilIcon size={26} /> : <WhatsAppIcon size={26} />}
        <span className="wa-sticky-label">{isReporter ? "Register as Price Reporter" : "Price Check"}</span>
      </a>
    </>
  );
}

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function PencilIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  );
}

const STICKY_STYLES = `
.wa-sticky {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #25d366;
  color: #fff;
  border-radius: 2rem;
  padding: 0.65rem 1.1rem 0.65rem 0.85rem;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 0 4px 16px rgba(37,211,102,0.35);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.25s ease, transform 0.25s ease, box-shadow 0.2s ease;
  pointer-events: none;
}
.wa-sticky-visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
.wa-sticky:hover {
  background: #22c55e;
  box-shadow: 0 6px 20px rgba(37,211,102,0.45);
}
.wa-sticky-label { white-space: nowrap; }
.wa-sticky-reporter {
  background: #d97706;
  box-shadow: 0 4px 16px rgba(217,119,6,0.35);
}
.wa-sticky-reporter:hover {
  background: #b45309;
  box-shadow: 0 6px 20px rgba(217,119,6,0.45);
}
@media (max-width: 480px) {
  .wa-sticky { padding: 0.75rem; border-radius: 50%; }
  .wa-sticky-label { display: none; }
}
`;

const INLINE_STYLES = `
.wa-inline {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  background: #25d366;
  color: #fff;
  border-radius: 8px;
  padding: 0.7rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 2px 8px rgba(37,211,102,0.25);
}
.wa-inline:hover {
  background: #22c55e;
  box-shadow: 0 4px 14px rgba(37,211,102,0.4);
}
.wa-inline-badge {
  background: rgba(255,255,255,0.2);
  border-radius: 4px;
  padding: 0.1em 0.45em;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
`;
