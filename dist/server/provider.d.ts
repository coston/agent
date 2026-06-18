import { ProviderType } from "../shared/provider-types.js";
import { ProviderError } from "./errors.js";
import { LanguageModel } from "ai";

//#region src/server/provider.d.ts
interface ResolvedProviderConfig {
  provider: ProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string | null;
}
/** User-facing strings shown when a provider can't be constructed. */
interface ProviderErrorMessages {
  anthropic: string;
  openai: string;
  gateway: string;
  openaiCompatible: string;
}
/**
 * Turn a resolved provider config into an AI SDK `LanguageModel`. Returns a model
 * instance for direct providers, or the plain `provider/model` string for the
 * Vercel AI Gateway (which the SDK resolves at call time).
 *
 * `openai_compatible` always throws: local models are run client-side from the
 * browser against the user's own endpoint, never server-side (an arbitrary
 * user-supplied base URL must not become a server request — SSRF).
 */
declare function buildModel(cfg: ResolvedProviderConfig, messages?: Partial<ProviderErrorMessages>): LanguageModel;
/** The persisted (encrypted) provider config row, as loaded from app storage. */
interface ProviderSettingRow {
  provider?: string | null;
  model?: string | null;
  apiKeyCiphertext?: string | null;
  baseUrl?: string | null;
}
interface CreateProviderResolverOptions {
  /** Load a user's saved provider config (e.g. `db.aiProviderSetting.findUnique`). */
  loadSetting: (userId: string) => Promise<ProviderSettingRow | null>;
  /** Decrypt a stored API-key ciphertext (typically `decryptSecret`). */
  decrypt: (ciphertext: string) => string;
  /** Provider to use when the user has configured nothing. Defaults to `gateway`. */
  defaultProvider?: ProviderType;
  /** Model to use when the user has configured nothing. Defaults to Claude Sonnet via gateway. */
  defaultModel?: string;
  /** Override the user-facing error strings. */
  messages?: Partial<ProviderErrorMessages>;
}
/**
 * Build a `resolveUserModel(userId)` from a user's saved (encrypted) provider
 * config. Defaults to the Vercel AI Gateway with Claude Sonnet when the user
 * hasn't configured anything.
 */
declare function createProviderResolver(options: CreateProviderResolverOptions): {
  resolveUserModel: (userId: string) => Promise<LanguageModel>;
};
//#endregion
export { CreateProviderResolverOptions, ProviderErrorMessages, ProviderSettingRow, ResolvedProviderConfig, buildModel, createProviderResolver };