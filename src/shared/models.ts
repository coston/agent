import type { ProviderType } from './provider-types';

export interface ModelChoice {
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
export const MODELS_BY_PROVIDER: Record<ProviderType, ModelChoice[]> = {
  anthropic: [
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  ],
  openai: [
    { id: 'gpt-5.5', label: 'GPT-5.5' },
    { id: 'gpt-5.1', label: 'GPT-5.1' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'gpt-4o', label: 'GPT-4o' },
  ],
  gateway: [
    { id: 'anthropic/claude-opus-4.8', label: 'Claude Opus 4.8 · Anthropic' },
    { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6 · Anthropic' },
    { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5 · Anthropic' },
    { id: 'openai/gpt-5.5', label: 'GPT-5.5 · OpenAI' },
    { id: 'openai/gpt-5.1', label: 'GPT-5.1 · OpenAI' },
    { id: 'openai/gpt-4.1', label: 'GPT-4.1 · OpenAI' },
  ],
  openai_compatible: [],
};

export const DEFAULT_MODEL: Record<ProviderType, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5.1',
  gateway: 'anthropic/claude-sonnet-4.6',
  openai_compatible: 'llama3.1',
};

/** Whether the provider expects the user to bring an API key. */
export function providerNeedsKey(provider: ProviderType): boolean {
  return provider === 'anthropic' || provider === 'openai';
}

/** Common local endpoints, shown as hints in a settings form. */
export const LOCAL_BASE_URL_HINTS = [
  { label: 'Ollama', url: 'http://localhost:11434/v1' },
  { label: 'LM Studio', url: 'http://localhost:1234/v1' },
  { label: 'vLLM', url: 'http://localhost:8000/v1' },
];
