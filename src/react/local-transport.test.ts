import { describe, expect, it, vi } from 'vitest';

const { streamTextMock } = vi.hoisted(() => ({ streamTextMock: vi.fn((..._args: unknown[]) => {}) }));

vi.mock('ai', () => ({
  streamText: (args: unknown) => {
    streamTextMock(args);
    return { toUIMessageStream: () => 'STREAM' };
  },
  convertToModelMessages: async (messages: unknown) => messages,
  stepCountIs: (n: number) => ({ steps: n }),
}));

const { createLocalTransport } = await import('./local-transport');

type SendArgs = Parameters<ReturnType<typeof createLocalTransport>['sendMessages']>[0];
type ReconnectArgs = Parameters<ReturnType<typeof createLocalTransport>['reconnectToStream']>[0];

describe('createLocalTransport', () => {
  it('streams in the browser with injected model, prompt, tools, and step limit', async () => {
    const buildModel = vi.fn(async () => 'local-model');
    const buildSystemPrompt = vi.fn(async () => 'system');
    const tools = { run_task: {} } as never;
    const transport = createLocalTransport({ buildModel, buildSystemPrompt, tools, maxSteps: 10 });

    const stream = await transport.sendMessages({
      messages: [{ id: 'u1', role: 'user', parts: [] }],
      abortSignal: undefined,
    } as unknown as SendArgs);

    expect(stream).toBe('STREAM');
    expect(buildModel).toHaveBeenCalledOnce();
    expect(buildSystemPrompt).toHaveBeenCalledOnce();
    const args = streamTextMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(args.model).toBe('local-model');
    expect(args.system).toBe('system');
    expect(args.tools).toBe(tools);
    expect(args.stopWhen).toEqual({ steps: 10 });
  });

  it('has no resumable server stream', async () => {
    const transport = createLocalTransport({
      buildModel: async () => 'm' as never,
      buildSystemPrompt: async () => 's',
      tools: {} as never,
    });
    expect(await transport.reconnectToStream({ chatId: 'c1' } as unknown as ReconnectArgs)).toBeNull();
  });
});
