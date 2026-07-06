// src/hooks/useAnalytics.ts
// NaijaMarket Intel — Analytics tracking hook
// Usage:
//   const { trackEvent, trackFeature } = useAnalytics();
//   trackEvent("BUTTON_CLICK", { button_id: "price-check-fab" });
//   trackFeature("prices", { item_id: "ITM00001" });

"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { v4 as uuidv4 } from "uuid";

const ENDPOINT = "/api/analytics/track";

// ── Anonymous session ID — persists for browser session only ─────────────────
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("nmi_sid");
  if (!id) {
    id = uuidv4();
    sessionStorage.setItem("nmi_sid", id);
  }
  return id;
}

// ── UTM params from URL ───────────────────────────────────────────────────────
function getUTM() {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source:   p.get("utm_source")   || undefined,
    utm_medium:   p.get("utm_medium")   || undefined,
    utm_campaign: p.get("utm_campaign") || undefined,
  };
}

// ── Fire-and-forget — analytics must never block UI ──────────────────────────
async function fire(event_type: string, payload: Record<string, any>) {
  try {
    await fetch(ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ event_type, payload }),
      keepalive: true,
    });
  } catch {
    // Silent fail — analytics never breaks UX
  }
}

export function useAnalytics() {
  const pathname      = usePathname();
  const { data: sess} = useSession();
  const sessionStart  = useRef<number>(Date.now());
  const scrollFired   = useRef<Set<number>>(new Set());

  // ── Page view on route change ───────────────────────────────────────────────
  useEffect(() => {
    const sid = getSessionId();
    fire("PAGE_VIEW", {
      session_id: sid,
      page_path:  pathname,
      referrer:   typeof document !== "undefined" ? document.referrer : "",
      ...getUTM(),
    });

    // Reset scroll tracking per page
    scrollFired.current = new Set();
    sessionStart.current = Date.now();
  }, [pathname]);

  // ── Session start/end for authenticated users ───────────────────────────────
  useEffect(() => {
    if (!sess?.user) return;
    fire("SESSION_START", {});

    return () => {
      const duration = Math.round((Date.now() - sessionStart.current) / 1000);
      fire("SESSION_END", { session_duration_sec: duration });
    };
  }, [sess?.user]);

  // ── Scroll depth tracking ───────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      const pct = Math.round(
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
      );
      const milestones = [25, 50, 75, 100];
      for (const m of milestones) {
        if (pct >= m && !scrollFired.current.has(m)) {
          scrollFired.current.add(m);
          fire("SCROLL_DEPTH", {
            session_id:       getSessionId(),
            page_path:        pathname,
            scroll_depth_pct: m,
          });
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // ── Track button/CTA click ──────────────────────────────────────────────────
  const trackClick = useCallback((button_id: string) => {
    fire("BUTTON_CLICK", {
      session_id: getSessionId(),
      page_path:  pathname,
      button_id,
    });
  }, [pathname]);

  // ── Track CTA click (WhatsApp FABs) ────────────────────────────────────────
  const trackCTA = useCallback((button_id: string) => {
    fire("CTA_CLICK", {
      session_id: getSessionId(),
      page_path:  pathname,
      button_id,
    });
  }, [pathname]);

  // ── Track authenticated feature use ────────────────────────────────────────
  const trackFeature = useCallback((
    feature_name: string,
    extras: { item_id?: string; market_id?: string; metadata?: object } = {}
  ) => {
    if (!sess?.user) return;
    fire("FEATURE_USE", { feature_name, ...extras });
  }, [sess?.user]);

  // ── Track search ────────────────────────────────────────────────────────────
  const trackSearch = useCallback((item_id: string, market_id?: string) => {
    if (!sess?.user) return;
    fire("SEARCH", { item_id, market_id });
  }, [sess?.user]);

  // ── Track upgrade/downgrade ─────────────────────────────────────────────────
  const trackTierChange = useCallback((
    type: "UPGRADE" | "DOWNGRADE",
    metadata: object
  ) => {
    if (!sess?.user) return;
    fire(type, { metadata });
  }, [sess?.user]);

  return { trackClick, trackCTA, trackFeature, trackSearch, trackTierChange };
}
