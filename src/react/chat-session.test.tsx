// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

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
    // jsdom lacks object-URL APIs the attachment previews use.
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
    globalThis.URL.revokeObjectURL = vi.fn();
  });
  afterEach(cleanup);

  function pngFile(name = 'cans.png') {
    return new File(['fake-bytes'], name, { type: 'image/png' });
  }

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

  it('uploads an attachment and sends it as a file part referencing the upload', async () => {
    const uploadFile = vi.fn(async () => ({
      url: '/api/documents/doc1/url',
      mediaType: 'image/png',
      filename: 'cans.png',
      providerMetadata: { coston: { documentId: 'doc1' } },
    }));
    renderSession({ uploadFile });

    fireEvent.change(screen.getByTestId('attachment-input'), { target: { files: [pngFile()] } });
    await waitFor(() => expect(uploadFile).toHaveBeenCalledOnce());
    await waitFor(() => expect((screen.getByLabelText('Send') as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(screen.getByLabelText('Send'));
    expect(h.sendMessage).toHaveBeenCalledWith({
      files: [
        {
          type: 'file',
          url: '/api/documents/doc1/url',
          mediaType: 'image/png',
          filename: 'cans.png',
          providerMetadata: { coston: { documentId: 'doc1' } },
        },
      ],
    });
  });

  it('inlines an attachment as a data URL by default (no uploadFile)', async () => {
    renderSession();
    fireEvent.change(screen.getByTestId('attachment-input'), { target: { files: [pngFile()] } });
    await waitFor(() => expect((screen.getByLabelText('Send') as HTMLButtonElement).disabled).toBe(false));

    fireEvent.change(screen.getByPlaceholderText('Ask the agent…'), { target: { value: 'inventory these' } });
    fireEvent.click(screen.getByLabelText('Send'));

    expect(h.sendMessage).toHaveBeenCalledTimes(1);
    const arg = h.sendMessage.mock.calls[0]![0] as { text?: string; files: { type: string; url: string; mediaType: string }[] };
    expect(arg.text).toBe('inventory these');
    expect(arg.files).toHaveLength(1);
    expect(arg.files[0]!.type).toBe('file');
    expect(arg.files[0]!.mediaType).toBe('image/png');
    expect(arg.files[0]!.url.startsWith('data:image/png')).toBe(true);
  });

  it('removes a pending attachment when its remove button is clicked', async () => {
    renderSession();
    fireEvent.change(screen.getByTestId('attachment-input'), { target: { files: [pngFile()] } });
    await waitFor(() => expect(screen.getByTestId('attachment-thumb')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Remove cans.png'));
    expect(screen.queryByTestId('attachment-thumb')).toBeNull();
  });

  it('opens a full-screen preview when a thumbnail is clicked, and closes it', async () => {
    renderSession();
    fireEvent.change(screen.getByTestId('attachment-input'), { target: { files: [pngFile()] } });
    await waitFor(() => expect(screen.getByTestId('attachment-thumb')).toBeTruthy());

    fireEvent.click(screen.getByTestId('attachment-thumb').querySelector('img')!);
    const preview = await screen.findByTestId('attachment-preview');
    expect(preview.querySelector('img')).toBeTruthy();

    // Tapping the previewed image dismisses it.
    fireEvent.click(preview.querySelector('img')!);
    await waitFor(() => expect(screen.queryByTestId('attachment-preview')).toBeNull());
  });

  it('lays attachments out in a single horizontally-scrolling row', async () => {
    renderSession();
    fireEvent.change(screen.getByTestId('attachment-input'), { target: { files: [pngFile()] } });
    await waitFor(() => expect(screen.getByTestId('attachment-strip')).toBeTruthy());
    const strip = screen.getByTestId('attachment-strip');
    expect(strip.className).toContain('overflow-x-auto');
    expect(strip.className).not.toContain('flex-wrap');
  });

  it('hides attachment controls when disabled', () => {
    renderSession({ enableAttachments: false });
    expect(screen.queryByTestId('attachment-input')).toBeNull();
    expect(screen.queryByLabelText('Attach images')).toBeNull();
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
