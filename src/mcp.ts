// `@coston/agent/mcp` — consistent MCP server scaffolding so every app exposes
// its API to external agents (Claude Code, Cursor) the same way. A thin wrapper
// over `mcp-handler`; apps inject their tools and token verifier. Auth is never
// owned by the package.

export {
  createScopedHelper,
  mcpText,
  type McpTextResult,
  type McpToolExtra,
  type ScopedToolHandler,
} from './mcp/scoped';
export { createMcpRoute, type CreateMcpRouteOptions } from './mcp/route';
