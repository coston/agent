import { ProviderError } from "./errors.js";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
//#region src/server/route.ts
const DEFAULT_MAX_STEPS = 12;
const defaultOnError = (error) => error instanceof Error ? error.message : "The agent ran into an error";
/**
* Build a Next.js-style `POST` route handler for an agent chat. A thin wrapper
* over the AI SDK's `streamText` → `toUIMessageStreamResponse`: it parses and
* validates the body, delegates auth to `authorize`, resolves the model, streams
* with the app's tools + system prompt, and persists the completed (non-aborted)
* turn via `saveMessages`.
*/
function createChatRoute(options) {
	const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
	const onError = options.onError ?? defaultOnError;
	const resolvedSave = options.saveMessages ?? (options.persistence ? (args) => options.persistence.saveMessages(args.conversationId, args.scope, args.messages) : void 0);
	if (!resolvedSave) throw new Error("createChatRoute requires either `saveMessages` or `persistence`");
	const saveMessages = resolvedSave;
	async function POST(req) {
		const body = await req.json().catch(() => null);
		if (!body || !Array.isArray(body.messages)) return new Response("Invalid request body", { status: 400 });
		const conversationId = options.conversationIdFrom(body);
		if (!conversationId) return new Response("Missing conversationId", { status: 400 });
		const authorized = await options.authorize(req, body);
		if ("error" in authorized) return new Response(authorized.error, { status: authorized.status });
		const { userId, scope, context } = authorized;
		const request = {
			req,
			body,
			userId,
			scope,
			context
		};
		let model;
		try {
			model = await options.resolveModel(userId);
		} catch (e) {
			const message = e instanceof ProviderError ? e.message : "AI provider is not configured.";
			return new Response(message, { status: 400 });
		}
		const [tools, system] = await Promise.all([options.buildTools(request), options.buildSystemPrompt(request)]);
		return streamText({
			model,
			system,
			messages: await convertToModelMessages(body.messages),
			tools,
			stopWhen: stepCountIs(maxSteps)
		}).toUIMessageStreamResponse({
			originalMessages: body.messages,
			onError,
			onFinish: async ({ messages: finalMessages, isAborted }) => {
				if (isAborted) return;
				await saveMessages({
					conversationId,
					scope,
					messages: finalMessages.map((m) => ({
						id: m.id,
						role: m.role,
						parts: m.parts
					}))
				});
			}
		});
	}
	return { POST };
}
//#endregion
export { createChatRoute };
