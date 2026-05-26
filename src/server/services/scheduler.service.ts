/**
 * Unlock scheduler — checks for gifts whose unlockAt has passed and
 * transitions them from "locked" → "unlocked", then notifies recipients.
 *
 * In production, run this as a cron job (e.g. Vercel Cron, BullMQ, or pg_cron).
 */
import { updateGiftStatus, getGiftsByStatus } from "./gift.service";
import { sendUnlockReminderEmail } from "@/lib/email";

// Placeholder: in production, query DB for all locked gifts past their unlockAt.
export async function processUnlocks(): Promise<void> {
  const now = new Date();
  const lockedGifts = await getGiftsByStatus("locked");
  const due = lockedGifts.filter((g) => new Date(g.unlockAt) <= now);

  for (const gift of due) {
    await updateGiftStatus(gift.id, "unlocked");

    if (gift.recipientEmail) {
      sendUnlockReminderEmail(gift.recipientEmail, {
        recipientName: gift.recipientName,
        amountNgn: gift.amountNgn,
        message: gift.message,
        unlockAt: new Date(gift.unlockAt),
      }).catch((err) => console.error("[email] unlock_reminder failed:", err));
    }
  }
}
