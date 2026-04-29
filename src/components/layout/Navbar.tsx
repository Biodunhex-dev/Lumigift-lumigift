import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import styles from "./Navbar.module.css";

export function Navbar() {
  return (
    <header className={styles.header}>
      <nav className={`container ${styles.nav}`} aria-label="Main navigation">
        <Link href="/" className={styles.logo} aria-label="Lumigift home">
          <span className={styles.logoMark}>Z</span>
          <span className={styles.logoText}>Lumigift</span>
        </Link>

        <ul className={styles.links} role="list">
          <li>
            <Link href="/send" className={styles.link}>
              Send a Gift
            </Link>
          </li>
          <li>
            <Link href="/dashboard" className={styles.link}>
              Dashboard
            </Link>
          </li>
          <li>
            <ThemeToggle />
          </li>
          <li>
            <Link href="/auth/login" className="btn btn--primary btn--sm">
              Sign In
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
