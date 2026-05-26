import type { Metadata } from "next";
import { GiftWizard } from "@/components/gift/GiftWizard";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Send a Gift" };

export default function SendPage() {
  return (
    <div className={styles.page}>
      <div className={`container container--sm ${styles.inner}`}>
        <GiftWizard />
      </div>
    </div>
  );
}
