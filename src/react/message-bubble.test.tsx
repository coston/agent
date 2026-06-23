// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MessageBubble } from './message-bubble';

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

  it('honors a custom tool renderer and shows output when complete', () => {
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
    expect(screen.getByText('Added 2 items')).toBeTruthy();
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
