"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

declare global {
  interface Window {
    $crisp: unknown[];
    CRISP_WEBSITE_ID: string;
  }
}

const CRISP_WEBSITE_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID ?? "";

/**
 * Loads the Crisp chat widget on every page.
 * Pre-fills user context (ID + recent gift IDs) when the user is signed in.
 * No-ops when NEXT_PUBLIC_CRISP_WEBSITE_ID is not set.
 */
export function CrispChat() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!CRISP_WEBSITE_ID) return;

    window.$crisp = [];
    window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;

    const script = document.createElement("script");
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Clean up on unmount (e.g. during HMR)
      document.head.removeChild(script);
    };
  }, []);

  // Push user context whenever session changes
  useEffect(() => {
    if (!CRISP_WEBSITE_ID || !window.$crisp) return;

    if (session?.user) {
      const user = session.user as { id?: string; phone?: string; recentGiftIds?: string[] };
      if (user.id) {
        window.$crisp.push(["set", "user:nickname", [user.id]]);
      }
      if (user.recentGiftIds?.length) {
        window.$crisp.push([
          "set",
          "session:data",
          [
            [
              ["user_id", user.id ?? ""],
              ["recent_gift_ids", user.recentGiftIds.join(", ")],
            ],
          ],
        ]);
      }
    } else {
      // Reset session data on logout
      window.$crisp.push(["do", "session:reset"]);
    }
  }, [session]);

  return null;
}
