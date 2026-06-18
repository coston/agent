import { convertToModelMessages, stepCountIs, streamText } from "ai";
//#region src/react/local-transport.ts
const defaultOnError = (error) => error instanceof Error ? error.message : "The local model ran into an error";
/**
* A `useChat` `ChatTransport` that runs inference in the **browser** against the
* user's own local / OpenAI-compatible endpoint instead of POSTing to a server
* route. The local-provider twin of the server route: same standard `streamText`
* + tools + round-trip, only the model call happens client-side — so the server
* never requests the user-supplied base URL (no SSRF) and the local key never
* leaves the browser.
*/
function createLocalTransport(options) {
	return {
		async sendMessages({ messages, abortSignal }) {
			const [model, system] = await Promise.all([options.buildModel(), options.buildSystemPrompt(messages)]);
			return streamText({
				model,
				system,
				messages: await convertToModelMessages(messages),
				tools: options.tools,
				stopWhen: stepCountIs(options.maxSteps ?? 12),
				abortSignal
			}).toUIMessageStream({
				originalMessages: messages,
				onError: options.onError ?? defaultOnError
			});
		},
		async reconnectToStream() {
			return null;
		}
	};
}
//#endregion
export { createLocalTransport };
