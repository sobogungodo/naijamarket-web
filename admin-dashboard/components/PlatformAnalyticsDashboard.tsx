// admin-dashboard/components/PlatformAnalyticsDashboard.tsx
// Fetches from consumer web API /api/analytics/summary
// Renders platform analytics: site visitors, CTAs, feature usage, searches

"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_CONSUMER_API_URL || "https://www.naijamarketintel.com";

interface Summary {
  period_days: number;
  site_overview: {
    total_events: number; unique_sessions: number; page_views: number;
    cta_clicks: number; btn_clicks: number;
    mobile_sessions: number; desktop_sessions: number;
  };
  top_pages:     { page_path: string; views: number }[];
  top_ctas:      { button_id: string; clicks: number }[];
  by_country:    { country: string; sessions: number }[];
  feature_usage: { feature_name: string; uses: number; unique_users: number }[];
  top_searches:  { item_id: string; item_name: string; searches: number }[];
  by_tier:       { subscription_tier: string; active_users: number }[];
  daily_trend:   { date: string; events: number; sessions: number }[];
}

const COLORS = {
  bg: "#0d0d0d", surface: "#1a1a1a", border: "#2a2a2a",
  green: "#00ff88", amber: "#f59e0b", blue: "#3b82f6",
  purple: "#8b5cf6", text: "#e2e8f0", muted: "#64748b",
};

const TIER_COLORS: Record<string, string> = {
  FREE: "#6b7280", SILVER: "#9ca3af", GOLD: "#f59e0b",
  BUSINESS: "#3b82f6", CORPORATE: "#8b5cf6", ENTERPRISE: "#ec4899",
};

export default function PlatformAnalyticsDashboard() {
  const [data, setData]       = useState<Summary | null>(null);
  const [days, setDays]       = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/analytics/summary?days=${days}`, {
      credentials: "include",
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError("Failed to load: " + e.message); setLoading(false); });
  }, [days]);

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontFamily: "monospace" }}>
      ↻ Loading platform analytics...
    </div>
  );
  if (error) return (
    <div style={{ padding: 40, textAlign: "center", color: "#ef4444", fontFamily: "monospace" }}>
      {error}
    </div>
  );
  if (!data) return null;

  const s = data.site_overview;
  const mobileShare = (s.mobile_sessions + s.desktop_sessions) > 0
    ? Math.round((s.mobile_sessions / (s.mobile_sessions + s.desktop_sessions)) * 100)
    : 0;
  const maxTrend = Math.max(...data.daily_trend.map(d => d.sessions), 1);

  return (
    <div style={{ color: COLORS.text, fontFamily: "monospace" }}>
      {/* Period selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[7, 14, 30, 90].map(d => (
          <button key={d} onClick={() => setDays(d)} style={{
            padding: "6px 14px", borderRadius: 6, fontSize: 11,
            fontFamily: "monospace", cursor: "pointer",
            background: days === d ? "rgba(0,255,136,0.1)" : "transparent",
            border: days === d ? "1px solid rgba(0,255,136,0.5)" : "1px solid #333",
            color: days === d ? COLORS.green : COLORS.muted,
            letterSpacing: "0.8px", textTransform: "uppercase" as const,
          }}>{d}D</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: COLORS.muted, alignSelf: "center" }}>
          Last {days} days · Source: Azure SQL
        </span>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Unique Sessions", value: s.unique_sessions.toLocaleString(), color: COLORS.green },
          { label: "Page Views",      value: s.page_views.toLocaleString(),      color: COLORS.blue },
          { label: "CTA Clicks",      value: s.cta_clicks.toLocaleString(),      color: COLORS.amber },
          { label: "Mobile Share",    value: `${mobileShare}%`,                  color: COLORS.purple },
        ].map((k, i) => (
          <div key={i} style={{
            background: COLORS.surface, borderRadius: 8, padding: "14px 16px",
            borderTop: `3px solid ${k.color}`,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <Panel title="TOP PAGES">
          {data.top_pages.map((p, i) => (
            <BarRow key={i} label={p.page_path || "/"} value={p.views}
              max={data.top_pages[0]?.views || 1} color={COLORS.blue} />
          ))}
        </Panel>
        <Panel title="TOP CTAs CLICKED">
          {data.top_ctas.map((c, i) => (
            <BarRow key={i} label={c.button_id} value={c.clicks}
              max={data.top_ctas[0]?.clicks || 1} color={COLORS.amber} />
          ))}
        </Panel>
        <Panel title="TOP SEARCHED COMMODITIES">
          {data.top_searches.map((s, i) => (
            <BarRow key={i} label={s.item_name} value={s.searches}
              max={data.top_searches[0]?.searches || 1} color={COLORS.green} />
          ))}
        </Panel>
        <Panel title="FEATURE USAGE">
          {data.feature_usage.map((f, i) => (
            <BarRow key={i} label={f.feature_name} value={f.uses}
              max={data.feature_usage[0]?.uses || 1} color={COLORS.purple}
              sublabel={`${f.unique_users} users`} />
          ))}
        </Panel>
        <Panel title="ACTIVE USERS BY TIER">
          {data.by_tier.map((t, i) => (
            <BarRow key={i} label={t.subscription_tier} value={t.active_users}
              max={data.by_tier[0]?.active_users || 1}
              color={TIER_COLORS[t.subscription_tier] || COLORS.muted} />
          ))}
        </Panel>
        <Panel title="TRAFFIC BY COUNTRY">
          {data.by_country.map((c, i) => (
            <BarRow key={i} label={c.country} value={c.sessions}
              max={data.by_country[0]?.sessions || 1} color="#06b6d4" />
          ))}
        </Panel>
      </div>

      {/* Daily trend */}
      <Panel title={`DAILY SESSIONS — LAST ${days} DAYS`}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80, paddingTop: 8 }}>
          {data.daily_trend.map((d, i) => (
            <div key={i} title={`${d.date}: ${d.sessions}`}
              style={{ flex: 1, display: "flex", flexDirection: "column" as const,
                alignItems: "center", justifyContent: "flex-end" }}>
              <div style={{
                width: "100%", borderRadius: "2px 2px 0 0",
                background: COLORS.green, opacity: 0.8,
                height: `${Math.max(3, (d.sessions / maxTrend) * 72)}px`,
                minHeight: 3,
              }} />
              {i % 7 === 0 && (
                <span style={{ fontSize: 9, color: COLORS.muted, marginTop: 2 }}>
                  {d.date.slice(5)}
                </span>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#1a1a1a", borderRadius: 8, padding: "14px 16px",
      border: "1px solid #2a2a2a" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", letterSpacing: "1px",
        textTransform: "uppercase" as const, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>{children}</div>
    </div>
  );
}

function BarRow({ label, value, max, color, sublabel }: {
  label: string; value: number; max: number; color: string; sublabel?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 120, display: "flex", flexDirection: "column" as const }}>
        <span style={{ fontSize: 11, color: "#cbd5e1", whiteSpace: "nowrap" as const,
          overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
        {sublabel && <span style={{ fontSize: 10, color: "#475569" }}>{sublabel}</span>}
      </div>
      <div style={{ flex: 1, height: 5, background: "#334155", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color,
          borderRadius: 3, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ width: 40, textAlign: "right" as const, fontSize: 11,
        color: "#94a3b8" }}>{value.toLocaleString()}</span>
    </div>
  );
}
