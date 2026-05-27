"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useCsrf } from "@/hooks/useCsrf";
import confetti from "canvas-confetti";
import type { GiftStatus } from "@/types";
import styles from "./ClaimButton.module.css";

interface ClaimButtonProps {
  giftId: string;
  recipientStellarKey: string;
  onStatusChange: (status: GiftStatus) => void;
}

export function ClaimButton({ giftId, recipientStellarKey, onStatusChange }: ClaimButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const { csrfFetch } = useCsrf();

  const triggerConfetti = () => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await csrfFetch(`/api/v1/gifts/${giftId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftId, recipientStellarKey }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Claim failed");
    },
    onMutate: () => {
      setError(null);
      onStatusChange("claiming" as GiftStatus);
    },
    onSuccess: () => {
      onStatusChange("claimed");
      triggerConfetti();
    },
    onError: (err: Error) => {
      onStatusChange("unlocked");
      setError(err.message);
    },
  });

  return (
    <div className={styles.wrapper}>
      <button
        className="btn btn--primary"
        onClick={() => mutate()}
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? <span className={styles.spinner} aria-hidden="true" /> : null}
        {isPending ? "Claiming…" : "Claim Gift"}
      </button>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
