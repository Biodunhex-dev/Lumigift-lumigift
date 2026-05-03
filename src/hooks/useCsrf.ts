"use client";

/**
 * useCsrf — fetches and caches the CSRF token for the current session.
 *
 * The token is stored in module-level memory (not localStorage/sessionStorage)
 * so it is never persisted to disk and is cleared on page reload.
 *
 * Usage:
 *   const { csrfFetch } = useCsrf();
 *   await csrfFetch("/api/v1/gifts", { method: "POST", body: JSON.stringify(data) });
 */

import { useCallback, useRef } from "react";

// Module-level cache — shared across all hook instances in the same page load.
let cachedToken: string | null = null;
let fetchPromise: Promise<string> | null = null;

async function fetchCsrfToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  // Deduplicate concurrent calls
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    const res = await fetch("/api/v1/csrf", { credentials: "same-origin" });
    if (!res.ok) throw new Error("Failed to fetch CSRF token");
    const json = await res.json();
    const token: string = json?.data?.csrfToken;
    if (!token) throw new Error("CSRF token missing from response");
    cachedToken = token;
    return token;
  })().finally(() => {
    fetchPromise = null;
  });

  return fetchPromise;
}

/** Invalidate the cached token (call after receiving a 403 CSRF error). */
export function invalidateCsrfToken(): void {
  cachedToken = null;
}

export function useCsrf() {
  const tokenRef = useRef<string | null>(null);

  /**
   * A drop-in replacement for `fetch` that automatically attaches the
   * `x-csrf-token` header on every request.
   */
  const csrfFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
      // Reuse the in-memory token or fetch a fresh one
      const token = tokenRef.current ?? (await fetchCsrfToken());
      tokenRef.current = token;

      const headers = new Headers(init.headers);
      headers.set("x-csrf-token", token);

      const res = await fetch(input, { ...init, headers, credentials: "same-origin" });

      // If the server rejects the token, invalidate and surface the error
      if (res.status === 403) {
        const body = await res.clone().json().catch(() => ({}));
        if (body?.code === "CSRF_INVALID" || body?.code === "CSRF_MISSING") {
          invalidateCsrfToken();
          tokenRef.current = null;
        }
      }

      return res;
    },
    []
  );

  return { csrfFetch };
}
