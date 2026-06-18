// Client-safe provider types and display helpers (no server-only imports such as
// a database client or `node:crypto`). Safe to import from client components and
// re-exported from both `@coston/agent/server` and `@coston/agent/react`.

export type ProviderType = 'anthropic' | 'openai' | 'openai_compatible' | 'gateway';

export interface ProviderSetting {
  provider: ProviderType;
  model: string;
  hasKey: boolean;
  baseUrl: string | null;
}

const PROVIDER_NAMES: Record<ProviderType, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  openai_compatible: 'Local / OpenAI-compatible',
  gateway: 'Vercel AI Gateway',
};

export function providerDisplayName(provider: ProviderType): string {
  return PROVIDER_NAMES[provider];
}

/** Drop a `provider/` prefix, e.g. "anthropic/claude-sonnet-4.6" → "claude-sonnet-4.6". */
export function shortModelName(model: string): string {
  return model.includes('/') ? model.slice(model.lastIndexOf('/') + 1) : model;
}

/** Short label for a toolbar/panel badge, e.g. "Anthropic · claude-sonnet-4-6". */
export function providerBadgeLabel(setting: ProviderSetting): string {
  return `${providerDisplayName(setting.provider)} · ${shortModelName(setting.model)}`;
}
