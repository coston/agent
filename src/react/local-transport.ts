import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type ChatTransport,
  type LanguageModel,
  type ToolSet,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';

export interface CreateLocalTransportOptions<TMessage extends UIMessage> {
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

const defaultOnError = (error: unknown): string =>
  error instanceof Error ? error.message : 'The local model ran into an error';

/**
 * A `useChat` `ChatTransport` that runs inference in the **browser** against the
 * user's own local / OpenAI-compatible endpoint instead of POSTing to a server
 * route. The local-provider twin of the server route: same standard `streamText`
 * + tools + round-trip, only the model call happens client-side — so the server
 * never requests the user-supplied base URL (no SSRF) and the local key never
 * leaves the browser.
 */
export function createLocalTransport<TMessage extends UIMessage>(
  options: CreateLocalTransportOptions<TMessage>
): ChatTransport<TMessage> {
  return {
    async sendMessages({ messages, abortSignal }) {
      const [model, system] = await Promise.all([
        options.buildModel(),
        options.buildSystemPrompt(messages as TMessage[]),
      ]);
      const result = streamText({
        model,
        system,
        messages: await convertToModelMessages(messages),
        tools: options.tools,
        stopWhen: stepCountIs(options.maxSteps ?? 12),
        abortSignal,
      });
      return result.toUIMessageStream<TMessage>({
        originalMessages: messages,
        onError: options.onError ?? defaultOnError,
      }) as ReadableStream<UIMessageChunk>;
    },
    async reconnectToStream() {
      // No resumable server stream for client-side inference.
      return null;
    },
  };
}
