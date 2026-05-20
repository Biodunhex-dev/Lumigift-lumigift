import { clsx } from "clsx";
import type { GiftStatus } from "@/types";

const labelMap: Record<GiftStatus, string> = {
  draft: "Draft",
  pending_payment: "Pending Payment",
  funded: "Funded",
  locked: "Locked 🔒",
  unlocked: "Unlocked 🎁",
  claimed: "Claimed ✓",
  expired: "Expired",
  cancelled: "Cancelled",
};

export function GiftStatusBadge({ status }: { status: GiftStatus }) {
  return (
    <span
      className={clsx("badge", {
        "badge--locked": status === "locked",
        "badge--unlocked": status === "unlocked",
        "badge--claimed": status === "claimed",
        "badge--pending": status === "pending_payment" || status === "draft",
        "badge--expired": status === "expired" || status === "cancelled",
      })}
    >
      {labelMap[status]}
    </span>
  );
}
