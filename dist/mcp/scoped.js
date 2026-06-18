//#region src/mcp/scoped.ts
/** Wrap a string as an MCP text result. */
function mcpText(body) {
	return { content: [{
		type: "text",
		text: body
	}] };
}
/** Resolve the authenticated user + scopes from a validated bearer token's AuthInfo. */
function authContext(authInfo) {
	const userId = authInfo?.extra?.userId;
	if (typeof userId !== "string") throw new Error("Unauthorized: no user bound to this token");
	return {
		userId,
		scopes: authInfo?.scopes ?? []
	};
}
/**
* Build a `scoped(scope, handler)` wrapper for MCP tools, generic over the app's
* scope strings (e.g. `'workspace:read'`, `'workspace:write'`). The bearer token is
* resolved and scope-checked once, before the handler runs — so it's impossible
* to register a tool that forgets its authorization guard, and the handler only
* ever sees an authenticated `userId`.
*/
function createScopedHelper() {
	return function scoped(scope, handler) {
		return (args, extra) => {
			const { userId, scopes } = authContext(extra.authInfo);
			if (!scopes.includes(scope)) throw new Error(`This token lacks the required "${scope}" scope`);
			return handler(args, { userId });
		};
	};
}
//#endregion
export { createScopedHelper, mcpText };
