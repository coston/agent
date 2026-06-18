// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

interface CapturedOptions {
  onToolCall?: (a: { toolCall: unknown }) => void;
  onError?: (e: Error) => void;
  onFinish?: (a: { messages: { id: string; role: string; parts: unknown }[]; isAbort?: boolean; isError?: boolean; finishReason?: string }) => void;
}

const h = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  stop: vi.fn(),
  addToolOutput: vi.fn(),
  addToolApprovalResponse: vi.fn(),
  state: {
    messages: [] as { id: string; role: string; parts: unknown[] }[],
    status: 'ready' as string,
    lastOptions: undefined as CapturedOptions | undefined,
  },
}));

vi.mock('@ai-sdk/react', () => ({
  useChat: (opts: CapturedOptions) => {
    h.state.lastOptions = opts;
    return {
      messages: h.state.messages,
      sendMessage: h.sendMessage,
      addToolOutput: h.addToolOutput,
      addToolApprovalResponse: h.addToolApprovalResponse,
      status: h.state.status,
      stop: h.stop,
    };
  },
}));
vi.mock('ai', () => ({ lastAssistantMessageIsCompleteWithToolCalls: () => false }));
vi.mock('streamdown', () => ({ Streamdown: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

const { ChatSession } = await import('./chat-session');

function renderSession(props: Partial<Parameters<typeof ChatSession>[0]> = {}) {
  return render(
    <ChatSession
      conversationId="c1"
      transport={{} as never}
      initialMessages={[]}
      providerReady
      {...props}
    />
  );
}

describe('ChatSession', () => {
  beforeEach(() => {
    h.sendMessage.mockClear();
    h.stop.mockClear();
    h.addToolOutput.mockClear();
    h.state.messages = [];
    h.state.status = 'ready';
    h.state.lastOptions = undefined;
  });
  afterEach(cleanup);

  it('shows the connect banner and disables input when no provider is ready', () => {
    const onConfigure = vi.fn();
    renderSession({ providerReady: false, onConfigure });
    expect(screen.getByText(/Connect an AI provider/)).toBeTruthy();
    fireEvent.click(screen.getByText('Configure'));
    expect(onConfigure).toHaveBeenCalled();
  });

  it('renders suggestions and sends one on click', () => {
    renderSession({ suggestions: ['Design a chat app'] });
    fireEvent.click(screen.getByText('Design a chat app'));
    expect(h.sendMessage).toHaveBeenCalledWith({ text: 'Design a chat app' });
  });

  it('submits typed input', () => {
    renderSession();
    const textarea = screen.getByPlaceholderText('Ask the agent…');
    fireEvent.change(textarea, { target: { value: 'hello there' } });
    fireEvent.click(screen.getByLabelText('Send'));
    expect(h.sendMessage).toHaveBeenCalledWith({ text: 'hello there' });
  });

  it('shows a stop button while streaming', () => {
    h.state.status = 'streaming';
    renderSession();
    fireEvent.click(screen.getByLabelText('Stop'));
    expect(h.stop).toHaveBeenCalled();
  });

  it('wires onToolCall with addToolOutput, and onError', () => {
    const onToolCall = vi.fn();
    const onError = vi.fn();
    renderSession({ onToolCall, onError });

    const opts = h.state.lastOptions!;
    opts.onToolCall?.({ toolCall: { toolName: 'run_task', toolCallId: 't1', input: { ops: [] } } });
    expect(onToolCall).toHaveBeenCalledTimes(1);
    const arg = onToolCall.mock.calls[0]![0] as { toolCall: { toolName: string }; addToolOutput: (r: unknown) => void };
    expect(arg.toolCall.toolName).toBe('run_task');
    arg.addToolOutput({ tool: 'run_task', toolCallId: 't1', output: 'done' });
    expect(h.addToolOutput).toHaveBeenCalledWith({ tool: 'run_task', toolCallId: 't1', output: 'done' });

    opts.onError?.(new Error('boom'));
    expect(onError).toHaveBeenCalledWith('boom');
  });

  it('hands a settled turn to onTurnSettled (for local persistence)', () => {
    const onTurnSettled = vi.fn();
    renderSession({ onTurnSettled });
    h.state.lastOptions!.onFinish?.({
      messages: [{ id: 'm1', role: 'assistant', parts: [], extra: 'x' } as never],
      isAbort: false,
      isError: false,
      finishReason: 'stop',
    });
    expect(onTurnSettled).toHaveBeenCalledWith({
      conversationId: 'c1',
      messages: [{ id: 'm1', role: 'assistant', parts: [] }],
      isAbort: false,
      isError: false,
      finishReason: 'stop',
    });
  });
});
