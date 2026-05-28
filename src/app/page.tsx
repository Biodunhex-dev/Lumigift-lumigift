import Link from "next/link";
import type { Metadata } from "next";
import styles from "./page.module.css";
import { HeroCTA } from "@/components/ab-testing/HeroCTA";

export const metadata: Metadata = {
  title: "Lumigift — Time-Locked Cash Gifts on Stellar",
};

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={`container container--content ${styles.heroInner}`}>
          <div className={styles.badge}>Powered by Stellar &amp; USDC</div>
          <h1 className={styles.headline}>
            Cash gifts that unlock
            <br />
            <span className={styles.highlight}>on a surprise date</span>
          </h1>
          <p className={styles.subheadline}>
            Send money that stays completely hidden until the perfect moment.
            Birthdays, anniversaries, Valentine&apos;s Day — make every gift
            unforgettable.
          </p>
          <div className={styles.cta}>
            <HeroCTA />
            <Link href="/how-it-works" className="btn btn--secondary btn--lg">
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <div className="container">
          <h2 className={styles.sectionTitle}>Why Lumigift?</h2>
          <div className={styles.grid}>
            {FEATURES.map((f) => (
              <div key={f.title} className={`card ${styles.featureCard}`}>
                <span className={styles.featureIcon} aria-hidden="true">
                  {f.icon}
                </span>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={styles.steps}>
        <div className="container container--content">
          <h2 className={styles.sectionTitle}>How it works</h2>
          <ol className={styles.stepList}>
            {STEPS.map((s, i) => (
              <li key={s.title} className={styles.step}>
                <span className={styles.stepNum}>{i + 1}</span>
                <div>
                  <h3 className={styles.stepTitle}>{s.title}</h3>
                  <p className={styles.stepDesc}>{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

const FEATURES = [
  {
    icon: "🔒",
    title: "Time-Locked Escrow",
    desc: "Funds are held in a Soroban smart contract — no one can touch them until the unlock date.",
  },
  {
    icon: "💵",
    title: "Stable Value",
    desc: "Gifts are denominated in USDC so the amount never changes between sending and claiming.",
  },
  {
    icon: "⚡",
    title: "Near-Zero Fees",
    desc: "Stellar's high-speed network means more of your money reaches the recipient.",
  },
  {
    icon: "🇳🇬",
    title: "NGN On/Off-Ramp",
    desc: "Pay in Naira via Paystack. Recipients can withdraw directly to their Nigerian bank account.",
  },
];

const STEPS = [
  {
    title: "Create a gift",
    desc: "Enter the recipient's phone number, the amount in Naira, and choose a surprise unlock date.",
  },
  {
    title: "Pay securely",
    desc: "Complete payment via Paystack or card. Funds are converted to USDC and locked on-chain.",
  },
  {
    title: "Recipient gets notified",
    desc: "They receive an SMS telling them a gift is waiting — but the amount stays hidden.",
  },
  {
    title: "Gift unlocks on the day",
    desc: "At the exact date and time you chose, the gift is revealed and the recipient can claim it.",
  },
];
