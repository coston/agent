import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

//#region src/mcp/scoped.d.ts

/**
 * The text-content result shape MCP tools return. A `type` alias (not an
 * `interface`) so it carries an implicit index signature and stays assignable to
 * the MCP SDK's `server.tool` callback return type.
 */
type McpTextResult = {
  content: {
    type: 'text';
    text: string;
  }[];
};
/** Wrap a string as an MCP text result. */
declare function mcpText(body: string): McpTextResult;
type ScopedToolHandler<Args> = (args: Args, ctx: {
  userId: string;
}) => Promise<McpTextResult> | McpTextResult;
/** The extra argument the MCP SDK passes to a tool handler (carries the AuthInfo). */
interface McpToolExtra {
  authInfo?: AuthInfo;
}
/**
 * Build a `scoped(scope, handler)` wrapper for MCP tools, generic over the app's
 * scope strings (e.g. `'workspace:read'`, `'workspace:write'`). The bearer token is
 * resolved and scope-checked once, before the handler runs — so it's impossible
 * to register a tool that forgets its authorization guard, and the handler only
 * ever sees an authenticated `userId`.
 */
declare function createScopedHelper<TScope extends string>(): <Args>(scope: TScope, handler: ScopedToolHandler<Args>) => (args: Args, extra: McpToolExtra) => McpTextResult | Promise<McpTextResult>;
//#endregion
export { McpTextResult, McpToolExtra, ScopedToolHandler, createScopedHelper, mcpText };