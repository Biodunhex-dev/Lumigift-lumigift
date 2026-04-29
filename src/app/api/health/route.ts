import { NextResponse } from "next/server";
import { serverConfig } from "@/server/config";

/**
 * Health check endpoint for Docker, load balancers, and uptime monitors.
 * GET /api/health
 *
 * Returns 200 when the app is running. Optionally checks Stellar Horizon
 * connectivity when the `?deep=1` query param is present.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const deep = searchParams.get("deep") === "1";

  const base = {
    status: "ok" as "ok" | "degraded",
    timestamp: new Date().toISOString(),
    service: "lumigift",
  };

  if (!deep) {
    return NextResponse.json(base, { status: 200 });
  }

  // Deep check: verify Stellar Horizon is reachable
  const horizonStatus = await checkHorizon(serverConfig.stellar.horizonUrl);

  const status = horizonStatus === "ok" ? "ok" : "degraded";
  const httpStatus = status === "ok" ? 200 : 503;

  return NextResponse.json(
    {
      ...base,
      status,
      checks: {
        horizon: horizonStatus,
      },
    },
    { status: httpStatus }
  );
}

async function checkHorizon(url: string): Promise<"ok" | "error"> {
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}
