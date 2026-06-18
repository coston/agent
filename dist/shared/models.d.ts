import { ProviderType } from "./provider-types.js";

//#region src/shared/models.d.ts
interface ModelChoice {
  id: string;
  label: string;
}
/**
 * Curated default model lists per provider. Direct providers use native model
 * ids; the gateway uses `provider/model` strings; local/OpenAI-compatible takes
 * a free-form model name (whatever the local server exposes), so it has no list.
 *
 * Client-safe (pure data) — used by both `@coston/agent/server` and the
 * `<ProviderForm>` in `@coston/agent/react`. Apps may override these wholesale.
 */
declare const MODELS_BY_PROVIDER: Record<ProviderType, ModelChoice[]>;
declare const DEFAULT_MODEL: Record<ProviderType, string>;
/** Whether the provider expects the user to bring an API key. */
declare function providerNeedsKey(provider: ProviderType): boolean;
/** Common local endpoints, shown as hints in a settings form. */
declare const LOCAL_BASE_URL_HINTS: {
  label: string;
  url: string;
}[];
//#endregion
export { DEFAULT_MODEL, LOCAL_BASE_URL_HINTS, MODELS_BY_PROVIDER, ModelChoice, providerNeedsKey };