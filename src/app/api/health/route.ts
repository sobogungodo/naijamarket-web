import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db";

// ============================================================================
// GET /api/health
// Health check endpoint for container orchestration
// ============================================================================

export async function GET() {
  const startTime = Date.now();

  try {
    // Check database connection
    const dbHealth = await checkDatabaseHealth();

    const response = {
      status: dbHealth.connected ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
      checks: {
        database: {
          status: dbHealth.connected ? "up" : "down",
          latency_ms: dbHealth.latency,
          error: dbHealth.error,
        },
        memory: {
          status: "up",
          usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          limit_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      },
      response_time_ms: Date.now() - startTime,
    };

    const statusCode = dbHealth.connected ? 200 : 503;

    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        response_time_ms: Date.now() - startTime,
      },
      { status: 503 }
    );
  }
}

// ============================================================================
// HEAD /api/health
// Lightweight health check (no body)
// ============================================================================

export async function HEAD() {
  try {
    const dbHealth = await checkDatabaseHealth();
    return new NextResponse(null, {
      status: dbHealth.connected ? 200 : 503,
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
