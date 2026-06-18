import { describe, expect, it, vi } from 'vitest';
import { createScopedHelper, mcpText } from './scoped';
import type { McpToolExtra } from './scoped';

function extra(userId: unknown, scopes: string[]): McpToolExtra {
  return { authInfo: { token: 't', clientId: 'c', scopes, extra: { userId } } as never };
}

describe('mcpText', () => {
  it('wraps a string as a single text-content result', () => {
    expect(mcpText('hello')).toEqual({ content: [{ type: 'text', text: 'hello' }] });
  });
});

describe('createScopedHelper', () => {
  const scoped = createScopedHelper<'workspace:read' | 'workspace:write'>();

  it('runs the handler with the resolved userId when the scope is present', async () => {
    const handler = vi.fn(async () => mcpText('ok'));
    const tool = scoped('workspace:read', handler);
    const result = await tool({ q: 1 }, extra('user-1', ['workspace:read']));
    expect(handler).toHaveBeenCalledWith({ q: 1 }, { userId: 'user-1' });
    expect(result).toEqual(mcpText('ok'));
  });

  it('rejects when no user is bound to the token', () => {
    const tool = scoped('workspace:read', async () => mcpText('ok'));
    expect(() => tool({}, extra(undefined, ['workspace:read']))).toThrow(/no user bound/);
  });

  it('rejects when the token lacks the required scope', () => {
    const tool = scoped('workspace:write', async () => mcpText('ok'));
    expect(() => tool({}, extra('user-1', ['workspace:read']))).toThrow(/lacks the required "workspace:write"/);
  });

  it('treats a missing authInfo as unauthorized', () => {
    const tool = scoped('workspace:read', async () => mcpText('ok'));
    expect(() => tool({}, {})).toThrow(/no user bound/);
  });
});
