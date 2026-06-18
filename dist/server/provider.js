import { ProviderError } from "./errors.js";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
//#region src/server/provider.ts
const DEFAULT_MESSAGES = {
	anthropic: "Add your Anthropic API key in Settings to use the agent.",
	openai: "Add your OpenAI API key in Settings to use the agent.",
	gateway: "Set AI_GATEWAY_API_KEY, or switch to your own provider in Settings.",
	openaiCompatible: "Local (OpenAI-compatible) models run in your browser, not on the server."
};
/**
* Turn a resolved provider config into an AI SDK `LanguageModel`. Returns a model
* instance for direct providers, or the plain `provider/model` string for the
* Vercel AI Gateway (which the SDK resolves at call time).
*
* `openai_compatible` always throws: local models are run client-side from the
* browser against the user's own endpoint, never server-side (an arbitrary
* user-supplied base URL must not become a server request — SSRF).
*/
function buildModel(cfg, messages = {}) {
	const msg = {
		...DEFAULT_MESSAGES,
		...messages
	};
	switch (cfg.provider) {
		case "anthropic": {
			const apiKey = cfg.apiKey ?? process.env.ANTHROPIC_API_KEY;
			if (!apiKey) throw new ProviderError(msg.anthropic);
			return createAnthropic({ apiKey })(cfg.model);
		}
		case "openai": {
			const apiKey = cfg.apiKey ?? process.env.OPENAI_API_KEY;
			if (!apiKey) throw new ProviderError(msg.openai);
			return createOpenAI({ apiKey })(cfg.model);
		}
		case "openai_compatible": throw new ProviderError(msg.openaiCompatible);
		case "gateway":
			if (!process.env.AI_GATEWAY_API_KEY) throw new ProviderError(msg.gateway);
			return cfg.model;
	}
}
/**
* Build a `resolveUserModel(userId)` from a user's saved (encrypted) provider
* config. Defaults to the Vercel AI Gateway with Claude Sonnet when the user
* hasn't configured anything.
*/
function createProviderResolver(options) {
	const defaultProvider = options.defaultProvider ?? "gateway";
	const defaultModel = options.defaultModel ?? "anthropic/claude-sonnet-4.6";
	async function resolveUserModel(userId) {
		const row = await options.loadSetting(userId);
		return buildModel({
			provider: row?.provider ?? defaultProvider,
			model: row?.model ?? defaultModel,
			apiKey: row?.apiKeyCiphertext ? options.decrypt(row.apiKeyCiphertext) : void 0,
			baseUrl: row?.baseUrl
		}, options.messages);
	}
	return { resolveUserModel };
}
//#endregion
export { buildModel, createProviderResolver };
