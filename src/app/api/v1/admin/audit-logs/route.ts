import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryAuditLogs, AuditEventType } from "@/server/services/audit.service";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

interface AuditLogQueryResponse {
  logs: Array<{
    id: string;
    eventType: AuditEventType;
    userId: string | null;
    giftId: string | null;
    amountNgn: number | null;
    amountUsdc: string | null;
    timestamp: Date;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: Record<string, unknown> | null;
  }>;
  total: number;
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // TODO: Add admin role check once role-based access is implemented
  // For now, only authenticated users can access
  // const user = session.user as { id: string; role?: string };
  // if (user.role !== "admin") {
  //   return NextResponse.json<ApiResponse<never>>(
  //     { success: false, error: "Forbidden" },
  //     { status: 403 }
  //   );
  // }

  const searchParams = req.nextUrl.searchParams;
  const userId = searchParams.get("userId") ?? undefined;
  const giftId = searchParams.get("giftId") ?? undefined;
  const eventType = searchParams.get("eventType") as AuditEventType | null;
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");
  const limitStr = searchParams.get("limit");
  const offsetStr = searchParams.get("offset");

  const startDate = startDateStr ? new Date(startDateStr) : undefined;
  const endDate = endDateStr ? new Date(endDateStr) : undefined;
  const limit = limitStr ? parseInt(limitStr, 10) : 50;
  const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

  // Validate date parsing
  if (startDateStr && isNaN(startDate!.getTime())) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid startDate format" },
      { status: 400 }
    );
  }

  if (endDateStr && isNaN(endDate!.getTime())) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid endDate format" },
      { status: 400 }
    );
  }

  const result = await queryAuditLogs({
    userId,
    giftId,
    eventType: eventType ?? undefined,
    startDate,
    endDate,
    limit,
    offset,
  });

  return NextResponse.json<ApiResponse<AuditLogQueryResponse>>({
    success: true,
    data: result,
  });
});
