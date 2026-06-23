import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type LanguageModel,
  type ToolSet,
  type UIMessage,
} from 'ai';
import type { PersistedMessage, PersistenceScope } from '../shared/messages';
import { ProviderError } from './errors';

/** Minimum shape of the chat request body — apps extend this with their own fields. */
export interface ChatRouteBody {
  messages: UIMessage[];
}

export interface AuthorizeSuccess<TContext> {
  userId: string;
  scope: PersistenceScope;
  context: TContext;
}

export interface AuthorizeFailure {
  error: string;
  status: number;
}

export type AuthorizeResult<TContext> = AuthorizeSuccess<TContext> | AuthorizeFailure;

/** Everything a tool/prompt builder needs: the authorized identity plus the raw body. */
export interface ChatRequest<TBody, TContext> {
  req: Request;
  body: TBody;
  userId: string;
  scope: PersistenceScope;
  context: TContext;
}

export interface CreateChatRouteOptions<TBody extends ChatRouteBody, TContext> {
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
  /**
   * Optional: transform the messages **just before they are sent to the model**
   * (e.g. resolve image/file parts that reference private storage into inline
   * bytes the provider can read). Receives the raw `UIMessage[]` and the
   * authorized request, and returns the messages to feed `convertToModelMessages`.
   *
   * Images already "just work" without this: `file` parts whose `url` is a
   * `data:` URL (inline base64) or a public `https://` URL are understood by the
   * provider as-is. Provide this only when the model needs help reaching the
   * bytes (auth-gated URLs, app-internal references, format conversion).
   *
   * Crucially, the returned messages are used **only** for the model call — the
   * untransformed `body.messages` are what get persisted, so heavyweight inlined
   * bytes never reach storage and the user's original parts (and the assistant's
   * reply) round-trip unchanged. Return a new array/clone — do **not** mutate the
   * input parts in place, or the inlined bytes will leak into persistence.
   */
  resolveAttachments?: (
    messages: UIMessage[],
    request: ChatRequest<TBody, TContext>
  ) => UIMessage[] | Promise<UIMessage[]>;
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
    saveMessages: (
      conversationId: string,
      scope: PersistenceScope,
      messages: PersistedMessage[]
    ) => Promise<void>;
  };
  /** Extract the conversation id from the request body. */
  conversationIdFrom: (body: TBody) => string | undefined;
  /** Max agent steps per request (`stopWhen: stepCountIs(maxSteps)`). Defaults to 12. */
  maxSteps?: number;
  /** Map a stream error to a client-facing message. Defaults to `error.message`. */
  onError?: (error: unknown) => string;
}

const DEFAULT_MAX_STEPS = 12;

const defaultOnError = (error: unknown): string =>
  error instanceof Error ? error.message : 'The agent ran into an error';

/**
 * Build a Next.js-style `POST` route handler for an agent chat. A thin wrapper
 * over the AI SDK's `streamText` → `toUIMessageStreamResponse`: it parses and
 * validates the body, delegates auth to `authorize`, resolves the model, streams
 * with the app's tools + system prompt, and persists the completed (non-aborted)
 * turn via `saveMessages`.
 */
export function createChatRoute<TBody extends ChatRouteBody, TContext>(
  options: CreateChatRouteOptions<TBody, TContext>
): { POST: (req: Request) => Promise<Response> } {
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const onError = options.onError ?? defaultOnError;
  const resolvedSave =
    options.saveMessages ??
    (options.persistence
      ? (args: { conversationId: string; scope: PersistenceScope; messages: PersistedMessage[] }) =>
          options.persistence!.saveMessages(args.conversationId, args.scope, args.messages)
      : undefined);
  if (!resolvedSave) {
    throw new Error('createChatRoute requires either `saveMessages` or `persistence`');
  }
  // Rebind to a non-optional const so the narrowing survives into the closure.
  const saveMessages = resolvedSave;

  async function POST(req: Request): Promise<Response> {
    const body = (await req.json().catch(() => null)) as TBody | null;
    if (!body || !Array.isArray(body.messages)) {
      return new Response('Invalid request body', { status: 400 });
    }
    const conversationId = options.conversationIdFrom(body);
    if (!conversationId) {
      return new Response('Missing conversationId', { status: 400 });
    }

    const authorized = await options.authorize(req, body);
    if ('error' in authorized) {
      return new Response(authorized.error, { status: authorized.status });
    }
    const { userId, scope, context } = authorized;
    const request: ChatRequest<TBody, TContext> = { req, body, userId, scope, context };

    let model: LanguageModel;
    try {
      model = await options.resolveModel(userId);
    } catch (e) {
      const message = e instanceof ProviderError ? e.message : 'AI provider is not configured.';
      return new Response(message, { status: 400 });
    }

    const [tools, system, modelMessages] = await Promise.all([
      options.buildTools(request),
      options.buildSystemPrompt(request),
      // The model sees the (optionally) attachment-resolved messages; persistence
      // below still uses the untransformed `body.messages`.
      options.resolveAttachments ? options.resolveAttachments(body.messages, request) : body.messages,
    ]);

    const result = streamText({
      model,
      system,
      messages: await convertToModelMessages(modelMessages),
      tools,
      stopWhen: stepCountIs(maxSteps),
    });

    return result.toUIMessageStreamResponse({
      originalMessages: body.messages,
      onError,
      onFinish: async ({ messages: finalMessages, isAborted }) => {
        // Don't persist a cancelled turn — it leaves a truncated message and
        // dangling tool parts.
        if (isAborted) return;
        await saveMessages({
          conversationId,
          scope,
          messages: finalMessages.map(m => ({ id: m.id, role: m.role, parts: m.parts })),
        });
      },
    });
  }

  return { POST };
}
