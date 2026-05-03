import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import pool from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

const existsSchema = z.object({
  phone: z.string().min(1),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const phoneParam = searchParams.get("phone");
  if (!phoneParam) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Phone parameter required" },
      { status: 400 }
    );
  }

  const phone = normalizePhone(phoneParam);
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