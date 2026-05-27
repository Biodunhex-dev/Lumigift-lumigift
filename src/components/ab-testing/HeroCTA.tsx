"use client";

import Link from "next/link";
import { useFeatureValue } from "@growthbook/growthbook-react";

/**
 * Experiment: cta_button_copy
 * Control  (A): "Send a Gift"
 * Variant  (B): "Surprise Someone Today"
 *
 * Statistical significance threshold: 95 % (p < 0.05)
 * Minimum sample size per variant: 500 unique users
 * Tracked via analytics event: $experiment_started (fired by GrowthBook trackingCallback)
 */
export function HeroCTA({ className }: { className?: string }) {
  const ctaCopy = useFeatureValue<string>("cta_button_copy", "Send a Gift");

  return (
    <Link href="/send" className={`btn btn--primary btn--lg ${className ?? ""}`}>
      {ctaCopy}
    </Link>
  );
}
