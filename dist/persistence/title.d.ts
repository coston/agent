//#region src/persistence/title.d.ts
/**
 * The next unique "Chat N" name given existing session titles. N is one past the
 * highest existing `Chat <number>`, so it never collides. Pure and client-safe.
 * Manually-renamed titles (anything not matching `Chat <number>`) are ignored, so
 * they never perturb the sequence.
 */
declare function nextPlaceholderTitle(existingTitles: string[]): string;
//#endregion
export { nextPlaceholderTitle };