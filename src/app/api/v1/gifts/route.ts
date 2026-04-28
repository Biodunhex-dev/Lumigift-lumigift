import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createGiftSchema } from "@/types/schemas";
import { createGift, getGiftsBySenderPaginated } from "@/server/services/gift.service";
import { withErrorHandler, withCsrf } from "@/server/middleware";
import type { ApiResponse, Gift } from "@/types";
import type { GiftPage } from "@/server/services/gift.service";

const PAGE_SIZE = 10;

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  const userId = (session.user as { id: string }).id;
  const cursor = req.nextUrl.searchParams.get("cursor");
  const page = await getGiftsBySenderPaginated(userId, cursor, PAGE_SIZE);
  return NextResponse.json<ApiResponse<GiftPage>>({ success: true, data: page });
});

export const POST = withErrorHandler(withCsrf(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const parsed = createGiftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const userId = (session.user as { id: string }).id;
  const { gift, paymentUrl } = await createGift(
    userId,
    parsed.data,
    parsed.data.recipientIsRegistered
  );

  return NextResponse.json<ApiResponse<{ gift: Gift; paymentUrl: string }>>(
    { success: true, data: { gift, paymentUrl } },
    { status: 201 }
  );
}));
