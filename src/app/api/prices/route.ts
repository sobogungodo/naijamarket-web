import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const data = await prisma.approved_Prices.findMany({
      take: Math.min(limit, 100),
    });

    return NextResponse.json({
      success: true,
      data,
      meta: {
        count: data.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Prices API Error:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch prices",
        },
      },
      { status: 500 }
    );
  }
}