'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@coston/ui/button';
import { Input } from '@coston/ui/input';
import { cn } from './cn';
import {
  DEFAULT_MODEL,
  LOCAL_BASE_URL_HINTS,
  MODELS_BY_PROVIDER,
  providerNeedsKey,
  type ModelChoice,
} from '../shared/models';
import { providerDisplayName, type ProviderSetting, type ProviderType } from '../shared/provider-types';

/** What the form submits — the app encrypts `apiKey` and saves the row. */
export interface ProviderFormInput {
  provider: ProviderType;
  model: string;
  /** New key, or `undefined` to keep the saved one. */
  apiKey?: string;
  /** Local endpoint base URL (only for `openai_compatible`). */
  baseUrl?: string;
}

export interface ProviderFormProps {
  /** The user's current setting (`hasKey` controls the key placeholder). */
  initial: ProviderSetting;
  /** Persist the change (the app encrypts + stores). */
  onSave: (input: ProviderFormInput) => Promise<void>;
  /** Called after a successful save (e.g. close the panel). */
  onSaved?: () => void;
  /** Surface a save error (e.g. a toast). */
  onError?: (message: string) => void;
  /** Override the model lists. Defaults to `MODELS_BY_PROVIDER`. */
  models?: Record<ProviderType, ModelChoice[]>;
  /** Which providers to offer, in order. */
  providers?: ProviderType[];
}

const ALL_PROVIDERS: ProviderType[] = ['gateway', 'anthropic', 'openai', 'openai_compatible'];
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * A generic provider/model/key settings form, driven by the shared model
 * registry. App-agnostic: the app injects `onSave` (which encrypts the key and
 * writes its settings row). Use as `renderConfig` for `<ChatPanel>` or on a
 * dedicated settings page.
 */
export function ProviderForm({
  initial,
  onSave,
  onSaved,
  onError,
  models = MODELS_BY_PROVIDER,
  providers = ALL_PROVIDERS,
}: ProviderFormProps) {
  const [provider, setProvider] = useState<ProviderType>(initial.provider);
  const [model, setModel] = useState(initial.model);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl ?? '');
  const [saving, setSaving] = useState(false);

  const choices = models[provider] ?? [];
  const isLocal = provider === 'openai_compatible';
  const needsKey = providerNeedsKey(provider);

  function changeProvider(next: ProviderType) {
    setProvider(next);
    const list = models[next] ?? [];
    setModel(list[0]?.id ?? DEFAULT_MODEL[next] ?? '');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        provider,
        model: model.trim(),
        apiKey: apiKey.trim() || undefined,
        baseUrl: isLocal ? baseUrl.trim() || undefined : undefined,
      });
      onSaved?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to save provider settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} data-testid="provider-form">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="agent-provider" className="text-sm font-medium">
          Provider
        </label>
        <select
          id="agent-provider"
          value={provider}
          onChange={e => changeProvider(e.target.value as ProviderType)}
          className={selectClass}
        >
          {providers.map(p => (
            <option key={p} value={p}>
              {providerDisplayName(p)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="agent-model" className="text-sm font-medium">
          Model
        </label>
        {choices.length > 0 ? (
          <select
            id="agent-model"
            value={model}
            onChange={e => setModel(e.target.value)}
            className={selectClass}
          >
            {choices.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id="agent-model"
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="e.g. llama3.1"
          />
        )}
      </div>

      {isLocal && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="agent-base-url" className="text-sm font-medium">
            Base URL
          </label>
          <Input
            id="agent-base-url"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="http://localhost:11434/v1"
          />
          <div className="flex flex-wrap gap-2">
            {LOCAL_BASE_URL_HINTS.map(h => (
              <button
                key={h.url}
                type="button"
                onClick={() => setBaseUrl(h.url)}
                className={cn(
                  'rounded border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground'
                )}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {(needsKey || isLocal) && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="agent-api-key" className="text-sm font-medium">
            API key{isLocal ? ' (optional)' : ''}
          </label>
          <Input
            id="agent-api-key"
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            autoComplete="off"
            placeholder={initial.hasKey ? '•••••••• (saved — leave blank to keep)' : 'sk-…'}
          />
        </div>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}
