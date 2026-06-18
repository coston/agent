//#region src/server/crypto.d.ts
declare function encryptSecret(plaintext: string, key?: Buffer): string;
declare function decryptSecret(payload: string, key?: Buffer): string;
/** Last-4 preview of a secret for display, never the full value. */
declare function maskSecret(plaintext: string): string;
//#endregion
export { decryptSecret, encryptSecret, maskSecret };