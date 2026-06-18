//#region src/server/errors.d.ts
/** Thrown when a user's provider config can't produce a working model. */
declare class ProviderError extends Error {
  constructor(message: string);
}
//#endregion
export { ProviderError };