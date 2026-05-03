import { FAQItem, type FAQItemProps } from "./FAQItem";
import styles from "./FAQSection.module.css";

export interface FAQSectionProps {
  id: string;
  title: string;
  description?: string;
  items: Omit<FAQItemProps, "className">[];
  className?: string;
}

export function FAQSection({ id, title, description, items, className }: FAQSectionProps) {
  return (
    <section className={`${styles.section} ${className || ""}`} id={id}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {description && (
          <p className={styles.description}>{description}</p>
        )}
      </header>
      
      <div className={styles.items}>
        {items.map((item) => (
          <FAQItem
            key={item.id}
            {...item}
            className={styles.item}
          />
        ))}
      </div>
    </section>
  );
}