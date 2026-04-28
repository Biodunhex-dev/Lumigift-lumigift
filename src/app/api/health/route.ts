import { NextResponse } from "next/server";

/**
 * Health check endpoint for Docker and monitoring systems
 * GET /api/health
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "lumigift",
    },
    { status: 200 }
  );
}
