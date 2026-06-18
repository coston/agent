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
