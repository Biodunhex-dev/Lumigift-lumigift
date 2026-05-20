/**
 * Normalizes a phone number to E.164 format.
 * Supports Nigerian numbers in the following formats:
 *   - +2348012345678  (already E.164)
 *   - 2348012345678   (international without +)
 *   - 08012345678     (local with leading 0)
 *   - 8012345678      (local without leading 0)
 *
 * Non-Nigerian numbers that already start with `+` and have 10–15 digits are
 * passed through unchanged.
 *
 * @param raw - The raw phone number string in any supported format.
 * @returns The E.164-formatted phone number (e.g. `"+2348012345678"`),
 *   or `null` if the input cannot be normalized to a valid E.164 string.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  let e164: string;

  if (digits.startsWith("234") && digits.length === 13) {
    // 2348012345678 → +2348012345678
    e164 = `+${digits}`;
  } else if (digits.startsWith("0") && digits.length === 11) {
    // 08012345678 → +2348012345678
    e164 = `+234${digits.slice(1)}`;
  } else if (digits.length === 10 && !digits.startsWith("0")) {
    // 8012345678 → +2348012345678
    e164 = `+234${digits}`;
  } else if (raw.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    // Already E.164 for any country
    e164 = `+${digits}`;
  } else {
    return null;
  }

  // Final sanity check: E.164 is + followed by 10–15 digits, first digit non-zero
  if (!/^\+[1-9]\d{9,14}$/.test(e164)) return null;

  // For Nigerian numbers (+234...), the subscriber number must not be all zeros
  // and must start with a valid Nigerian network prefix (7, 8, or 9)
  if (e164.startsWith("+234")) {
    const subscriber = e164.slice(4); // 10 digits after +234
    if (subscriber.length !== 10) return null;
    if (!/^[789]/.test(subscriber)) return null;
  }

  return e164;
}
