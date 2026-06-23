import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIMessage } from 'ai';
import { ProviderError } from './errors';

// Mock the AI SDK so the route's control flow can be tested without a real model
// call. We capture the args to `streamText` and the options to
// `toUIMessageStreamResponse` (notably `onFinish`) for assertions.
const { streamTextMock, toResponseMock } = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  toResponseMock: vi.fn(),
}));

vi.mock('ai', () => ({
  streamText: (args: unknown) => {
    streamTextMock(args);
    return {
      toUIMessageStreamResponse: (opts: unknown) => {
        toResponseMock(opts);
        return new Response('stream', { status: 200 });
      },
    };
  },
  convertToModelMessages: async (messages: unknown) => messages,
  stepCountIs: (n: number) => ({ stepCount: n }),
}));

const { createChatRoute } = await import('./route');

interface Body {
  messages: UIMessage[];
  conversationId?: string;
}

function jsonRequest(body: unknown): Request {
  return new Request('https://example.test/api/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function baseOptions(overrides: Partial<Parameters<typeof createChatRoute<Body, { role: string }>>[0]> = {}) {
  return {
    authorize: vi.fn(async () => ({
      userId: 'user-1',
      scope: { userId: 'user-1', partitionId: 'p1' },
      context: { role: 'owner' },
    })),
    resolveModel: vi.fn(async () => 'the-model' as unknown as never),
    buildTools: vi.fn(async () => ({}) as never),
    buildSystemPrompt: vi.fn(async () => 'system prompt'),
    saveMessages: vi.fn(async () => {}),
    conversationIdFrom: (body: Body) => body.conversationId,
    ...overrides,
  };
}

describe('createChatRoute', () => {
  beforeEach(() => {
    streamTextMock.mockClear();
    toResponseMock.mockClear();
  });

  it('returns 400 on a non-JSON body', async () => {
    const { POST } = createChatRoute(baseOptions());
    const res = await POST(
      new Request('https://example.test/api/chat', { method: 'POST', body: 'not json' })
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when messages is missing', async () => {
    const { POST } = createChatRoute(baseOptions());
    const res = await POST(jsonRequest({ conversationId: 'c1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when the conversation id is absent', async () => {
    const { POST } = createChatRoute(baseOptions());
    const res = await POST(jsonRequest({ messages: [] }));
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/conversationId/);
  });

  it('propagates the status and message from an authorize failure', async () => {
    const { POST } = createChatRoute(
      baseOptions({ authorize: vi.fn(async () => ({ error: 'Forbidden', status: 403 })) })
    );
    const res = await POST(jsonRequest({ messages: [], conversationId: 'c1' }));
    expect(res.status).toBe(403);
    expect(await res.text()).toBe('Forbidden');
  });

  it('returns 400 with the ProviderError message when the model cannot be resolved', async () => {
    const { POST } = createChatRoute(
      baseOptions({
        resolveModel: vi.fn(async () => {
          throw new ProviderError('Add your API key');
        }),
      })
    );
    const res = await POST(jsonRequest({ messages: [], conversationId: 'c1' }));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe('Add your API key');
  });

  it('streams with the resolved model, tools, system prompt, and step limit', async () => {
    const opts = baseOptions({ maxSteps: 7 });
    const { POST } = createChatRoute(opts);
    const res = await POST(jsonRequest({ messages: [{ id: 'u1', role: 'user', parts: [] }], conversationId: 'c1' }));
    expect(res.status).toBe(200);
    expect(streamTextMock).toHaveBeenCalledTimes(1);
    const args = streamTextMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(args.model).toBe('the-model');
    expect(args.system).toBe('system prompt');
    expect(args.stopWhen).toEqual({ stepCount: 7 });
    expect(opts.buildTools).toHaveBeenCalledOnce();
  });

  it('feeds resolveAttachments output to the model but persists the untransformed messages', async () => {
    const original = [
      { id: 'u1', role: 'user', parts: [{ type: 'file', mediaType: 'image/png', url: 'app://doc/1' }] },
    ] as unknown as UIMessage[];
    const resolved = [
      {
        id: 'u1',
        role: 'user',
        parts: [{ type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,AAAA' }],
      },
    ] as unknown as UIMessage[];
    const resolveAttachments = vi.fn(async () => resolved);
    const { POST } = createChatRoute(baseOptions({ resolveAttachments }));
    await POST(jsonRequest({ messages: original as unknown as UIMessage[], conversationId: 'c1' }));

    expect(resolveAttachments).toHaveBeenCalledOnce();
    expect(resolveAttachments).toHaveBeenCalledWith(
      original,
      expect.objectContaining({ userId: 'user-1', context: { role: 'owner' } })
    );
    // The model receives the resolved clone (the convertToModelMessages mock is identity).
    const args = streamTextMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(args.messages).toEqual(resolved);
    // Persistence/replay keeps the original, lightweight parts — inlined bytes never persist.
    const responseOpts = toResponseMock.mock.calls[0]![0] as { originalMessages: unknown };
    expect(responseOpts.originalMessages).toEqual(original);
    expect(responseOpts.originalMessages).not.toEqual(resolved);
  });

  it('persists the untransformed user turn plus the assistant reply, never the inlined bytes', async () => {
    // The user turn carries a lightweight reference; resolveAttachments would
    // inline it for the model only. onFinish must persist the ORIGINAL parts.
    const original = [
      { id: 'u1', role: 'user', parts: [{ type: 'file', mediaType: 'image/png', url: 'app://doc/1' }] },
    ] as unknown as UIMessage[]
    const resolveAttachments = vi.fn(async () => [
      { id: 'u1', role: 'user', parts: [{ type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,HEAVY' }] },
    ] as unknown as UIMessage[])
    const opts = baseOptions({ resolveAttachments })
    const { POST } = createChatRoute(opts)
    await POST(jsonRequest({ messages: original as unknown as UIMessage[], conversationId: 'c1' }))

    const responseOpts = toResponseMock.mock.calls[0]![0] as {
      originalMessages: { parts: { url: string }[] }[]
      onFinish: (a: { messages: unknown[]; isAborted: boolean }) => Promise<void>
    }
    // The SDK builds onFinish.messages as [...originalMessages, assistantReply].
    const assistant = { id: 'm1', role: 'assistant', parts: [{ type: 'text', text: 'done' }] }
    await responseOpts.onFinish({ messages: [...responseOpts.originalMessages, assistant], isAborted: false })

    const saved = (opts.saveMessages as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      messages: { id: string; role: string; parts: { url?: string; text?: string }[] }[]
    }
    // User part kept its lightweight reference (no base64), assistant reply retained.
    expect(saved.messages[0]!.parts[0]!.url).toBe('app://doc/1')
    expect(JSON.stringify(saved.messages)).not.toContain('HEAVY')
    expect(saved.messages.at(-1)).toEqual(assistant)
  })

  it('sends body.messages straight through when no resolveAttachments hook is given', async () => {
    const messages = [
      { id: 'u1', role: 'user', parts: [{ type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,AAAA' }] },
    ] as unknown as UIMessage[];
    const { POST } = createChatRoute(baseOptions());
    await POST(jsonRequest({ messages, conversationId: 'c1' }));
    const args = streamTextMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(args.messages).toEqual(messages);
  });

  it('persists a completed turn but skips an aborted one', async () => {
    const opts = baseOptions();
    const { POST } = createChatRoute(opts);
    await POST(jsonRequest({ messages: [{ id: 'u1', role: 'user', parts: [] }], conversationId: 'c1' }));

    const responseOpts = toResponseMock.mock.calls[0]![0] as {
      onFinish: (a: { messages: unknown[]; isAborted: boolean }) => Promise<void>;
    };
    const finalMessages = [
      { id: 'm1', role: 'assistant', parts: [{ type: 'text', text: 'hi' }], extra: 'dropped' },
    ];

    await responseOpts.onFinish({ messages: finalMessages, isAborted: false });
    expect(opts.saveMessages).toHaveBeenCalledWith({
      conversationId: 'c1',
      scope: { userId: 'user-1', partitionId: 'p1' },
      messages: [{ id: 'm1', role: 'assistant', parts: [{ type: 'text', text: 'hi' }] }],
    });

    vi.mocked(opts.saveMessages).mockClear();
    await responseOpts.onFinish({ messages: finalMessages, isAborted: true });
    expect(opts.saveMessages).not.toHaveBeenCalled();
  });

  it('persists via a `persistence` adapter when `saveMessages` is omitted', async () => {
    const persistence = { saveMessages: vi.fn(async () => {}) };
    const { authorize, resolveModel, buildTools, buildSystemPrompt, conversationIdFrom } = baseOptions();
    const { POST } = createChatRoute<Body, { role: string }>({
      authorize,
      resolveModel,
      buildTools,
      buildSystemPrompt,
      conversationIdFrom,
      persistence,
    });
    await POST(jsonRequest({ messages: [], conversationId: 'c1' }));
    const responseOpts = toResponseMock.mock.calls.at(-1)![0] as {
      onFinish: (a: { messages: unknown[]; isAborted: boolean }) => Promise<void>;
    };
    await responseOpts.onFinish({
      messages: [{ id: 'm1', role: 'assistant', parts: [] }],
      isAborted: false,
    });
    expect(persistence.saveMessages).toHaveBeenCalledWith(
      'c1',
      { userId: 'user-1', partitionId: 'p1' },
      [{ id: 'm1', role: 'assistant', parts: [] }]
    );
  });

  it('throws if neither saveMessages nor persistence is given', () => {
    const { authorize, resolveModel, buildTools, buildSystemPrompt, conversationIdFrom } = baseOptions();
    expect(() =>
      createChatRoute<Body, { role: string }>({
        authorize,
        resolveModel,
        buildTools,
        buildSystemPrompt,
        conversationIdFrom,
      })
    ).toThrow(/saveMessages.*persistence/);
  });
});
