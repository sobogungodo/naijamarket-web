'use client'
import { useEffect, useState, CSSProperties } from 'react'

interface Data {
  trader:      { total:number;new7d:number;new30d:number;active7d:number;subs24h:number;subs7d:number;subs30d:number;subsAll:number;d1Rate:number;d7Rate:number;cohortSize:number }
  consumer:    { total:number;active7d:number;queries7d:number;d1Rate:number;cohortSize:number }
  feedback30d: number
  generatedAt: string
}

function Kpi({ label, value, sub, color='#00a651' }: { label:string;value:string|number;sub?:string;color?:string }) {
  return (
    <div style={{ background:'#111',border:'1px solid #222',borderRadius:12,padding:'20px 24px' }}>
      <div style={{ color:'#555',fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:8 }}>{label}</div>
      <div style={{ color,fontSize:28,fontWeight:700,fontFamily:'monospace' }}>{value}</div>
      {sub && <div style={{ color:'#444',fontSize:12,marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function Bar({ rate, label }: { rate:number;label:string }) {
  const c = rate>=50?'#00a651':rate>=25?'#f59e0b':'#ef4444'
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
        <span style={{ color:'#888',fontSize:13 }}>{label}</span>
        <span style={{ color:c,fontWeight:700,fontSize:14,fontFamily:'monospace' }}>{rate}%</span>
      </div>
      <div style={{ background:'#1a1a1a',borderRadius:4,height:8,overflow:'hidden' }}>
        <div style={{ background:c,width:`${Math.min(rate,100)}%`,height:8,borderRadius:4,transition:'width 0.6s ease' }} />
      </div>
    </div>
  )
}

export default function RetentionPage() {
  const [data, setData]     = useState<Data|null>(null)
  const [loading, setLoad]  = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    fetch('/api/retention')
      .then(r => { if (!r.ok) throw new Error('API error'); return r.json() })
      .then(d => { setData(d); setLoad(false) })
      .catch(() => { setError('Failed to load data. Check API logs.'); setLoad(false) })
  }, [])

  const s: CSSProperties = {
    fontFamily:'sans-serif',background:'#0a0a0a',
    minHeight:'100vh',padding:32,color:'#fff'
  }

  if (loading) return <div style={s}><p style={{ color:'#555',marginTop:40,textAlign:'center' }}>Loading retention data...</p></div>
  if (error||!data) return <div style={s}><p style={{ color:'#ef4444' }}>{error||'No data'}</p></div>

  const t = data.trader   || { total:0,new7d:0,new30d:0,active7d:0,subs24h:0,subs7d:0,subs30d:0,subsAll:0,d1Rate:0,d7Rate:0,cohortSize:0 }
  const c = data.consumer || { total:0,active7d:0,queries7d:0,d1Rate:0,cohortSize:0 }

  return (
    <div style={s}>
      <div style={{ marginBottom:32,borderBottom:'1px solid #1a1a1a',paddingBottom:24 }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-end' }}>
          <div>
            <h1 style={{ fontSize:22,fontWeight:700,margin:'0 0 4px' }}>Retention Metrics</h1>
            <p style={{ color:'#444',fontSize:13,margin:0 }}>
              "Are people coming back after day one?"
            </p>
          </div>
          <span style={{ color:'#333',fontSize:11,fontFamily:'monospace' }}>
            {new Date(data.generatedAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Trader */}
      <div style={{ marginBottom:12 }}>
        <span style={{ color:'#00a651',fontSize:11,textTransform:'uppercase',letterSpacing:2,fontWeight:600 }}>
          📦 Trader Activity
        </span>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:28 }}>
        <Kpi label="Approved"      value={t.total}    sub="total traders" />
        <Kpi label="New (7d)"      value={t.new7d}    sub="recently joined"  color="#60a5fa" />
        <Kpi label="Active (7d)"   value={t.active7d} sub="submitted prices" color="#a78bfa" />
        <Kpi label="Subs (24h)"    value={t.subs24h}  sub="today"            color="#f59e0b" />
        <Kpi label="Subs (7d)"     value={t.subs7d}   sub="this week"        color="#f59e0b" />
        <Kpi label="Subs (all)"    value={t.subs90d}  sub="all time"         color="#555" />
      </div>

      <div style={{ background:'#111',border:'1px solid #1e1e1e',borderRadius:12,padding:24,marginBottom:32 }}>
        <div style={{ marginBottom:20 }}>
          <span style={{ color:'#888',fontSize:13 }}>
            Cohort: <strong style={{ color:'#fff' }}>{t.cohortSize}</strong> traders with ≥7 days history
          </span>
        </div>
        <Bar rate={t.d1Rate} label="D1 — submitted the day after their first submission" />
        <Bar rate={t.d7Rate} label="D7 — submitted within first 7 days of joining" />
        <p style={{ color:'#333',fontSize:12,margin:'16px 0 0' }}>
          Target: D1 ≥ 40% · D7 ≥ 25% — below target triggers auto re-engage templates
        </p>
      </div>

      {/* Consumer */}
      <div style={{ marginBottom:12 }}>
        <span style={{ color:'#60a5fa',fontSize:11,textTransform:'uppercase',letterSpacing:2,fontWeight:600 }}>
          🛒 Consumer Activity
        </span>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:28 }}>
        <Kpi label="Total"         value={c.total}      sub="active accounts"  color="#60a5fa" />
        <Kpi label="Active (7d)"   value={c.active7d}   sub="price queries"    color="#a78bfa" />
        <Kpi label="Queries (7d)"  value={c.queries7d}  sub="total lookups"    color="#f59e0b" />
        <Kpi label="Feedback (30d)"value={data.feedback30d} sub="messages"     color="#555" />
      </div>

      <div style={{ background:'#111',border:'1px solid #1e1e1e',borderRadius:12,padding:24,marginBottom:32 }}>
        <div style={{ marginBottom:20 }}>
          <span style={{ color:'#888',fontSize:13 }}>
            Cohort: <strong style={{ color:'#fff' }}>{c.cohortSize}</strong> consumers with ≥2 days history
          </span>
        </div>
        <Bar rate={c.d1Rate} label="D1 — queried again within 48h of first query" />
        <p style={{ color:'#333',fontSize:12,margin:'16px 0 0' }}>
          Target: D1 ≥ 30% — below target triggers day-2 Brevo re-engage email
        </p>
      </div>
    </div>
  )
}
