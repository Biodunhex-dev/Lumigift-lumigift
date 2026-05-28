/**
 * A/B testing — GrowthBook integration.
 *
 * Experiment assignment is persisted per user via localStorage so the same
 * user always sees the same variant across sessions.
 *
 * Statistical significance threshold: 95 % confidence (p < 0.05).
 * Minimum sample size per variant: 500 unique users.
 * Minimum detectable effect: 5 % relative lift.
 */
import { GrowthBook } from "@growthbook/growthbook-react";

const FEATURES_ENDPOINT = process.env.NEXT_PUBLIC_GROWTHBOOK_FEATURES_ENDPOINT ?? "";

/** Stable anonymous ID persisted in localStorage. */
function getOrCreateUserId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = localStorage.getItem("gb_user_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("gb_user_id", id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

export function createGrowthBook() {
  return new GrowthBook({
    apiHost: "https://cdn.growthbook.io",
    clientKey: process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY ?? "",
    enableDevMode: process.env.NODE_ENV !== "production",
    trackingCallback: (experiment, result) => {
      // Forward experiment exposure to analytics (PostHog) if available
      if (typeof window !== "undefined" && typeof (window as Window & { posthog?: { capture: (e: string, p: object) => void; __loaded?: boolean } }).posthog !== "undefined") {
        const ph = (window as Window & { posthog?: { capture: (e: string, p: object) => void; __loaded?: boolean } }).posthog;
        if (ph?.__loaded) {
          ph.capture("$experiment_started", {
            experiment_id: experiment.key,
            variant_id: result.key,
          });
        }
      }
    },
    attributes: {
      id: getOrCreateUserId(),
    },
  });
}

/** Load features from GrowthBook CDN (or local endpoint). */
export async function loadFeatures(gb: GrowthBook) {
  if (FEATURES_ENDPOINT) {
    try {
      const res = await fetch(FEATURES_ENDPOINT);
      const data = await res.json();
      await gb.setPayload(data);
    } catch {
      // Fail open — no features loaded, all experiments use control
    }
  } else {
    await gb.loadFeatures({ autoRefresh: true });
  }
}
