// src/components/AnalyticsProvider.tsx
// NaijaMarket Intel — Mounts analytics tracking on every page
// Drop into layout.tsx alongside CookieBanner

"use client";

import { Suspense } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";

function AnalyticsInner() {
  useAnalytics(); // mounts all tracking effects
  return null;
}

export default function AnalyticsProvider() {
  return (
    <Suspense fallback={null}>
      <AnalyticsInner />
    </Suspense>
  );
}
