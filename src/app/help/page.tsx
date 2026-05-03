import Link from "next/link";
import type { Metadata } from "next";
import { FAQSection } from "./components/FAQSection";
import { faqContent } from "./data/faq-content";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Help & FAQ | Lumigift",
  description: "Find answers to common questions about sending and receiving time-locked cash gifts on Lumigift.",
  keywords: ["help", "faq", "support", "lumigift", "gifts", "stellar", "usdc"],
  openGraph: {
    title: "Help & FAQ | Lumigift",
    description: "Get help with time-locked cash gifts",
    type: "website",
  },
};

export default function HelpPage() {
  return (
    <div className={styles.page}>
      <div className="container container--content">
        {/* Header */}
        <header className={styles.header}>
          <nav className={styles.breadcrumb}>
            <Link href="/" className={styles.breadcrumbLink}>
              Home
            </Link>
            <span className={styles.breadcrumbSeparator}>/</span>
            <span className={styles.breadcrumbCurrent}>Help</span>
          </nav>
          <h1 className={styles.title}>Help & FAQ</h1>
          <p className={styles.subtitle}>
            Find answers to common questions about sending and receiving time-locked cash gifts.
          </p>
        </header>

        {/* FAQ Content */}
        <main className={styles.content}>
          {faqContent.sections.map((section) => (
            <FAQSection
              key={section.id}
              {...section}
            />
          ))}
        </main>

        {/* Footer navigation */}
        <footer className={styles.footer}>
          <div className={styles.footerContent}>
            <Link href="/" className="btn btn--secondary">
              ← Back to Home
            </Link>
            <p className={styles.lastUpdated}>
              Last updated: {faqContent.lastReviewed.toLocaleDateString()}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}