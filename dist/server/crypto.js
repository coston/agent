import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
//#region src/server/crypto.ts
/**
* Authenticated symmetric encryption for secrets at rest (AES-256-GCM). Used to
* store user-supplied provider API keys — only ever decrypted server-side when
* constructing the provider client.
*
* Ciphertext format: base64(iv).base64(authTag).base64(ciphertext)
*
* The key defaults to `process.env.ENCRYPTION_KEY` (a base64 string decoding to
* 32 bytes). A key may be passed explicitly for testing or key rotation.
*/
function resolveKey(provided) {
	if (provided) {
		if (provided.length !== 32) throw new Error("Encryption key must be 32 bytes");
		return provided;
	}
	const key = Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64");
	if (key.length !== 32) throw new Error("ENCRYPTION_KEY must decode to 32 bytes (use: openssl rand -base64 32)");
	return key;
}
function encryptSecret(plaintext, key) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", resolveKey(key), iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	return [
		iv,
		cipher.getAuthTag(),
		ciphertext
	].map((b) => b.toString("base64")).join(".");
}
function decryptSecret(payload, key) {
	const [ivB64, tagB64, dataB64] = payload.split(".");
	if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed ciphertext");
	const decipher = createDecipheriv("aes-256-gcm", resolveKey(key), Buffer.from(ivB64, "base64"));
	decipher.setAuthTag(Buffer.from(tagB64, "base64"));
	return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
/** Last-4 preview of a secret for display, never the full value. */
function maskSecret(plaintext) {
	return `••••••••${plaintext.slice(-4)}`;
}
//#endregion
export { decryptSecret, encryptSecret, maskSecret };
