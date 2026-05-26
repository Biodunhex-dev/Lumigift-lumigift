import { format } from "date-fns";
import type { CreateGiftInput } from "@/types/schemas";
import type { GiftTemplate } from "@/lib/giftTemplates";
import styles from "./GiftPreviewCard.module.css";

interface GiftPreviewCardProps {
  data: Partial<CreateGiftInput>;
  template?: GiftTemplate;
  onEdit: (step: number) => void;
}

export function GiftPreviewCard({ data, template, onEdit }: GiftPreviewCardProps) {
  const unlockDate = data.unlockAt ? new Date(data.unlockAt) : null;

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <span className={styles.emoji}>{template?.emoji ?? "🎁"}</span>
        <div>
          <p className={styles.occasion}>{template?.occasion ?? "Custom Gift"}</p>
          <p className={styles.to}>To: {data.recipientName || "—"}</p>
        </div>
      </div>

      <div className={styles.amount}>
        {data.amountNgn ? `₦${data.amountNgn.toLocaleString("en-NG")}` : "₦ ——"}
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>Phone</span>
        <span>{data.recipientPhone || "—"}</span>
        <button type="button" className={styles.edit} onClick={() => onEdit(1)}>Edit</button>
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>Amount</span>
        <span>{data.amountNgn ? `₦${data.amountNgn.toLocaleString("en-NG")}` : "—"}</span>
        <button type="button" className={styles.edit} onClick={() => onEdit(2)}>Edit</button>
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>Unlocks</span>
        <span>{unlockDate ? format(unlockDate, "MMM d, yyyy 'at' h:mm a") : "—"}</span>
        <button type="button" className={styles.edit} onClick={() => onEdit(3)}>Edit</button>
      </div>

      {data.message && (
        <div className={styles.message}>
          <span className={styles.rowLabel}>Message</span>
          <p>{data.message}</p>
          <button type="button" className={styles.edit} onClick={() => onEdit(2)}>Edit</button>
        </div>
      )}

      <p className={styles.hint}>
        🔒 The amount and message will be hidden from the recipient until the unlock date.
      </p>
    </article>
  );
}
