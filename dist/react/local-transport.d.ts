import { ChatTransport, LanguageModel, ToolSet, UIMessage } from "ai";

//#region src/react/local-transport.d.ts
interface CreateLocalTransportOptions<TMessage extends UIMessage> {
  /** Build the browser-side model (e.g. `createOpenAICompatible(...)`). May be async. */
  buildModel: () => LanguageModel | Promise<LanguageModel>;
  /** Build the system prompt for this turn (apps ground it in live app state). */
  buildSystemPrompt: (messages: TMessage[]) => string | Promise<string>;
  /** The tools to expose. Schema-only (no `execute`) tools are run via `useChat`'s `onToolCall`. */
  tools: ToolSet;
  /** Max agent steps per turn. Defaults to 12. */
  maxSteps?: number;
  /** Map a stream error to a client-facing message. */
  onError?: (error: unknown) => string;
}
/**
 * A `useChat` `ChatTransport` that runs inference in the **browser** against the
 * user's own local / OpenAI-compatible endpoint instead of POSTing to a server
 * route. The local-provider twin of the server route: same standard `streamText`
 * + tools + round-trip, only the model call happens client-side — so the server
 * never requests the user-supplied base URL (no SSRF) and the local key never
 * leaves the browser.
 */
declare function createLocalTransport<TMessage extends UIMessage>(options: CreateLocalTransportOptions<TMessage>): ChatTransport<TMessage>;
//#endregion
export { CreateLocalTransportOptions, createLocalTransport };