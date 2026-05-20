"use client";

import { useState } from "react";
import styles from "./FAQItem.module.css";

export interface FAQItemProps {
  id: string;
  question: string;
  answer: string | React.ReactNode;
  className?: string;
}

export function FAQItem({ id, question, answer, className }: FAQItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleExpanded();
    }
  };

  return (
    <div className={`${styles.item} ${className || ""}`}>
      <button
        className={styles.question}
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-controls={`faq-answer-${id}`}
        id={`faq-question-${id}`}
        type="button"
      >
        <span className={styles.questionText}>{question}</span>
        <span 
          className={`${styles.icon} ${isExpanded ? styles.iconExpanded : ""}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>
      
      <div
        className={`${styles.answer} ${isExpanded ? styles.answerExpanded : ""}`}
        id={`faq-answer-${id}`}
        aria-labelledby={`faq-question-${id}`}
        role="region"
      >
        <div className={styles.answerContent}>
          {typeof answer === "string" ? <p>{answer}</p> : answer}
        </div>
      </div>
    </div>
  );
}