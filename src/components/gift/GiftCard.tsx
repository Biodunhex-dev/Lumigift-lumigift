"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import type { Gift, GiftStatus } from "@/types";
import { GiftStatusBadge } from "@/components/ui/GiftStatusBadge";
import { formatNGN } from "@/lib/currency";
import { ClaimButton } from "./ClaimButton";
import { ShareGift } from "./ShareGift";
import styles from "./GiftCard.module.css";

interface GiftCardProps {
  gift: Gift;
  perspective: "sender" | "recipient";
  /** Recipient's Stellar public key — required when perspective="recipient" to enable claiming */
  recipientStellarKey?: string;
}

const EXPLORER_BASE = "https://stellar.expert/explorer/testnet/tx";

function explorerUrl(txHash: string) {
  return `${EXPLORER_BASE}/${txHash}`;
}

export function GiftCard({ gift, perspective, recipientStellarKey }: GiftCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<GiftStatus>(gift.status);
  const isLocked = status === "locked";
  const name =
    perspective === "sender" ? `To: ${gift.recipientName}` : "A gift for you";

  const amountLabel =
    isLocked && perspective === "recipient" ? "amount hidden" : formatNGN(gift.amountNgn);

  const unlockLabel = `${isLocked ? "Unlocks" : "Unlocked"} ${format(
    new Date(gift.unlockAt),
    "MMM d, yyyy 'at' h:mm a"
  )}`;

  const cardLabel = [
    name,
    amountLabel,
    unlockLabel,
    status,
  ].join(", ");

  const handleActivate = () => {
    router.push(`/gifts/${gift.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleActivate();
    }
  };

  return (
    <article
      className={styles.card}
      tabIndex={0}
      role="button"
      aria-label={cardLabel}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.header}>
        <span className={styles.name}>{name}</span>
        <GiftStatusBadge status={status} />
      </div>

      <div className={styles.amount} aria-hidden="true">
        {isLocked && perspective === "recipient" ? (
          <span className={styles.hidden}>₦ ••••••</span>
        ) : (
          <span>{formatNGN(gift.amountNgn)}</span>
        )}
      </div>

      <div className={styles.meta} aria-hidden="true">
        <span>{unlockLabel}</span>
      </div>

      {gift.message && !isLocked && (
        <p className={styles.message}>{gift.message}</p>
      )}

      {gift.stellarTxHash && (
        <div className={styles.meta}>
          <span>Funding tx: </span>
          <a
            href={explorerUrl(gift.stellarTxHash)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {gift.stellarTxHash.slice(0, 8)}…
          </a>
        </div>
      )}

      {gift.claimTxHash && (
        <div className={styles.meta}>
          <span>Claim tx: </span>
          <a
            href={explorerUrl(gift.claimTxHash)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {gift.claimTxHash.slice(0, 8)}…
          </a>
        </div>
      )}

      {perspective === "recipient" && status === "unlocked" && recipientStellarKey && (
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <ClaimButton
            giftId={gift.id}
            recipientStellarKey={recipientStellarKey}
            onStatusChange={setStatus}
          />
        </div>
      )}

      {perspective === "sender" && (status === "locked" || status === "funded") && (
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <ShareGift giftId={gift.id} recipientName={gift.recipientName} />
        </div>
      )}
    </article>
  );
}
