//#region src/server/errors.ts
/** Thrown when a user's provider config can't produce a working model. */
var ProviderError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "ProviderError";
	}
};
//#endregion
export { ProviderError };
