"use client";

import { useToast } from "./ToastContext";
import styles from "./Toaster.module.css";

const ICONS: Record<string, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

export function Toaster() {
  const { toasts, removeToast } = useToast();

  return (
    <div className={styles.container} aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={`${styles.toast} ${styles[toast.variant]}`}
        >
          <span className={styles.icon} aria-hidden="true">
            {ICONS[toast.variant]}
          </span>
          <span className={styles.message}>{toast.message}</span>
          <button
            className={styles.close}
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
