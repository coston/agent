import { createMcpHandler, withMcpAuth } from "mcp-handler";
//#region src/mcp/route.ts
/**
* Build the Streamable-HTTP MCP route handlers (`GET`/`POST`/`DELETE`) for a
* Next.js `app/api/[transport]/route.ts`. A thin wrapper over `mcp-handler`'s
* `createMcpHandler` + `withMcpAuth`: the app supplies its tools and token
* verifier; everything else (transport, auth wiring, metadata) is standard.
*/
function createMcpRoute(options) {
	const authHandler = withMcpAuth(createMcpHandler((server) => options.registerTools(server), { serverInfo: options.serverInfo }, {
		basePath: options.basePath ?? "/api",
		disableSse: options.disableSse ?? true,
		verboseLogs: options.verboseLogs ?? process.env.NODE_ENV !== "production"
	}), options.verifyToken, {
		required: options.required ?? true,
		...options.oauth ? { resourceMetadataPath: options.oauth.resourceMetadataPath } : {}
	});
	return {
		GET: authHandler,
		POST: authHandler,
		DELETE: authHandler
	};
}
//#endregion
export { createMcpRoute };
