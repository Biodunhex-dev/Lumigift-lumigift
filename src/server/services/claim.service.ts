import { sendUsdcPayment } from "@/lib/stellar";
import { updateGiftStatus, storeClaimTxHash } from "./gift.service";
import { createEscrowClient, EscrowContractError, EscrowError } from "@/lib/contracts/escrow-client";
import type { Gift } from "@/types";

/**
 * Claims a gift by transferring its USDC amount to the recipient's Stellar account.
 *
 * Steps performed:
 * 1. Validates that the gift status is `"unlocked"` (unlock time has passed).
 * 2. Verifies on-chain state via the typed escrow client (`get_state`).
 * 3. Submits a USDC payment on Stellar to `recipientStellarKey`.
 * 4. Persists the transaction hash on the gift record.
 * 5. Transitions the gift status to `"claimed"`.
 *
 * @param gift - The {@link Gift} to claim. Must have status `"unlocked"`.
 * @param recipientStellarKey - The recipient's Stellar public key (G…).
 * @returns An object containing the Stellar `txHash` of the payment.
 * @throws `Error("Gift is not yet unlocked.")` if the gift status is not `"unlocked"`.
 * @throws {@link EscrowContractError} if the on-chain state check fails.
 * @throws If the Stellar payment submission fails (e.g. insufficient balance,
 *   missing trustline).
 */
export async function claimGift(
  gift: Gift,
  recipientStellarKey: string
): Promise<{ txHash: string }> {
  if (gift.status !== "unlocked") {
    throw new Error("Gift is not yet unlocked.");
  }

  // Verify on-chain state before submitting the payment
  if (gift.contractId) {
    const escrow = createEscrowClient();
    try {
      const state = await escrow.getState();
      if (state.claimed) {
        throw new EscrowContractError(EscrowError.AlreadyClaimed);
      }
    } catch (err) {
      if (err instanceof EscrowContractError) throw err;
      // Non-fatal: log and proceed if RPC is unavailable
      console.warn("escrow get_state check skipped:", (err as Error).message);
    }
  }

  const txHash = await sendUsdcPayment(recipientStellarKey, gift.amountUsdc);
  await storeClaimTxHash(gift.id, txHash);
  await updateGiftStatus(gift.id, "claimed");

  if (gift.recipientEmail) {
    sendClaimConfirmationEmail(gift.recipientEmail, {
      recipientName: gift.recipientName,
      amountNgn: gift.amountNgn,
    }).catch((err) => console.error("[email] claim_confirmation failed:", err));
  }

  return { txHash };
}
