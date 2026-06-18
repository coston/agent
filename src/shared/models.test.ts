import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL, MODELS_BY_PROVIDER, providerNeedsKey } from './models';
import type { ProviderType } from './provider-types';

const PROVIDERS: ProviderType[] = ['anthropic', 'openai', 'gateway', 'openai_compatible'];

describe('models registry', () => {
  it('has a default model for every provider', () => {
    for (const provider of PROVIDERS) {
      expect(DEFAULT_MODEL[provider]).toBeTruthy();
    }
  });

  it('lists curated models for hosted providers and none for local', () => {
    expect(MODELS_BY_PROVIDER.anthropic.length).toBeGreaterThan(0);
    expect(MODELS_BY_PROVIDER.gateway.length).toBeGreaterThan(0);
    expect(MODELS_BY_PROVIDER.openai_compatible).toHaveLength(0);
  });

  it('uses provider/model strings for the gateway', () => {
    for (const choice of MODELS_BY_PROVIDER.gateway) {
      expect(choice.id).toContain('/');
    }
  });

  it('only direct providers require a user-supplied key', () => {
    expect(providerNeedsKey('anthropic')).toBe(true);
    expect(providerNeedsKey('openai')).toBe(true);
    expect(providerNeedsKey('gateway')).toBe(false);
    expect(providerNeedsKey('openai_compatible')).toBe(false);
  });
});
