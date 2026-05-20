/**
 * Sanitizes user-generated content to prevent XSS attacks.
 * Uses a whitelist approach to strip all HTML tags and encode special characters.
 *
 * @param input - Raw user input string
 * @returns Sanitized string safe for display
 */
export function sanitizeMessage(input: string | undefined): string | undefined {
  if (!input) return input;

  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Strips all HTML tags and their content for dangerous tags (script, style),
 * and strips only the tags (preserving content) for all other tags.
 * Used as an additional layer of defense before storing user content.
 *
 * @param input - Raw user input string
 * @returns String with all HTML tags removed
 */
export function stripHtmlTags(input: string | undefined): string | undefined {
  if (!input) return input;
  // First remove dangerous tags along with their content
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]*>/g, "");
}
