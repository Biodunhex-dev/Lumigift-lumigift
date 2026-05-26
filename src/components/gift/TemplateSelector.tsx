"use client";

import { GIFT_TEMPLATES, BLANK_TEMPLATE, type GiftTemplate } from "@/lib/giftTemplates";
import styles from "./TemplateSelector.module.css";

interface TemplateSelectorProps {
  onSelect: (template: GiftTemplate) => void;
}

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>Choose an Occasion</h2>
      <p className={styles.subtitle}>Pick a template to get started, or create a custom gift.</p>
      <div className={styles.grid}>
        {[...GIFT_TEMPLATES, BLANK_TEMPLATE].map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            className={styles.card}
            onClick={() => onSelect(tpl)}
          >
            <span className={styles.emoji}>{tpl.emoji}</span>
            <span className={styles.label}>{tpl.occasion}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
