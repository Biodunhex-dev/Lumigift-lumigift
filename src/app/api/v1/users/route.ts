import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { withErrorHandler, validateRequest, searchParamsToObject } from "@/server/middleware";
import { userExistsQuerySchema } from "@/lib/schemas";
import type { ApiResponse } from "@/types";

export const GET = withErrorHandler(async (req: NextRequest) => {
  // ── Validate query params ────────────────────────────────────────────────
  const validation = validateRequest(
    userExistsQuerySchema,
    searchParamsToObject(new URL(req.url).searchParams)
  );
  if (!validation.success) return validation.errorResponse;

  // Normalize after schema validation (schema ensures phone is non-empty)
  const phone = normalizePhone(validation.data.phone);
  if (!phone) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid phone number" },
      { status: 400 }
    );
  }

  const { rows } = await pool.query(
    "SELECT 1 FROM users WHERE phone = $1 LIMIT 1",
    [phone]
  );

  return NextResponse.json<ApiResponse<{ exists: boolean }>>({
    success: true,
    data: { exists: rows.length > 0 },
  });
});