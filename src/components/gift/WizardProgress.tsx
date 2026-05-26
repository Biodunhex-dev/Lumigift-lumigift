import styles from "./WizardProgress.module.css";

const STEPS = ["Occasion", "Recipient", "Amount & Message", "Unlock Date", "Review"];

interface WizardProgressProps {
  currentStep: number; // 0-indexed
}

export function WizardProgress({ currentStep }: WizardProgressProps) {
  return (
    <nav className={styles.nav} aria-label="Gift creation steps">
      {STEPS.map((label, i) => (
        <div
          key={label}
          className={`${styles.step} ${i < currentStep ? styles.done : ""} ${i === currentStep ? styles.active : ""}`}
        >
          <div className={styles.dot} aria-current={i === currentStep ? "step" : undefined}>
            {i < currentStep ? "✓" : i + 1}
          </div>
          <span className={styles.label}>{label}</span>
          {i < STEPS.length - 1 && <div className={styles.line} />}
        </div>
      ))}
    </nav>
  );
}
