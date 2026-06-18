const CHAT_N = /^Chat (\d+)$/;

/**
 * The next unique "Chat N" name given existing session titles. N is one past the
 * highest existing `Chat <number>`, so it never collides. Pure and client-safe.
 * Manually-renamed titles (anything not matching `Chat <number>`) are ignored, so
 * they never perturb the sequence.
 */
export function nextPlaceholderTitle(existingTitles: string[]): string {
  const numbers = existingTitles
    .map(t => CHAT_N.exec(t.trim())?.[1])
    .filter((n): n is string => n != null)
    .map(Number);
  return `Chat ${numbers.length > 0 ? Math.max(...numbers) + 1 : 1}`;
}
