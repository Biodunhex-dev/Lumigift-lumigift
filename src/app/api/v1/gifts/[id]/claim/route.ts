import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getGiftById } from "@/server/services/gift.service";
import { claimGift } from "@/server/services/claim.service";
import { claimGiftSchema } from "@/types/schemas";
import { withErrorHandler, withCsrf } from "@/server/middleware";
import { getInvitationByPhoneAndGift, claimInvitation } from "@/server/services/invitation.service";
import type { ApiResponse } from "@/types";

export const POST = withErrorHandler(withCsrf(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const parsed = claimGiftSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const gift = await getGiftById(parsed.data.giftId);
  if (!gift) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Gift not found" },
      { status: 404 }
    );
  }

  // Get the recipient's phone from the session (they must be logged in)
  const phone = (session.user as { phone?: string }).phone;
  
  // Check if there's an invitation for this gift and recipient
  if (phone) {
    const invitation = await getInvitationByPhoneAndGift(phone, parsed.data.giftId);
    if (invitation) {
      // Invitation exists for this gift and recipient
      if (invitation.status !== "accepted") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "You must complete registration via the invitation to claim this gift" },
          { status: 403 }
        );
      }
      // Mark invitation as claimed
      await claimInvitation(invitation.id);
    }
  }

  const { txHash } = await claimGift(gift, parsed.data.recipientStellarKey);

  return NextResponse.json<ApiResponse<{ txHash: string }>>({
    success: true,
    data: { txHash },
  });
}));
