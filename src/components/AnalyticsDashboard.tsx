// src/components/AnalyticsDashboard.tsx
// NaijaMarket Intel — Admin analytics widget
// Drop into admin dashboard page

"use client";

import { useState, useEffect } from "react";

interface AnalyticsSummary {
  period_days:   number;
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

const TIER_COLORS: Record<string, string> = {
  FREE: "#6b7280", SILVER: "#9ca3af", GOLD: "#f59e0b",
  BUSINESS: "#3b82f6", CORPORATE: "#8b5cf6", ENTERPRISE: "#ec4899",
};

export default function AnalyticsDashboard() {
  const [data, setData]     = useState<AnalyticsSummary | null>(null);
  const [days, setDays]     = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics/summary?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load analytics"); setLoading(false); });
  }, [days]);

  if (loading) return <div style={styles.loading}>Loading analytics...</div>;
  if (error)   return <div style={styles.error}>{error}</div>;
  if (!data)   return null;

  const { site_overview: s } = data;
  const mobileShare = s.unique_sessions > 0
    ? Math.round((s.mobile_sessions / (s.mobile_sessions + s.desktop_sessions)) * 100)
    : 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>Platform Analytics</h2>
        <div style={styles.periodSelector}>
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{ ...styles.periodBtn, ...(days === d ? styles.periodBtnActive : {}) }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={styles.kpiGrid}>
        <KPICard label="Unique Sessions"   value={s.unique_sessions.toLocaleString()} color="#22c55e" />
        <KPICard label="Page Views"        value={s.page_views.toLocaleString()}      color="#3b82f6" />
        <KPICard label="CTA Clicks"        value={s.cta_clicks.toLocaleString()}      color="#f59e0b" />
        <KPICard label="Mobile Share"      value={`${mobileShare}%`}                  color="#8b5cf6" />
      </div>

      {/* Two-column grid */}
      <div style={styles.grid2}>

        {/* Top Pages */}
        <Section title="Top Pages">
          {data.top_pages.map((p, i) => (
            <BarRow key={i} label={p.page_path || "/"} value={p.views}
              max={data.top_pages[0]?.views || 1} color="#3b82f6" />
          ))}
        </Section>

        {/* Top CTAs */}
        <Section title="Top CTAs Clicked">
          {data.top_ctas.map((c, i) => (
            <BarRow key={i} label={c.button_id} value={c.clicks}
              max={data.top_ctas[0]?.clicks || 1} color="#f59e0b" />
          ))}
        </Section>

        {/* Top Searches */}
        <Section title="Top Searched Commodities">
          {data.top_searches.map((s, i) => (
            <BarRow key={i} label={s.item_name} value={s.searches}
              max={data.top_searches[0]?.searches || 1} color="#22c55e" />
          ))}
        </Section>

        {/* Feature Usage */}
        <Section title="Feature Usage">
          {data.feature_usage.map((f, i) => (
            <BarRow key={i}
              label={f.feature_name}
              value={f.uses}
              max={data.feature_usage[0]?.uses || 1}
              color="#8b5cf6"
              sublabel={`${f.unique_users} users`}
            />
          ))}
        </Section>

        {/* Active Users by Tier */}
        <Section title="Active Users by Tier">
          {data.by_tier.map((t, i) => (
            <BarRow key={i}
              label={t.subscription_tier}
              value={t.active_users}
              max={data.by_tier[0]?.active_users || 1}
              color={TIER_COLORS[t.subscription_tier] || "#6b7280"}
            />
          ))}
        </Section>

        {/* Traffic by Country */}
        <Section title="Traffic by Country">
          {data.by_country.map((c, i) => (
            <BarRow key={i} label={c.country} value={c.sessions}
              max={data.by_country[0]?.sessions || 1} color="#06b6d4" />
          ))}
        </Section>

      </div>

      {/* Daily Trend */}
      <Section title={`Daily Sessions — Last ${days} Days`}>
        <MiniChart data={data.daily_trend} />
      </Section>
    </div>
  );
}

function KPICard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ ...styles.kpiCard, borderTop: `3px solid ${color}` }}>
      <div style={{ ...styles.kpiValue, color }}>{value}</div>
      <div style={styles.kpiLabel}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      <div style={styles.sectionBody}>{children}</div>
    </div>
  );
}

function BarRow({ label, value, max, color, sublabel }: {
  label: string; value: number; max: number; color: string; sublabel?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={styles.barRow}>
      <div style={styles.barLabel}>
        <span style={styles.barLabelText}>{label}</span>
        {sublabel && <span style={styles.barSublabel}>{sublabel}</span>}
      </div>
      <div style={styles.barTrack}>
        <div style={{ ...styles.barFill, width: `${pct}%`, background: color }} />
      </div>
      <span style={styles.barValue}>{value.toLocaleString()}</span>
    </div>
  );
}

function MiniChart({ data }: { data: { date: string; sessions: number }[] }) {
  if (!data.length) return <div style={styles.empty}>No data yet</div>;
  const max = Math.max(...data.map(d => d.sessions), 1);
  return (
    <div style={styles.chartWrap}>
      {data.map((d, i) => (
        <div key={i} style={styles.chartCol} title={`${d.date}: ${d.sessions} sessions`}>
          <div style={{
            ...styles.chartBar,
            height: `${Math.max(4, (d.sessions / max) * 80)}px`,
            background: "#22c55e",
          }} />
          {i % 7 === 0 && (
            <span style={styles.chartLabel}>{d.date.slice(5)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container:      { padding: "1.5rem", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0" },
  header:         { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" },
  title:          { fontSize: "1.25rem", fontWeight: 700, color: "#f1f5f9", margin: 0 },
  periodSelector: { display: "flex", gap: "0.4rem" },
  periodBtn:      { padding: "0.3rem 0.75rem", borderRadius: "6px", border: "1px solid #334155",
                    background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: "0.8rem" },
  periodBtnActive:{ background: "#22c55e", color: "#fff", borderColor: "#22c55e" },
  kpiGrid:        { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem", marginBottom: "1.5rem" },
  kpiCard:        { background: "#1e293b", borderRadius: "8px", padding: "1rem 1.25rem" },
  kpiValue:       { fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2 },
  kpiLabel:       { fontSize: "0.78rem", color: "#64748b", marginTop: "0.25rem" },
  grid2:          { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" },
  section:        { background: "#1e293b", borderRadius: "8px", padding: "1rem 1.25rem", marginBottom: "1rem" },
  sectionTitle:   { fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.75rem",
                    textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.75rem 0" },
  sectionBody:    { display: "flex", flexDirection: "column", gap: "0.5rem" },
  barRow:         { display: "flex", alignItems: "center", gap: "0.5rem" },
  barLabel:       { width: "130px", display: "flex", flexDirection: "column" },
  barLabelText:   { fontSize: "0.78rem", color: "#cbd5e1", whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis" },
  barSublabel:    { fontSize: "0.68rem", color: "#475569" },
  barTrack:       { flex: 1, height: "6px", background: "#334155", borderRadius: "3px", overflow: "hidden" },
  barFill:        { height: "100%", borderRadius: "3px", transition: "width 0.4s ease" },
  barValue:       { width: "45px", textAlign: "right", fontSize: "0.78rem", color: "#94a3b8" },
  chartWrap:      { display: "flex", alignItems: "flex-end", gap: "2px", height: "100px", paddingTop: "1rem" },
  chartCol:       { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" },
  chartBar:       { width: "100%", borderRadius: "2px 2px 0 0", minHeight: "4px" },
  chartLabel:     { fontSize: "0.6rem", color: "#475569", marginTop: "2px" },
  loading:        { padding: "2rem", textAlign: "center", color: "#64748b" },
  error:          { padding: "2rem", textAlign: "center", color: "#ef4444" },
  empty:          { padding: "1rem", textAlign: "center", color: "#64748b", fontSize: "0.85rem" },
};
