export const TMP_TTL_MS = 24 * 60 * 60 * 1000;

export function tmpExpiryDate(nowMs = Date.now()): Date {
  return new Date(nowMs + TMP_TTL_MS);
}
