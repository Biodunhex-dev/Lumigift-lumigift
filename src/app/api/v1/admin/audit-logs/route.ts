import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryAuditLogs, AuditEventType } from "@/server/services/audit.service";
import { withErrorHandler, validateRequest, searchParamsToObject } from "@/server/middleware";
import { auditLogsQuerySchema } from "@/lib/schemas";
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

  // ── Validate query params ────────────────────────────────────────────────
  const validation = validateRequest(
    auditLogsQuerySchema,
    searchParamsToObject(req.nextUrl.searchParams)
  );
  if (!validation.success) return validation.errorResponse;

  const { userId, giftId, eventType, startDate, endDate, limit, offset } = validation.data;

  const result = await queryAuditLogs({
    userId,
    giftId,
    eventType: eventType as AuditEventType | undefined,
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
