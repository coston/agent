import { PersistedMessage, PersistenceScope } from "../shared/messages.js";
import { LanguageModel, ToolSet, UIMessage } from "ai";

//#region src/server/route.d.ts
/** Minimum shape of the chat request body — apps extend this with their own fields. */
interface ChatRouteBody {
  messages: UIMessage[];
}
interface AuthorizeSuccess<TContext> {
  userId: string;
  scope: PersistenceScope;
  context: TContext;
}
interface AuthorizeFailure {
  error: string;
  status: number;
}
type AuthorizeResult<TContext> = AuthorizeSuccess<TContext> | AuthorizeFailure;
/** Everything a tool/prompt builder needs: the authorized identity plus the raw body. */
interface ChatRequest<TBody, TContext> {
  req: Request;
  body: TBody;
  userId: string;
  scope: PersistenceScope;
  context: TContext;
}
interface CreateChatRouteOptions<TBody extends ChatRouteBody, TContext> {
  /**
   * Authenticate and authorize the request. Return the resolved identity + an
   * app-defined `context` (role, partition id, prefetched data, …) on success,
   * or `{ error, status }` to short-circuit. ALL app auth lives here — the
   * package owns none of it.
   */
  authorize: (req: Request, body: TBody) => Promise<AuthorizeResult<TContext>>;
  /** Resolve the user's `LanguageModel` (typically `providerResolver.resolveUserModel`). */
  resolveModel: (userId: string) => Promise<LanguageModel>;
  /**
   * The tools to expose this turn — a standard AI SDK `ToolSet`; `execute` is
   * optional (tools without it are run client-side via `useChat`'s `onToolCall`).
   * A specifically-typed tool set (e.g. one typed for `InferUITools` on the
   * client) is accepted directly — no cast needed, as long as the app and this
   * package resolve the same `ai` version (the norm, since `ai` is a peer dep).
   */
  buildTools: (request: ChatRequest<TBody, TContext>) => ToolSet | Promise<ToolSet>;
  /** The system prompt for this turn. */
  buildSystemPrompt: (request: ChatRequest<TBody, TContext>) => string | Promise<string>;
  /** Persist a completed turn. Provide this **or** `persistence`. */
  saveMessages?: (args: {
    conversationId: string;
    scope: PersistenceScope;
    messages: PersistedMessage[];
  }) => Promise<void>;
  /**
   * A persistence adapter (e.g. `createPrismaPersistence(...)`); its
   * `saveMessages` is wired automatically. Provide this **or** `saveMessages`.
   */
  persistence?: {
    saveMessages: (conversationId: string, scope: PersistenceScope, messages: PersistedMessage[]) => Promise<void>;
  };
  /** Extract the conversation id from the request body. */
  conversationIdFrom: (body: TBody) => string | undefined;
  /** Max agent steps per request (`stopWhen: stepCountIs(maxSteps)`). Defaults to 12. */
  maxSteps?: number;
  /** Map a stream error to a client-facing message. Defaults to `error.message`. */
  onError?: (error: unknown) => string;
}
/**
 * Build a Next.js-style `POST` route handler for an agent chat. A thin wrapper
 * over the AI SDK's `streamText` → `toUIMessageStreamResponse`: it parses and
 * validates the body, delegates auth to `authorize`, resolves the model, streams
 * with the app's tools + system prompt, and persists the completed (non-aborted)
 * turn via `saveMessages`.
 */
declare function createChatRoute<TBody extends ChatRouteBody, TContext>(options: CreateChatRouteOptions<TBody, TContext>): {
  POST: (req: Request) => Promise<Response>;
};
//#endregion
export { AuthorizeFailure, AuthorizeResult, AuthorizeSuccess, ChatRequest, ChatRouteBody, CreateChatRouteOptions, createChatRoute };