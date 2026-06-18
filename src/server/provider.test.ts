import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildModel, createProviderResolver, ProviderError } from './provider';

describe('buildModel', () => {
  const env = process.env;
  beforeEach(() => {
    process.env = { ...env };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
  });
  afterEach(() => {
    process.env = env;
  });

  it('throws ProviderError for anthropic without a key', () => {
    expect(() => buildModel({ provider: 'anthropic', model: 'claude-sonnet-4-6' })).toThrow(
      ProviderError
    );
  });

  it('throws ProviderError for openai without a key', () => {
    expect(() => buildModel({ provider: 'openai', model: 'gpt-5.1' })).toThrow(ProviderError);
  });

  it('builds an anthropic model when a key is supplied inline', () => {
    const model = buildModel({ provider: 'anthropic', model: 'claude-sonnet-4-6', apiKey: 'sk' });
    expect(model).toBeTruthy();
  });

  it('always refuses openai_compatible server-side (SSRF guard)', () => {
    expect(() => buildModel({ provider: 'openai_compatible', model: 'llama3.1' })).toThrow(
      /browser/
    );
  });

  it('returns the plain provider/model string for the gateway when configured', () => {
    process.env.AI_GATEWAY_API_KEY = 'gw';
    expect(buildModel({ provider: 'gateway', model: 'anthropic/claude-sonnet-4.6' })).toBe(
      'anthropic/claude-sonnet-4.6'
    );
  });

  it('throws for the gateway when AI_GATEWAY_API_KEY is missing', () => {
    expect(() => buildModel({ provider: 'gateway', model: 'anthropic/claude-sonnet-4.6' })).toThrow(
      ProviderError
    );
  });

  it('honours custom error messages', () => {
    expect(() =>
      buildModel({ provider: 'anthropic', model: 'x' }, { anthropic: 'custom message' })
    ).toThrow('custom message');
  });
});

describe('createProviderResolver', () => {
  beforeEach(() => {
    process.env.AI_GATEWAY_API_KEY = 'gw';
  });

  it('falls back to the gateway default when the user has no saved config', async () => {
    const loadSetting = vi.fn(async () => null);
    const decrypt = vi.fn();
    const { resolveUserModel } = createProviderResolver({ loadSetting, decrypt });
    const model = await resolveUserModel('user-1');
    expect(model).toBe('anthropic/claude-sonnet-4.6');
    expect(loadSetting).toHaveBeenCalledWith('user-1');
    expect(decrypt).not.toHaveBeenCalled();
  });

  it('decrypts a stored key and uses the saved provider/model', async () => {
    const loadSetting = vi.fn(async () => ({
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      apiKeyCiphertext: 'cipher',
    }));
    const decrypt = vi.fn(() => 'sk-real');
    const { resolveUserModel } = createProviderResolver({ loadSetting, decrypt });
    const model = await resolveUserModel('user-1');
    expect(decrypt).toHaveBeenCalledWith('cipher');
    expect(model).toBeTruthy();
  });

  it('respects a custom default provider/model', async () => {
    process.env.OPENAI_API_KEY = 'sk';
    const { resolveUserModel } = createProviderResolver({
      loadSetting: async () => null,
      decrypt: s => s,
      defaultProvider: 'openai',
      defaultModel: 'gpt-5.1',
    });
    await expect(resolveUserModel('u')).resolves.toBeTruthy();
  });
});
