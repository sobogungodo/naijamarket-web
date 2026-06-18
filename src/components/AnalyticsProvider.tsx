// src/components/AnalyticsProvider.tsx
// v2 — no useSearchParams (caused layout crash)
// Uses window.location directly — safe in client components

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const ENDPOINT = "/api/analytics/track";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("nmi_sid");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("nmi_sid", id);
  }
  return id;
}

async function fire(event_type: string, payload: Record<string, any>) {
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type, payload }),
      keepalive: true,
    });
  } catch {
    // Silent fail — analytics must never break UX
  }
}

export default function AnalyticsProvider() {
  const pathname     = usePathname();
  let sess = null;
  try {
    const result = useSession();
    sess = result?.data ?? null;
  } catch {
    sess = null;
  }
  const sessionStart = useRef<number>(Date.now());
  const scrollFired  = useRef<Set<number>>(new Set());

  // Page view on route change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sid = getSessionId();
    const params = new URLSearchParams(window.location.search);
    fire("PAGE_VIEW", {
      session_id:   sid,
      page_path:    pathname,
      referrer:     document.referrer || "",
      utm_source:   params.get("utm_source")   || undefined,
      utm_medium:   params.get("utm_medium")   || undefined,
      utm_campaign: params.get("utm_campaign") || undefined,
    });
    scrollFired.current = new Set();
    sessionStart.current = Date.now();
  }, [pathname]);

  // Session start/end for authenticated users
  useEffect(() => {
    if (!sess?.user) return;
    fire("SESSION_START", {});
    return () => {
      const duration = Math.round((Date.now() - sessionStart.current) / 1000);
      fire("SESSION_END", { session_duration_sec: duration });
    };
  }, [sess?.user]);

  // Scroll depth
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      const total = document.body.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const pct = Math.round((window.scrollY / total) * 100);
      for (const m of [25, 50, 75, 100]) {
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

  return null;
}
