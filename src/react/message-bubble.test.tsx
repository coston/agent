// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MessageBubble } from './message-bubble';

// No `globals: true`, so RTL's auto-cleanup is off — unmount between tests.
afterEach(cleanup);

// Streamdown does heavy markdown work; stub it to a plain node for the test.
vi.mock('streamdown', () => ({
  Streamdown: ({ children }: { children: ReactNode }) => <div data-testid="md">{children}</div>,
}));

// Render the dialog children inline so the enlarged image is queryable.
vi.mock('@coston/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('MessageBubble', () => {
  it('renders user text verbatim (not markdown)', () => {
    render(<MessageBubble message={{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }} />);
    expect(screen.getByText('hello')).toBeTruthy();
    expect(screen.queryByTestId('md')).toBeNull();
  });

  it('renders assistant text through Streamdown', () => {
    render(
      <MessageBubble
        message={{ id: '2', role: 'assistant', parts: [{ type: 'text', text: '# hi' }] }}
        assistantTestId="assistant-markdown"
      />
    );
    expect(screen.getByTestId('md').textContent).toContain('# hi');
    expect(screen.getByTestId('assistant-markdown')).toBeTruthy();
  });

  it('renders a running tool part with a humanized default label', () => {
    render(
      <MessageBubble
        message={{ id: '3', role: 'assistant', parts: [{ type: 'tool-run_task', state: 'input-available' }] }}
      />
    );
    expect(screen.getByText('Run task…')).toBeTruthy();
  });

  it('honors a custom tool renderer and reveals output on expand', () => {
    render(
      <MessageBubble
        message={{
          id: '4',
          role: 'assistant',
          parts: [{ type: 'tool-run_task', state: 'output-available', output: 'Added 2 items' }],
        }}
        toolRenderers={{ run_task: { label: 'Running task' } }}
      />
    );
    expect(screen.getByText('Running task')).toBeTruthy();
    // Output is collapsed by default.
    expect(screen.queryByTestId('tool-output')).toBeNull();
    fireEvent.click(screen.getByText('Running task'));
    expect(screen.getByTestId('tool-output').textContent).toContain('Added 2 items');
  });

  it('renders object output as a JSON code block when expanded', () => {
    render(
      <MessageBubble
        message={{
          id: '4b',
          role: 'assistant',
          parts: [{ type: 'tool-list_tasks', state: 'output-available', output: { count: 2 } }],
        }}
      />
    );
    fireEvent.click(screen.getByText('List tasks'));
    expect(screen.getByTestId('tool-output').textContent).toContain('"count": 2');
  });

  it('uses a custom render() for tool output', () => {
    render(
      <MessageBubble
        message={{
          id: '4c',
          role: 'assistant',
          parts: [{ type: 'tool-list_tasks', state: 'output-available', output: [{ id: 'x' }] }],
        }}
        toolRenderers={{
          list_tasks: {
            label: 'List tasks',
            render: output => <span>{(output as unknown[]).length} tasks</span>,
          },
        }}
      />
    );
    fireEvent.click(screen.getByText('List tasks'));
    expect(screen.getByText('1 tasks')).toBeTruthy();
  });

  it('shows a tool error only when expanded', () => {
    render(
      <MessageBubble
        message={{
          id: '4d',
          role: 'assistant',
          parts: [{ type: 'tool-run_task', state: 'output-error', errorText: 'boom' }],
        }}
      />
    );
    expect(screen.queryByText('boom')).toBeNull();
    fireEvent.click(screen.getByText('Run task'));
    expect(screen.getByText('boom')).toBeTruthy();
  });

  it('renders an approval request with working Approve/Deny buttons', () => {
    const onApproval = vi.fn();
    render(
      <MessageBubble
        message={{
          id: '6',
          role: 'assistant',
          parts: [
            { type: 'tool-approval-request', approvalId: 'a1', toolCall: { toolName: 'delete_task' } },
          ],
        }}
        toolRenderers={{ delete_task: { label: 'Delete task' } }}
        onApproval={onApproval}
      />
    );
    expect(screen.getByText('Approve Delete task?')).toBeTruthy();
    fireEvent.click(screen.getByText('Approve'));
    expect(onApproval).toHaveBeenCalledWith({ id: 'a1', approved: true });
    fireEvent.click(screen.getByText('Deny'));
    expect(onApproval).toHaveBeenCalledWith({ id: 'a1', approved: false });
  });

  it('renders a rich approval from a tool part in approval-requested state', () => {
    const onApproval = vi.fn();
    render(
      <MessageBubble
        message={{
          id: '6b',
          role: 'assistant',
          parts: [
            {
              type: 'tool-propose_plan',
              state: 'approval-requested',
              input: { summary: 'Set up the garage', steps: [{ label: 'Create space "Garage"' }] },
              approval: { id: 'p1' },
            },
          ],
        }}
        toolRenderers={{
          propose_plan: {
            label: 'Plan',
            renderApproval: ({ input, approve, deny }) => {
              const plan = input as { summary: string };
              return (
                <div>
                  <span>{plan.summary}</span>
                  <button onClick={approve}>Approve &amp; run</button>
                  <button onClick={deny}>Request changes</button>
                </div>
              );
            },
          },
        }}
        onApproval={onApproval}
      />
    );
    expect(screen.getByText('Set up the garage')).toBeTruthy();
    fireEvent.click(screen.getByText('Approve & run'));
    expect(onApproval).toHaveBeenCalledWith({ id: 'p1', approved: true });
    fireEvent.click(screen.getByText('Request changes'));
    expect(onApproval).toHaveBeenCalledWith({ id: 'p1', approved: false });
  });

  it('deduplicates a bare tool-approval-request when a rich tool part covers it', () => {
    render(
      <MessageBubble
        message={{
          id: '6c',
          role: 'assistant',
          parts: [
            {
              type: 'tool-propose_plan',
              state: 'approval-requested',
              input: { summary: 'Do the thing' },
              approval: { id: 'dup1' },
            },
            { type: 'tool-approval-request', approvalId: 'dup1', toolCall: { toolName: 'propose_plan' } },
          ],
        }}
        toolRenderers={{
          propose_plan: {
            label: 'Plan',
            renderApproval: ({ input }) => <span>{(input as { summary: string }).summary}</span>,
          },
        }}
      />
    );
    // Only the rich card renders; the bare request is suppressed.
    expect(screen.getAllByTestId('tool-approval')).toHaveLength(1);
    expect(screen.getByText('Do the thing')).toBeTruthy();
  });

  it('renders an image file part as an inline image with click-to-enlarge', () => {
    render(
      <MessageBubble
        message={{
          id: '7',
          role: 'user',
          parts: [{ type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,AAA', filename: 'cans.png' }],
        }}
      />
    );
    expect(screen.getByTestId('message-image')).toBeTruthy();
    const imgs = screen.getAllByAltText('cans.png') as HTMLImageElement[];
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs[0]!.getAttribute('src')).toBe('data:image/png;base64,AAA');
  });

  it('renders a non-image file part as a download link', () => {
    render(
      <MessageBubble
        message={{
          id: '8',
          role: 'user',
          parts: [{ type: 'file', mediaType: 'application/pdf', url: 'https://x/doc.pdf', filename: 'doc.pdf' }],
        }}
      />
    );
    const link = screen.getByText('doc.pdf') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://x/doc.pdf');
  });

  it('skips empty text parts', () => {
    const { container } = render(
      <MessageBubble message={{ id: '5', role: 'assistant', parts: [{ type: 'text', text: '' }] }} />
    );
    expect(container.querySelector('[data-testid="md"]')).toBeNull();
  });
});
