// src/app/api/prices/ticker/route.ts
// Returns live price ticker data for the landing page
// Falls back gracefully — landing page always shows something

import { NextResponse } from "next/server";
import sql from "mssql";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const dbConfig: sql.config = {
  server: process.env.AZURE_SQL_SERVER || "naijafood.database.windows.net",
  database: process.env.AZURE_SQL_DATABASE || "naijafoodmarket-live",
  user: process.env.AZURE_SQL_USER || "igiiwe",
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 8000,
    requestTimeout: 8000,
  },
};

// Static fallback — always shown if DB is unavailable
const FALLBACK = [
  { s: "RICE.NGN",    p: "₦82,450",  c: "+0.34%", u: true  },
  { s: "BEANS.NGN",   p: "₦61,920",  c: "+0.12%", u: true  },
  { s: "GARRI.NGN",   p: "₦24,300",  c: "-0.45%", u: false },
  { s: "PALM.NGN",    p: "₦48,100",  c: "+0.28%", u: true  },
  { s: "YAM.NGN",     p: "₦2,850",   c: "-0.18%", u: false },
  { s: "TOMATO.NGN",  p: "₦42,500",  c: "+1.26%", u: true  },
  { s: "ONION.NGN",   p: "₦35,200",  c: "-0.52%", u: false },
  { s: "PEPPER.NGN",  p: "₦30,800",  c: "+0.67%", u: true  },
  { s: "FISH.NGN",    p: "₦11,650",  c: "+0.19%", u: true  },
  { s: "PLANTAIN.NGN",p: "₦4,250",   c: "+0.84%", u: true  },
  { s: "GNUT.NGN",    p: "₦55,300",  c: "+0.41%", u: true  },
  { s: "EGGS.NGN",    p: "₦3,180",   c: "-0.31%", u: false },
];

export async function GET() {
  let pool: sql.ConnectionPool | null = null;
  try {
    pool = await sql.connect(dbConfig);

    const result = await pool.request().query(`
      SELECT TOP 12
        UPPER(REPLACE(item_name, ' ', '.')) + '.NGN' AS s,
        '₦' + FORMAT(price_naira, 'N0') AS p,
        CASE
          WHEN price_change_pct > 0 THEN '+' + CAST(ROUND(price_change_pct, 2) AS VARCHAR) + '%'
          WHEN price_change_pct < 0 THEN CAST(ROUND(price_change_pct, 2) AS VARCHAR) + '%'
          ELSE '0.00%'
        END AS c,
        CASE WHEN price_change_pct >= 0 THEN 1 ELSE 0 END AS u
      FROM dbo.Latest_Prices_Summary
      WHERE is_nbs_ref = 0
        AND is_food = 1
        AND price_naira > 0
        AND state = 'Lagos'
      ORDER BY NEWID()
    `);

    if (!result.recordset || result.recordset.length === 0) {
      return NextResponse.json(FALLBACK, {
        headers: { "Cache-Control": "public, max-age=300" },
      });
    }

    const ticks = result.recordset.map((r: {s: string, p: string, c: string, u: number}) => ({
      s: r.s.substring(0, 12),  // truncate long names
      p: r.p,
      c: r.c,
      u: r.u === 1,
    }));

    return NextResponse.json(ticks, {
      headers: { "Cache-Control": "public, max-age=300" }, // cache 5 min
    });

  } catch (err) {
    console.error("[ticker]", err);
    return NextResponse.json(FALLBACK, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
}
