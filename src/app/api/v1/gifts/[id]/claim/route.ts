import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGiftById } from "@/server/services/gift.service";
import { claimGift } from "@/server/services/claim.service";
import { claimGiftSchema } from "@/lib/schemas";
import { withErrorHandler, withCsrf, validateRequest } from "@/server/middleware";
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

  // ── Validate request body ────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const validation = validateRequest(claimGiftSchema, body);
  if (!validation.success) return validation.errorResponse;

  const gift = await getGiftById(validation.data.giftId);
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
    const invitation = await getInvitationByPhoneAndGift(phone, validation.data.giftId);
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

  const { txHash } = await claimGift(gift, validation.data.recipientStellarKey);

  return NextResponse.json<ApiResponse<{ txHash: string }>>({
    success: true,
    data: { txHash },
  });
}));
