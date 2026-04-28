import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { withErrorHandler, withCsrf } from "@/server/middleware";
import { validateInvitationToken, acceptInvitation } from "@/server/services/invitation.service";
import { randomUUID } from "crypto";
import type { ApiResponse } from "@/types";

const registerSchema = {
  phone: (val: string) => normalizePhone(val),
  displayName: (val: string) => typeof val === "string" && val.length >= 2,
  invitationToken: (val: string) => typeof val === "string" && val.length > 0,
};

export const POST = withErrorHandler(withCsrf(async (req: NextRequest) => {
  const body = await req.json();
  
  const phone = normalizePhone(String(body?.phone ?? ""));
  const displayName = String(body?.displayName ?? "").trim();
  const invitationToken = String(body?.invitationToken ?? "").trim();

  if (!phone) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid phone number" },
      { status: 400 }
    );
  }

  if (displayName.length < 2) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Name must be at least 2 characters" },
      { status: 400 }
    );
  }

  // Check if phone is already registered
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

  // If invitation token is provided, validate it
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

  // Create the user
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
      { 
        success: true, 
        data: { userId, phone }
      },
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
