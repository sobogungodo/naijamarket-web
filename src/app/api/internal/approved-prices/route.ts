// src/app/api/internal/approved-prices/route.ts
// Serves Approved_Prices from Azure SQL for Google Sheets sync
// Called by Apps Script to update Validated_Prices sheet

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Verify internal API key
    const apiKey = request.headers.get("x-internal-api-key");
    const expectedKey = process.env.INTERNAL_SYNC_API_KEY;

    if (!apiKey || apiKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Query Approved_Prices - get latest price per item+market combo
    const prices = await prisma.$queryRaw`
      SELECT 
        price_id,
        submission_id,
        state,
        market_name,
        market_id,
        category_name,
        category_id,
        item_name,
        item_id,
        brand_name,
        brand_id,
        price,
        unit,
        currency,
        submission_date,
        validated_at,
        validation_status,
        validators_count,
        approval_count,
        reject_count,
        consensus_method,
        trader_phone,
        trader_id,
        trader_name,
        previous_price,
        price_change_amount,
        price_change_percent,
        price_trend,
        data_source,
        confidence_score,
        is_outlier,
        notes
      FROM dbo.Approved_Prices
      WHERE validation_status = 'APPROVED'
      ORDER BY item_name, market_name, validated_at DESC
    `;

    // Convert to plain objects (handle BigInt/Decimal serialization)
    const serialized = (prices as any[]).map((row: any) => {
      const obj: any = {};
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === "bigint") {
          obj[key] = Number(value);
        } else if (value instanceof Date) {
          obj[key] = value.toISOString();
        } else {
          obj[key] = value;
        }
      }
      return obj;
    });

    return NextResponse.json({
      success: true,
      count: serialized.length,
      prices: serialized,
      synced_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Approved prices fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch prices", details: error.message },
      { status: 500 }
    );
  }
}
