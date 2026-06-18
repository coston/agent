import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

//#region src/mcp/route.d.ts
interface CreateMcpRouteOptions {
  /** Advertised server identity. */
  serverInfo: {
    name: string;
    version: string;
  };
  /** Register the app's tools on the server (typically via `createScopedHelper`). */
  registerTools: (server: McpServer) => void;
  /**
   * Resolve a bearer token to an `AuthInfo` (or `undefined` to reject). The
   * package ships NO verifier — apps inject PAT, OAuth 2.1, or both. The resolved
   * `authInfo.extra.userId` is what `scoped()` tools run as.
   */
  verifyToken: (req: Request, bearer?: string) => Promise<AuthInfo | undefined>;
  /** Base path the handler is mounted under. Defaults to `/api`. */
  basePath?: string;
  /** Disable the deprecated SSE transport (Streamable HTTP only). Defaults to true. */
  disableSse?: boolean;
  /** Verbose logs. Defaults to `process.env.NODE_ENV !== 'production'`. */
  verboseLogs?: boolean;
  /** Reject unauthenticated calls. Defaults to true. */
  required?: boolean;
  /** Advertise OAuth 2.1 protected-resource metadata (points clients at the AS). */
  oauth?: {
    resourceMetadataPath: string;
  };
}
type RouteHandler = (req: Request) => Response | Promise<Response>;
/**
 * Build the Streamable-HTTP MCP route handlers (`GET`/`POST`/`DELETE`) for a
 * Next.js `app/api/[transport]/route.ts`. A thin wrapper over `mcp-handler`'s
 * `createMcpHandler` + `withMcpAuth`: the app supplies its tools and token
 * verifier; everything else (transport, auth wiring, metadata) is standard.
 */
declare function createMcpRoute(options: CreateMcpRouteOptions): {
  GET: RouteHandler;
  POST: RouteHandler;
  DELETE: RouteHandler;
};
//#endregion
export { CreateMcpRouteOptions, createMcpRoute };