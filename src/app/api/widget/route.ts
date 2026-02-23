// ============================================================================
// src/app/api/widget/route.ts
// NaijaMarket Intel - White-Label Embeddable Price Widget
// Version: 1.0.0 | Date: 2026-02-23
//
// HOW IT WORKS:
// 1. Client site adds: <script src="https://naijamarketintel.com/api/widget?key=xxx"></script>
// 2. This endpoint validates the key, checks domain, returns self-executing JS
// 3. The JS renders a price ticker/table into a <div id="naijamarket-widget">
// 4. Widget auto-refreshes every 5 minutes
//
// PRICING: ₦200,000/month per domain
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ============================================================================
// GET — Serve widget JS or widget data
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") || "";
  const mode = searchParams.get("mode") || "embed"; // "embed" = JS, "data" = JSON
  const theme = searchParams.get("theme") || "dark";
  const items = searchParams.get("items") || ""; // comma-separated
  const market = searchParams.get("market") || "";
  const layout = searchParams.get("layout") || "ticker"; // ticker, table, card
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 25);

  // Validate widget key
  if (!key) {
    return mode === "data"
      ? NextResponse.json({ error: "Missing widget key" }, { status: 401 })
      : new NextResponse("console.error('NaijaMarket Widget: Missing API key');", {
          headers: { "Content-Type": "application/javascript" },
        });
  }

  try {
    // Check widget key
    const widgetKey = await prisma.$queryRaw<any[]>`
      SELECT wk.*, 
             DATEDIFF(day, wk.created_at, GETDATE()) as age_days
      FROM Widget_Keys wk
      WHERE wk.widget_key = ${key}
        AND wk.status = 'ACTIVE'
        AND (wk.expires_at IS NULL OR wk.expires_at > GETDATE())
    `;

    if (!widgetKey || widgetKey.length === 0) {
      return mode === "data"
        ? NextResponse.json({ error: "Invalid or expired widget key" }, { status: 403 })
        : new NextResponse("console.error('NaijaMarket Widget: Invalid key');", {
            headers: { "Content-Type": "application/javascript" },
          });
    }

    const wk = widgetKey[0];

    // Domain check (optional — if allowed_domains is set)
    const origin = request.headers.get("origin") || request.headers.get("referer") || "";
    if (wk.allowed_domains) {
      const domains = String(wk.allowed_domains).split(",").map((d: string) => d.trim().toLowerCase());
      const requestDomain = new URL(origin || "http://localhost").hostname.toLowerCase();
      if (domains.length > 0 && domains[0] !== "*" && !domains.some((d: string) => requestDomain.includes(d))) {
        return mode === "data"
          ? NextResponse.json({ error: "Domain not authorized" }, { status: 403 })
          : new NextResponse("console.error('NaijaMarket Widget: Domain not authorized');", {
              headers: { "Content-Type": "application/javascript" },
            });
      }
    }

    // Log usage
    await prisma.$executeRaw`
      UPDATE Widget_Keys 
      SET total_loads = total_loads + 1, last_loaded_at = GETDATE()
      WHERE widget_key = ${key}
    `;

    // Fetch price data
    const priceData = await fetchWidgetPrices(items, market, limit);

    // Return JSON data
    if (mode === "data") {
      return NextResponse.json({
        success: true,
        source: "NaijaMarket Intel",
        updated: new Date().toISOString(),
        prices: priceData,
      }, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300", // 5 min cache
        },
      });
    }

    // Return embeddable JS
    const widgetJS = generateWidgetJS(key, theme, layout, priceData);
    return new NextResponse(widgetJS, {
      headers: {
        "Content-Type": "application/javascript",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error: any) {
    console.error("[Widget] Error:", error);
    return mode === "data"
      ? NextResponse.json({ error: "Internal error" }, { status: 500 })
      : new NextResponse("console.error('NaijaMarket Widget: Service unavailable');", {
          headers: { "Content-Type": "application/javascript" },
        });
  }
}

// ============================================================================
// FETCH PRICES
// ============================================================================

async function fetchWidgetPrices(items: string, market: string, limit: number) {
  let whereClause = "WHERE 1=1";
  if (items) {
    const itemList = items.split(",").map(i => i.trim()).filter(Boolean);
    if (itemList.length > 0) {
      const placeholders = itemList.map(i => `'${i.replace(/'/g, "''")}'`).join(",");
      whereClause += ` AND lps.item_name IN (${placeholders})`;
    }
  }
  if (market) {
    whereClause += ` AND lps.market_name LIKE '%${market.replace(/'/g, "''")}%'`;
  }

  const prices = await prisma.$queryRawUnsafe<any[]>(`
    SELECT TOP ${limit}
      lps.item_name,
      lps.market_name,
      lps.state,
      lps.latest_price,
      lps.price_change_pct,
      lps.price_date,
      lps.unit
    FROM Latest_Prices_Summary lps
    ${whereClause}
    ORDER BY lps.item_name, lps.market_name
  `);

  return prices.map(p => ({
    item: p.item_name,
    market: p.market_name,
    state: p.state,
    price: Number(p.latest_price || 0),
    change: Number(p.price_change_pct || 0),
    unit: p.unit || "per unit",
    date: p.price_date,
  }));
}

// ============================================================================
// GENERATE WIDGET JS
// ============================================================================

function generateWidgetJS(key: string, theme: string, layout: string, prices: any[]) {
  const isDark = theme === "dark";
  const bg = isDark ? "#0a0a0a" : "#ffffff";
  const text = isDark ? "#e0e0e0" : "#1a1a1a";
  const muted = isDark ? "#666" : "#999";
  const border = isDark ? "#1e1e1e" : "#e5e5e5";
  const green = "#00c853";
  const red = "#ff1744";
  const accent = "#00a36c";
  const dataJSON = JSON.stringify(prices);
  const baseURL = "https://www.naijamarketintel.com";

  if (layout === "ticker") {
    return `
(function(){
  var d=${dataJSON};
  var c=document.getElementById("naijamarket-widget");
  if(!c){c=document.createElement("div");c.id="naijamarket-widget";document.body.appendChild(c);}
  var h='<div style="background:${bg};border:1px solid ${border};border-radius:8px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">';
  h+='<div style="background:${accent};padding:6px 12px;display:flex;justify-content:space-between;align-items:center;">';
  h+='<span style="color:white;font-weight:700;font-size:11px;">🇳🇬 NaijaMarket Intel</span>';
  h+='<span style="color:rgba(255,255,255,0.7);font-size:9px;">LIVE</span></div>';
  h+='<div style="overflow:hidden;position:relative;height:32px;">';
  h+='<div style="display:flex;gap:24px;animation:nmScroll '+Math.max(d.length*4,20)+'s linear infinite;white-space:nowrap;padding:7px 0;">';
  d.forEach(function(p){
    var col=p.change>=0?"${green}":"${red}";
    var arrow=p.change>=0?"▲":"▼";
    h+='<span style="color:${text};font-size:12px;font-weight:500;">'+p.item+'</span>';
    h+='<span style="color:${muted};font-size:11px;margin:0 4px;">'+p.market+'</span>';
    h+='<span style="color:${text};font-size:12px;font-weight:700;">₦'+p.price.toLocaleString()+'</span>';
    h+='<span style="color:'+col+';font-size:11px;margin-right:16px;">'+arrow+Math.abs(p.change).toFixed(1)+'%</span>';
  });
  h+='</div></div>';
  h+='<div style="text-align:right;padding:2px 8px 4px;"><a href="${baseURL}?ref=widget" target="_blank" style="color:${muted};font-size:9px;text-decoration:none;">Powered by NaijaMarket Intel</a></div>';
  h+='</div>';
  h+='<style>@keyframes nmScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}</style>';
  c.innerHTML=h;
  setTimeout(function(){var s=document.createElement("script");s.src="${baseURL}/api/widget?key=${key}&mode=embed&layout=ticker&theme=${theme}&_t="+Date.now();document.body.appendChild(s);},300000);
})();`;
  }

  if (layout === "card") {
    return `
(function(){
  var d=${dataJSON};
  var c=document.getElementById("naijamarket-widget");
  if(!c){c=document.createElement("div");c.id="naijamarket-widget";document.body.appendChild(c);}
  var h='<div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:16px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  h+='<span style="color:${accent};font-weight:700;font-size:13px;">🇳🇬 NaijaMarket Intel</span>';
  h+='<span style="color:${muted};font-size:10px;">Updated: '+new Date().toLocaleTimeString("en-NG",{hour:"2-digit",minute:"2-digit"})+'</span></div>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;">';
  d.slice(0,8).forEach(function(p){
    var col=p.change>=0?"${green}":"${red}";
    var arrow=p.change>=0?"▲":"▼";
    h+='<div style="background:${isDark ? "#141414" : "#f8f8f8"};border:1px solid ${border};border-radius:8px;padding:10px;">';
    h+='<div style="color:${muted};font-size:10px;margin-bottom:2px;">'+p.item+'</div>';
    h+='<div style="color:${text};font-size:16px;font-weight:700;">₦'+p.price.toLocaleString()+'</div>';
    h+='<div style="color:'+col+';font-size:11px;">'+arrow+' '+Math.abs(p.change).toFixed(1)+'%</div>';
    h+='<div style="color:${muted};font-size:9px;margin-top:2px;">'+p.market+'</div>';
    h+='</div>';
  });
  h+='</div>';
  h+='<div style="text-align:center;margin-top:8px;"><a href="${baseURL}?ref=widget" target="_blank" style="color:${accent};font-size:10px;text-decoration:none;">View all prices on NaijaMarket Intel →</a></div>';
  h+='</div>';
  c.innerHTML=h;
  setTimeout(function(){var s=document.createElement("script");s.src="${baseURL}/api/widget?key=${key}&mode=embed&layout=card&theme=${theme}&_t="+Date.now();document.body.appendChild(s);},300000);
})();`;
  }

  // Default: table layout
  return `
(function(){
  var d=${dataJSON};
  var c=document.getElementById("naijamarket-widget");
  if(!c){c=document.createElement("div");c.id="naijamarket-widget";document.body.appendChild(c);}
  var h='<div style="background:${bg};border:1px solid ${border};border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">';
  h+='<div style="background:${accent};padding:10px 16px;display:flex;justify-content:space-between;align-items:center;">';
  h+='<span style="color:white;font-weight:700;font-size:14px;">🇳🇬 Nigerian Commodity Prices</span>';
  h+='<span style="color:rgba(255,255,255,0.7);font-size:10px;">by NaijaMarket Intel</span></div>';
  h+='<table style="width:100%;border-collapse:collapse;">';
  h+='<thead><tr style="background:${isDark ? "#111" : "#f5f5f5"};"><th style="text-align:left;padding:8px 12px;color:${muted};font-size:10px;font-weight:600;text-transform:uppercase;">Item</th><th style="text-align:left;padding:8px 8px;color:${muted};font-size:10px;font-weight:600;">Market</th><th style="text-align:right;padding:8px 8px;color:${muted};font-size:10px;font-weight:600;">Price (₦)</th><th style="text-align:right;padding:8px 12px;color:${muted};font-size:10px;font-weight:600;">Change</th></tr></thead>';
  h+='<tbody>';
  d.forEach(function(p,i){
    var col=p.change>=0?"${green}":"${red}";
    var arrow=p.change>=0?"▲":"▼";
    var bg2=i%2===0?"transparent":"${isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"}";
    h+='<tr style="background:'+bg2+';border-bottom:1px solid ${border};">';
    h+='<td style="padding:8px 12px;color:${text};font-size:12px;font-weight:600;">'+p.item+'</td>';
    h+='<td style="padding:8px 8px;color:${muted};font-size:11px;">'+p.market+'</td>';
    h+='<td style="padding:8px 8px;color:${text};font-size:13px;font-weight:700;text-align:right;">₦'+p.price.toLocaleString()+'</td>';
    h+='<td style="padding:8px 12px;text-align:right;color:'+col+';font-size:11px;font-weight:600;">'+arrow+' '+Math.abs(p.change).toFixed(1)+'%</td>';
    h+='</tr>';
  });
  h+='</tbody></table>';
  h+='<div style="text-align:center;padding:8px;"><a href="${baseURL}?ref=widget" target="_blank" style="color:${accent};font-size:10px;text-decoration:none;">Explore all markets on NaijaMarket Intel →</a></div>';
  h+='</div>';
  c.innerHTML=h;
  setTimeout(function(){var s=document.createElement("script");s.src="${baseURL}/api/widget?key=${key}&mode=embed&layout=table&theme=${theme}&_t="+Date.now();document.body.appendChild(s);},300000);
})();`;
}
