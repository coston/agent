import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

/**
 * The text-content result shape MCP tools return. A `type` alias (not an
 * `interface`) so it carries an implicit index signature and stays assignable to
 * the MCP SDK's `server.tool` callback return type.
 */
export type McpTextResult = {
  content: { type: 'text'; text: string }[];
};

/** Wrap a string as an MCP text result. */
export function mcpText(body: string): McpTextResult {
  return { content: [{ type: 'text' as const, text: body }] };
}

/** Resolve the authenticated user + scopes from a validated bearer token's AuthInfo. */
function authContext(authInfo: AuthInfo | undefined): { userId: string; scopes: string[] } {
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== 'string') throw new Error('Unauthorized: no user bound to this token');
  return { userId, scopes: authInfo?.scopes ?? [] };
}

export type ScopedToolHandler<Args> = (
  args: Args,
  ctx: { userId: string }
) => Promise<McpTextResult> | McpTextResult;

/** The extra argument the MCP SDK passes to a tool handler (carries the AuthInfo). */
export interface McpToolExtra {
  authInfo?: AuthInfo;
}

/**
 * Build a `scoped(scope, handler)` wrapper for MCP tools, generic over the app's
 * scope strings (e.g. `'workspace:read'`, `'workspace:write'`). The bearer token is
 * resolved and scope-checked once, before the handler runs — so it's impossible
 * to register a tool that forgets its authorization guard, and the handler only
 * ever sees an authenticated `userId`.
 */
export function createScopedHelper<TScope extends string>() {
  return function scoped<Args>(scope: TScope, handler: ScopedToolHandler<Args>) {
    return (args: Args, extra: McpToolExtra) => {
      const { userId, scopes } = authContext(extra.authInfo);
      if (!scopes.includes(scope)) {
        throw new Error(`This token lacks the required "${scope}" scope`);
      }
      return handler(args, { userId });
    };
  };
}
