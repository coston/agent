import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { ProviderType } from '../shared/provider-types';
import { ProviderError } from './errors';

export interface ResolvedProviderConfig {
  provider: ProviderType;
  model: string;
  apiKey?: string;
}

/** User-facing strings shown when a provider can't be constructed. */
export interface ProviderErrorMessages {
  anthropic: string;
  openai: string;
  gateway: string;
  openaiCompatible: string;
}

const DEFAULT_MESSAGES: ProviderErrorMessages = {
  anthropic: 'Add your Anthropic API key in Settings to use the agent.',
  openai: 'Add your OpenAI API key in Settings to use the agent.',
  gateway: 'Set AI_GATEWAY_API_KEY, or switch to your own provider in Settings.',
  openaiCompatible: 'Local (OpenAI-compatible) models run in your browser, not on the server.',
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
export function buildModel(
  cfg: ResolvedProviderConfig,
  messages: Partial<ProviderErrorMessages> = {}
): LanguageModel {
  const msg = { ...DEFAULT_MESSAGES, ...messages };
  switch (cfg.provider) {
    case 'anthropic': {
      const apiKey = cfg.apiKey ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new ProviderError(msg.anthropic);
      return createAnthropic({ apiKey })(cfg.model);
    }
    case 'openai': {
      const apiKey = cfg.apiKey ?? process.env.OPENAI_API_KEY;
      if (!apiKey) throw new ProviderError(msg.openai);
      return createOpenAI({ apiKey })(cfg.model);
    }
    case 'openai_compatible':
      throw new ProviderError(msg.openaiCompatible);
    case 'gateway': {
      if (!process.env.AI_GATEWAY_API_KEY) throw new ProviderError(msg.gateway);
      return cfg.model;
    }
  }
}

/** The persisted (encrypted) provider config row, as loaded from app storage. */
export interface ProviderSettingRow {
  provider?: string | null;
  model?: string | null;
  apiKeyCiphertext?: string | null;
  baseUrl?: string | null;
}

export interface CreateProviderResolverOptions {
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
export function createProviderResolver(options: CreateProviderResolverOptions): {
  resolveUserModel: (userId: string) => Promise<LanguageModel>;
} {
  const defaultProvider = options.defaultProvider ?? 'gateway';
  const defaultModel = options.defaultModel ?? 'anthropic/claude-sonnet-4.6';

  async function resolveUserModel(userId: string): Promise<LanguageModel> {
    const row = await options.loadSetting(userId);
    return buildModel(
      {
        provider: (row?.provider as ProviderType) ?? defaultProvider,
        model: row?.model ?? defaultModel,
        apiKey: row?.apiKeyCiphertext ? options.decrypt(row.apiKeyCiphertext) : undefined,
      },
      options.messages
    );
  }

  return { resolveUserModel };
}
