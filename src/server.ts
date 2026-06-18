// `@coston/agent/server` — the server half of the agent-chat module: provider
// resolution, secret crypto, the model registry, and the chat route factory.
// Every export takes/returns standard AI SDK types; this is wiring, not a new
// framework.

export { ProviderError } from './server/errors';
export {
  defineAgent,
  type AgentSkill,
  type CompiledAgent,
  type DefineAgentOptions,
} from './server/agent';
export {
  buildModel,
  createProviderResolver,
  type CreateProviderResolverOptions,
  type ProviderErrorMessages,
  type ProviderSettingRow,
  type ResolvedProviderConfig,
} from './server/provider';
export {
  DEFAULT_MODEL,
  LOCAL_BASE_URL_HINTS,
  MODELS_BY_PROVIDER,
  providerNeedsKey,
  type ModelChoice,
} from './shared/models';
export { decryptSecret, encryptSecret, maskSecret } from './server/crypto';
export {
  createChatRoute,
  type AuthorizeFailure,
  type AuthorizeResult,
  type AuthorizeSuccess,
  type ChatRequest,
  type ChatRouteBody,
  type CreateChatRouteOptions,
} from './server/route';

// Client-safe re-exports (also available from `@coston/agent/react`).
export {
  providerBadgeLabel,
  providerDisplayName,
  shortModelName,
  type ProviderSetting,
  type ProviderType,
} from './shared/provider-types';
export type {
  ConversationMessage,
  ConversationSummary,
  PersistedMessage,
  PersistenceScope,
} from './shared/messages';
