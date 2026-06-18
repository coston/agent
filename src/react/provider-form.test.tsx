// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProviderForm } from './provider-form';
import type { ProviderSetting } from '../shared/provider-types';

const gateway: ProviderSetting = { provider: 'gateway', model: 'anthropic/claude-sonnet-4.6', hasKey: false, baseUrl: null };

afterEach(cleanup);

describe('ProviderForm', () => {
  it('shows curated models for the provider and no key field for the gateway', () => {
    render(<ProviderForm initial={gateway} onSave={vi.fn(async () => {})} />);
    expect((screen.getByLabelText('Model') as HTMLSelectElement).value).toBe('anthropic/claude-sonnet-4.6');
    expect(screen.queryByLabelText(/API key/)).toBeNull();
  });

  it('reveals the key field for a hosted direct provider', () => {
    render(<ProviderForm initial={gateway} onSave={vi.fn(async () => {})} />);
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'anthropic' } });
    expect(screen.getByLabelText('API key')).toBeTruthy();
    // model reset to the new provider's first choice
    expect((screen.getByLabelText('Model') as HTMLSelectElement).value).toBe('claude-opus-4-8');
  });

  it('shows base URL + free-text model for a local provider', () => {
    render(<ProviderForm initial={gateway} onSave={vi.fn(async () => {})} />);
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'openai_compatible' } });
    expect(screen.getByLabelText('Base URL')).toBeTruthy();
    expect(screen.getByLabelText(/API key/)).toBeTruthy();
    fireEvent.click(screen.getByText('Ollama'));
    expect((screen.getByLabelText('Base URL') as HTMLInputElement).value).toBe('http://localhost:11434/v1');
  });

  it('submits the selected provider/model/key and calls onSaved', async () => {
    const onSave = vi.fn(async () => {});
    const onSaved = vi.fn();
    render(<ProviderForm initial={gateway} onSave={onSave} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'anthropic' } });
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'claude-sonnet-4-6' } });
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'sk-test' } });
    fireEvent.submit(screen.getByTestId('provider-form'));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        apiKey: 'sk-test',
        baseUrl: undefined,
      })
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('surfaces a save failure via onError', async () => {
    const onError = vi.fn();
    render(
      <ProviderForm
        initial={gateway}
        onSave={vi.fn(async () => {
          throw new Error('boom');
        })}
        onError={onError}
      />
    );
    fireEvent.submit(screen.getByTestId('provider-form'));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('boom'));
  });
});
