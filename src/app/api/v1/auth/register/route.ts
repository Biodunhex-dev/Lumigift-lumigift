import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { withErrorHandler, withCsrf, validateRequest } from "@/server/middleware";
import { registerBodySchema } from "@/lib/schemas";
import { validateInvitationToken, acceptInvitation } from "@/server/services/invitation.service";
import { randomUUID } from "crypto";
import type { ApiResponse } from "@/types";

export const POST = withErrorHandler(withCsrf(async (req: NextRequest) => {
  // ── Validate request body ────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const validation = validateRequest(registerBodySchema, body);
  if (!validation.success) return validation.errorResponse;

  const { phone, displayName, invitationToken } = validation.data;

  // ── Check for existing account ───────────────────────────────────────────
  const { rows: existingUsers } = await pool.query(
    "SELECT 1 FROM users WHERE phone = $1 LIMIT 1",
    [phone]
  );

  if (existingUsers.length > 0) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "This phone number is already registered" },
      { status: 409 }
    );
  }

  // ── Validate invitation token (if provided) ──────────────────────────────
  let invitationId: string | null = null;
  if (invitationToken) {
    const invitation = await validateInvitationToken(invitationToken);
    if (!invitation) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid or expired invitation" },
        { status: 400 }
      );
    }

    // Verify the phone matches the invitation
    if (invitation.recipientPhone !== phone) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Phone number does not match invitation" },
        { status: 400 }
      );
    }

    invitationId = invitation.id;
  }

  // ── Create the user ──────────────────────────────────────────────────────
  const userId = randomUUID();
  try {
    await pool.query(
      "INSERT INTO users (id, phone, display_name) VALUES ($1, $2, $3)",
      [userId, phone, displayName]
    );

    // If there was an invitation, mark it as accepted
    if (invitationId) {
      await acceptInvitation(invitationId);
    }

    return NextResponse.json<ApiResponse<{ userId: string; phone: string }>>(
      { success: true, data: { userId, phone } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[register] Error creating user:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to create user account" },
      { status: 500 }
    );
  }
}));
